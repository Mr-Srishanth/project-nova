/**
 * Robust extraction of a single structured JSON value from a Gemini reply.
 *
 * Why this exists: `callGemini` in server/gateway.ts used to try only
 *   1. JSON.parse on the whole reply,
 *   2. stripping a ```json fence anchored at the very start/end,
 *   3. the slice from the first "{" to the last "}".
 * That fails on every shape Gemini actually produces in the wild:
 *   - output truncated by maxOutputTokens (a code file embedded as one big
 *     JSON string is far larger than the old 8192-token cap) — the slice
 *     is still truncated, so it can never parse;
 *   - prose before/after the JSON, or a fence that is not at the very
 *     start/end of the reply;
 *   - a top-level JSON array (the old code only ever looked for braces);
 *   - trailing commas, or raw control characters / literal newlines inside
 *     a string value (common when the model emits code as a string);
 *   - several JSON blocks, where first-"{"-to-last-"}" glues two blocks
 *     into one invalid document.
 *
 * The extractor below is deliberately conservative: every repair it tries
 * must still yield a value that JSON.parse accepts on its own. It never
 * invents missing content — a truncated document stays an error, it just
 * gets reported as "truncated" (which is what the retry logic keys on)
 * instead of a generic parse failure.
 *
 * Pure TypeScript, no imports: server/gateway.ts (Bun) imports it, and
 * the Vitest suite in src/ imports it by relative path.
 */

export type StructuredJsonFailureKind = "empty" | "truncated" | "invalid";

export class StructuredJsonParseError extends Error {
  readonly kind: StructuredJsonFailureKind;
  readonly outputLength: number;
  readonly preview: string;

  constructor(kind: StructuredJsonFailureKind, outputLength: number, preview: string) {
    super(`Structured JSON parse failed (${kind})`);
    this.name = "StructuredJsonParseError";
    this.kind = kind;
    this.outputLength = outputLength;
    this.preview = preview;
  }
}

/** Collapse whitespace and redact long opaque tokens (keys, hashes) from a preview. */
export function sanitisePreview(text: string, maxChars = 300): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const redacted = collapsed.replace(/[A-Za-z0-9_\-]{32,}/g, "[REDACTED]");
  if (collapsed.length <= maxChars) return redacted;
  const head = redacted.slice(0, 200);
  const tail = redacted.slice(-100);
  return `${head} … ${tail}`;
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Repair only safe, mechanical defects: trailing commas and raw control
 *  characters inside string literals (escaped, so the content is preserved
 *  rather than deleted). Returns undefined when the result still will not parse. */
function tryRepair(text: string): unknown | undefined {
  // 1. Trailing commas before } or ].
  let repaired = text.replace(/,\s*([}\]])/g, "$1");
  // 2. Escape raw control characters that appear inside string literals.
  //    Walk the document so braces/brackets inside strings are not mistaken
  //    for structure, and so already-escaped sequences are left alone.
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of repaired) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else out += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
    } else {
      out += ch;
      if (ch === '"') inString = true;
    }
  }
  repaired = out;
  const parsed = tryParse(repaired);
  return parsed === undefined ? undefined : parsed;
}

/** All ```fenced blocks in the reply, in order (language tag optional,
 *  and an unclosed trailing fence still yields its remainder as a candidate). */
export function extractFencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  const fenceRe = /```(?:json|JSON)?[ \t]*\r?\n?([\s\S]*?)(?:```|$)/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(text)) !== null) {
    const body = match[1].trim();
    if (body) blocks.push(body);
    // Guard against a zero-length match looping forever.
    if (match[0].length === 0) fenceRe.lastIndex += 1;
  }
  return blocks;
}

interface BalancedScan {
  /** Index just past the closing bracket, or -1 when the value never closes. */
  end: number;
  /** True when the scan hit end-of-text with depth still > 0. */
  truncated: boolean;
}

/** Scan one JSON value starting at `start` (which must be "{" or "["),
 *  honouring string literals and escapes so braces inside code strings do
 *  not end the value early. */
function scanBalanced(text: string, start: number): BalancedScan {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return { end: i + 1, truncated: false };
    }
  }
  return { end: -1, truncated: depth > 0 || inString };
}

/** Balanced JSON candidates, in order of appearance, each with its text. */
function balancedCandidates(text: string): { slice: string; truncated: boolean }[] {
  const candidates: { slice: string; truncated: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const scan = scanBalanced(text, i);
    if (scan.end !== -1) {
      candidates.push({ slice: text.slice(i, scan.end), truncated: false });
      i = scan.end - 1;
    } else if (scan.truncated) {
      candidates.push({ slice: text.slice(i), truncated: true });
      break;
    }
  }
  return candidates;
}

function failureKind(text: string): StructuredJsonFailureKind {
  if (!text.trim()) return "empty";
  // A balanced scan that never closes means the model stopped mid-value:
  // the classic maxOutputTokens truncation signature.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const scan = scanBalanced(text, i);
    if (scan.truncated) return "truncated";
    if (scan.end !== -1) break;
  }
  return "invalid";
}

/**
 * Extract the first complete, parseable JSON value from a model reply.
 * Throws StructuredJsonParseError (kind + sanitised preview) otherwise.
 */
export function extractStructuredJson(text: string): unknown {
  const fail = () =>
    new StructuredJsonParseError(failureKind(text), text.length, sanitisePreview(text));

  // 1. The whole reply, as-is and repaired.
  let parsed = tryParse(text.trim());
  if (parsed !== undefined) return parsed;
  parsed = tryRepair(text.trim());
  if (parsed !== undefined) return parsed;

  // 2. Fenced blocks, anywhere in the reply (prose before/after is fine).
  for (const block of extractFencedBlocks(text)) {
    parsed = tryParse(block);
    if (parsed !== undefined) return parsed;
    parsed = tryRepair(block);
    if (parsed !== undefined) return parsed;
    // A fenced block may itself contain prose around the JSON.
    for (const candidate of balancedCandidates(block)) {
      if (candidate.truncated) continue;
      parsed = tryParse(candidate.slice);
      if (parsed !== undefined) return parsed;
      parsed = tryRepair(candidate.slice);
      if (parsed !== undefined) return parsed;
    }
  }

  // 3. Balanced values in the raw reply — first complete one wins, so two
  //    separate JSON blocks are never glued together.
  for (const candidate of balancedCandidates(text)) {
    if (candidate.truncated) continue;
    parsed = tryParse(candidate.slice);
    if (parsed !== undefined) return parsed;
    parsed = tryRepair(candidate.slice);
    if (parsed !== undefined) return parsed;
  }

  throw fail();
}
