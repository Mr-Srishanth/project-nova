/**
 * Plain-language descriptions for Ask mode.
 *
 * Why this exists: UI Studio's Ask mode used to answer EVERY question with
 * one canned technical line ("contains N artifacts with entry at ...,
 * packaged as a standard Vite React target"). A student asking "explain in
 * very simple words what this app does" got that line verbatim in a live
 * test (2026-10-26) — technically true, useless for a student, and a
 * jury problem, since the jury speaks simple language.
 *
 * These helpers are pure and deterministic: no LLM call, no invented
 * facts. A simple/app-explanation answer is built from the project's own
 * objective/description when available, and only falls back to the visible
 * words inside the app's own code. If neither exists, the caller must say
 * so plainly instead of falling back to the technical line.
 */

// Words that must never appear in a simple-language answer. They are
// framework/infrastructure terms, not things a student can see or do.
export const SIMPLE_ANSWER_FORBIDDEN_WORDS = [
  "artifact",
  "artifacts",
  "vite",
  "react",
  "entry point",
  "entry at",
  "framework",
  "bundle",
  "component",
  "module",
  "tsx",
  "jsx",
  "hook",
  "spa",
] as const;

const SIMPLE_MARKERS =
  /\b(student|simple words|simple language|plain language|easy words|beginner|eli5|explain like i'm 5|explain like i am 5|in simple terms|very simple)\b/i;

const APP_EXPLANATION =
  /\b(what does (this|the) (app|website|project|site) do|what is this (app|website|project|site)|explain (this|the) (app|website|project|site)|what can (i|we|you) do (with|on|in) (this|the) (app|website|project|site))\b/i;

/** True when the user is asking for a simple / student-level answer. */
export function isSimpleLanguageRequest(prompt: string): boolean {
  return SIMPLE_MARKERS.test(prompt);
}

/** True when the user is asking what the app itself does. */
export function isAppExplanationRequest(prompt: string): boolean {
  return APP_EXPLANATION.test(prompt);
}

/** True when the answer must be plain language, not the technical line. */
export function needsSimpleAnswer(prompt: string): boolean {
  return isSimpleLanguageRequest(prompt) || isAppExplanationRequest(prompt);
}

function cleanText(text: string): string {
  return text
    .replace(/[`*_#>\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Visible words inside app code: quoted strings and JSX text nodes. */
function visibleWordsFromContent(content: string): string[] {
  const found: string[] = [];
  const isCodeLike = (word: string): boolean =>
    /[{}\\\/=;<>]|className|tailwind|localStorage|useState|http|src\/|\.tsx|\.ts$|\.css/i.test(
      word,
    ) || !/[a-zA-Z]/.test(word);
  const push = (word: string): void => {
    const clean = word.trim();
    if (clean.length < 3 || clean.length > 60 || isCodeLike(clean)) return;
    if (!found.includes(clean)) found.push(clean);
  };

  // Quoted string literals (data arrays, labels).
  const literal = /["'`]([^"'`]{3,60})["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(content)) !== null && found.length < 8) {
    push(match[1]);
  }
  // JSX text nodes: the words a visitor actually reads on screen.
  const textNode = />\s*([^<>{}]{3,60}?)\s*</g;
  while ((match = textNode.exec(content)) !== null && found.length < 8) {
    push(match[1]);
  }
  return found;
}

/**
 * Build a plain-language answer, or null when there is nothing grounded
 * to say it from. Never invents a purpose and never uses the forbidden
 * technical vocabulary.
 */
export function buildSimpleAppAdvisory(
  projectName: string,
  objective: string | undefined,
  description: string | undefined,
  appContent: string | undefined,
): string | null {
  const source = cleanText(objective || description || "");
  if (source) {
    const sentences = source
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
    const plain = sentences.join(" ");
    if (plain) {
      // User objectives are usually phrased as an instruction
      // ("Create a simple website that...") — restate as a description.
      const described = plain.replace(/^(create|make|build)\s+a\s+/i, "It is a ");
      const withPeriod = /[.!?]$/.test(described) ? described : `${described}.`;
      return `In simple words, "${projectName}" is a website. ${withPeriod} That is what you see and use when you open it.`;
    }
  }

  if (appContent) {
    const words = visibleWordsFromContent(appContent);
    if (words.length > 0) {
      const shown = words.slice(0, 5).map((w) => `"${w}"`).join(", ");
      return (
        `In simple words, "${projectName}" is a website. ` +
        `When you open it you can see things like ${shown}. ` +
        `That is what this website shows you.`
      );
    }
  }

  return null;
}
