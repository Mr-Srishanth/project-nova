/**
 * sourceEdit.ts — Source editing operations for UI Studio.
 *
 * Thin command layer on top of studioSourceStore that provides
 * higher-level editing operations like insert-at-cursor, wrap-selection,
 * format, and find-replace. The editor UI dispatches through these
 * functions rather than mutating the store directly.
 *
 * Recent fixes preserved:
 *  - Cursor position is tracked per-file so switching tabs preserves caret.
 *  - Multi-line indent/dedent respects mixed selections.
 */

import {
  updateFileCode,
  getFileById,
  undoFileEdit,
} from "./studioSourceStore";

// ---------------------------------------------------------------------------
// Cursor state (per-file)
// ---------------------------------------------------------------------------

interface CursorPosition {
  line: number;
  column: number;
  selectionStart?: number;
  selectionEnd?: number;
}

const cursorPositions = new Map<string, CursorPosition>();

export function getCursorPosition(fileId: string): CursorPosition {
  return cursorPositions.get(fileId) ?? { line: 0, column: 0 };
}

export function setCursorPosition(fileId: string, pos: CursorPosition) {
  cursorPositions.set(fileId, pos);
}

// ---------------------------------------------------------------------------
// Edit operations
// ---------------------------------------------------------------------------

/**
 * Replace the full code of a file. This is the primary edit path from the
 * textarea / code editor.
 */
export function editFullSource(fileId: string, newCode: string): boolean {
  const file = getFileById(fileId);
  if (!file) return false;
  updateFileCode(fileId, newCode);
  return true;
}

/**
 * Insert text at a specific character offset.
 */
export function insertAtOffset(fileId: string, offset: number, text: string): boolean {
  const file = getFileById(fileId);
  if (!file) return false;

  const before = file.code.slice(0, offset);
  const after = file.code.slice(offset);
  updateFileCode(fileId, before + text + after);
  return true;
}

/**
 * Replace a range [start, end) with new text.
 */
export function replaceRange(
  fileId: string,
  start: number,
  end: number,
  replacement: string,
): boolean {
  const file = getFileById(fileId);
  if (!file) return false;

  const before = file.code.slice(0, start);
  const after = file.code.slice(end);
  updateFileCode(fileId, before + replacement + after);
  return true;
}

/**
 * Find and replace all occurrences of `search` with `replacement`.
 * Returns the number of replacements made.
 */
export function findAndReplaceAll(
  fileId: string,
  search: string,
  replacement: string,
  caseSensitive = true,
): number {
  const file = getFileById(fileId);
  if (!file || !search) return 0;

  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegExp(search), flags);
  const matches = file.code.match(regex);
  if (!matches || matches.length === 0) return 0;

  const newCode = file.code.replace(regex, replacement);
  updateFileCode(fileId, newCode);
  return matches.length;
}

/**
 * Indent all lines in the given range by `spaces` spaces.
 * Negative values dedent.
 */
export function indentLines(
  fileId: string,
  startLine: number,
  endLine: number,
  spaces = 2,
): boolean {
  const file = getFileById(fileId);
  if (!file) return false;

  const lines = file.code.split("\n");
  const clampedStart = Math.max(0, startLine);
  const clampedEnd = Math.min(lines.length - 1, endLine);

  for (let i = clampedStart; i <= clampedEnd; i++) {
    const line = lines[i]!;
    if (spaces > 0) {
      lines[i] = " ".repeat(spaces) + line;
    } else {
      const removeCount = Math.min(Math.abs(spaces), line.length - line.trimStart().length);
      lines[i] = line.slice(removeCount);
    }
  }

  updateFileCode(fileId, lines.join("\n"));
  return true;
}

/**
 * Wrap the text at [start, end) with `before` and `after` strings.
 * Useful for wrapping in JSX tags, parentheses, etc.
 */
export function wrapSelection(
  fileId: string,
  start: number,
  end: number,
  before: string,
  after: string,
): boolean {
  const file = getFileById(fileId);
  if (!file) return false;

  const selected = file.code.slice(start, end);
  const newCode = file.code.slice(0, start) + before + selected + after + file.code.slice(end);
  updateFileCode(fileId, newCode);
  return true;
}

/**
 * Undo the last edit. Delegates to the store's undo stack.
 */
export function undo(fileId: string): boolean {
  return undoFileEdit(fileId);
}

/**
 * Count occurrences of a search string in a file.
 */
export function countOccurrences(
  fileId: string,
  search: string,
  caseSensitive = true,
): number {
  const file = getFileById(fileId);
  if (!file || !search) return 0;

  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegExp(search), flags);
  return (file.code.match(regex) ?? []).length;
}

/**
 * Get line/column info for a character offset.
 */
export function offsetToLineCol(
  code: string,
  offset: number,
): { line: number; column: number } {
  let line = 0;
  let col = 0;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

/**
 * Get character offset from line/column.
 */
export function lineColToOffset(code: string, line: number, column: number): number {
  let currentLine = 0;
  let offset = 0;
  while (currentLine < line && offset < code.length) {
    if (code[offset] === "\n") currentLine++;
    offset++;
  }
  return Math.min(offset + column, code.length);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Basic JSX/TSX formatter — normalises indentation.
 * Not a full Prettier replacement but handles common cases.
 */
export function formatSource(fileId: string): boolean {
  const file = getFileById(fileId);
  if (!file) return false;

  // Simple re-indent: count brace/tag depth
  const lines = file.code.split("\n");
  let depth = 0;
  const indentSize = 2;
  const formatted: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      formatted.push("");
      continue;
    }

    // Decrease depth for closing constructs
    if (/^[}\])<\/]/.test(trimmed)) {
      depth = Math.max(0, depth - 1);
    }

    formatted.push(" ".repeat(depth * indentSize) + trimmed);

    // Increase depth for opening constructs
    const opens = (trimmed.match(/[{(\[]/g) ?? []).length;
    const closes = (trimmed.match(/[})\]]/g) ?? []).length;
    depth = Math.max(0, depth + opens - closes);

    // JSX self-closing doesn't change depth
    if (trimmed.endsWith("/>")) {
      // no change
    } else if (/<[a-zA-Z][^/]*>/.test(trimmed) && !trimmed.includes("</")) {
      // Opening JSX tag — already counted by braces if any
    }
  }

  updateFileCode(fileId, formatted.join("\n"));
  return true;
}
