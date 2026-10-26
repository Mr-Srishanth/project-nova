/**
 * ProjectNova AI — preview syntax diagnostics + safe preview-only repair.
 *
 * Root-cause context: AI-generated code sometimes ships with a small syntax
 * slip (the classic case is a missing comma between array/object elements,
 * e.g. Zestify's "Unexpected token, expected ',' (30:33)"). Sucrase's
 * preview transform is strict, so one slip fails the whole preview, and
 * the raw Sucrase message shows only "line:col" — no source line — so
 * the AI repair loop guesses blindly and the error just shifts lines.
 *
 * This module fixes the visibility half and adds a narrow, *verified*
 * repair half:
 *
 * 1. formatTranspilationError() keeps the original Sucrase message and
 *    adds the file path plus the actual source lines around the error
 *    (error line +/- 2, error line marked with ">" and a caret), so a
 *    human or the AI assistant can see exactly what is wrong.
 * 2. tryRepairMissingComma() attempts ONLY a missing-comma insertion
 *    for Sucrase "expected ','" errors, and ONLY accepts a candidate
 *    after re-running the Sucrase transform on the repaired source and
 *    seeing it pass. If no candidate passes, it returns null and the
 *    caller must keep the original source and the enriched diagnostic.
 *
 * The repair is preview-compilation-only: callers must never write the
 * repaired source back into the saved project file. The diagnostic that
 * accompanies a repaired preview must say so.
 */
import { transform } from "sucrase";

export interface SucrasePosition {
  line: number;
  column: number;
}

const SUCRaSE_TRANSFORM_OPTIONS = {
  transforms: ["jsx", "typescript", "imports"] as ("jsx" | "typescript" | "imports")[],
  jsxRuntime: "classic" as const,
};

/**
 * Sucrase reports positions as "(line:column)" with 1-based line and
 * column (verified against sucrase 3.x: e.g. a missing comma before a
 * `{` on line 3 indented by 2 spaces reports "(3:3)").
 * Returns null when the message carries no position.
 */
export function parseSucrasePosition(message: string): SucrasePosition | null {
  const match = /\(\s*(\d+)\s*:\s*(\d+)\s*\)/.exec(message);
  if (!match) return null;
  const line = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isFinite(line) || !Number.isFinite(column) || line < 1 || column < 1) return null;
  return { line, column };
}

export interface FormatTranspilationErrorOptions {
  /** When the transformed input differs from the displayed file (e.g. a
   *  hook import line prepended by the caller), the source to show. */
  displaySource?: string;
  /** Line-number shift between the transformed input and displaySource
   *  (e.g. -1 when one line was prepended before transforming). */
  lineOffset?: number;
}

/**
 * Builds the enriched diagnostic for a Sucrase failure. The original
 * message is never dropped: it stays on the first line, followed by the
 * file path and a +/- 2 line snippet with the error line marked.
 * When no position can be parsed, the message + file path are returned
 * without a snippet (still better than the bare message).
 */
export function formatTranspilationError(
  filePath: string,
  source: string,
  error: unknown,
  options: FormatTranspilationErrorOptions = {}
): string {
  const message = error instanceof Error ? error.message : String(error);
  const header = `Transpilation error: ${message}`;
  const position = parseSucrasePosition(message);
  if (!position) {
    return `${header}\nFile: ${filePath}`;
  }
  const displaySource = options.displaySource ?? source;
  const displayLine = position.line + (options.lineOffset ?? 0);
  const lines = displaySource.split("\n");
  if (displayLine < 1 || displayLine > lines.length) {
    return `${header}\nFile: ${filePath} (line ${displayLine}, column ${position.column})`;
  }
  const start = Math.max(1, displayLine - 2);
  const end = Math.min(lines.length, displayLine + 2);
  const snippet: string[] = [];
  for (let n = start; n <= end; n++) {
    const marker = n === displayLine ? ">" : " ";
    snippet.push(`${marker} ${n} | ${lines[n - 1]}`);
    if (n === displayLine) {
      // Column is 1-based, so (column - 1) spaces put the caret under
      // the reported token. Clamp so a wild column never explodes the line.
      const caretSpaces = Math.max(0, Math.min(position.column - 1, lines[n - 1].length));
      snippet.push(`${" ".repeat(2 + String(n).length)} | ${" ".repeat(caretSpaces)}^`);
    }
  }
  return (
    `${header}\n` +
    `File: ${filePath} (line ${displayLine}, column ${position.column})\n` +
    snippet.join("\n")
  );
}

function offsetForPosition(source: string, position: SucrasePosition): number | null {
  const lines = source.split("\n");
  if (position.line < 1 || position.line > lines.length) return null;
  let offset = 0;
  for (let i = 0; i < position.line - 1; i++) {
    offset += lines[i].length + 1; // +1 for the newline
  }
  const lineText = lines[position.line - 1];
  if (position.column - 1 > lineText.length) return null;
  return offset + (position.column - 1);
}

function transformsCleanly(source: string): boolean {
  try {
    transform(source, SUCRaSE_TRANSFORM_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

export interface MissingCommaRepair {
  /** The repaired source (preview compilation only — never save this
   *  over the user's project file). */
  repaired: string;
  line: number;
  column: number;
}

/**
 * Attempts ONLY a missing-comma repair for Sucrase "expected ','" errors.
 *
 * Candidate insertion points, tried in order (deduped):
 *  1. At the end of the previous non-empty line (after its last
 *     non-whitespace character) — the conventional spot, and the one
 *     that produces the cleanest diff when the next element starts on
 *     the following line.
 *  2. Immediately before the reported error token.
 *  3. At the start of the error line (before its indent) — covers cases
 *     where Sucrase reports a column inside the next element (e.g. JSX).
 *
 * A candidate is accepted ONLY if the full Sucrase transform passes on
 * the repaired source. The preceding non-whitespace character must look
 * like the end of an element (identifier, number, string/quote, or a
 * closing `}`, `]`, `)`) — never after `,`, `;`, `(`, `[`, `{`, or `:`.
 * Anything else (including Sucrase "expected ';'" variants of the same
 * underlying slip, and every other error kind) returns null: the caller
 * keeps the original source and shows the enriched diagnostic instead.
 * A guessed repair that still fails the transform is never returned.
 */
export function tryRepairMissingComma(source: string, error: unknown): MissingCommaRepair | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!/expected\s+","/.test(message)) return null;
  const position = parseSucrasePosition(message);
  if (!position) return null;
  const errorOffset = offsetForPosition(source, position);
  if (errorOffset === null) return null;

  const lines = source.split("\n");
  const candidates = new Set<number>();
  // 1. End of the previous non-empty line (cleanest diff).
  for (let n = position.line - 2; n >= 0; n--) {
    const trimmed = lines[n].trimEnd();
    if (trimmed.length > 0) {
      let off = 0;
      for (let i = 0; i < n; i++) off += lines[i].length + 1;
      candidates.add(off + trimmed.length);
      break;
    }
  }
  // 2. Before the reported token.
  candidates.add(errorOffset);
  // 3. Start of the error line (before indent).
  {
    let off = 0;
    for (let i = 0; i < position.line - 1; i++) off += lines[i].length + 1;
    candidates.add(off + (lines[position.line - 1].length - lines[position.line - 1].trimStart().length));
  }

  for (const at of candidates) {
    // Walk back over whitespace to the real token end before the
    // insertion point; a comma only makes sense after an element end.
    let probe = at - 1;
    while (probe >= 0 && /\s/.test(source[probe])) probe--;
    const prevChar = probe >= 0 ? source[probe] : "";
    if (!/[A-Za-z0-9_$"'`}\])]/.test(prevChar)) continue;
    if (source[at] === ",") continue;
    const repaired = source.slice(0, at) + "," + source.slice(at);
    if (transformsCleanly(repaired)) {
      return { repaired, line: position.line, column: position.column };
    }
  }
  return null;
}
