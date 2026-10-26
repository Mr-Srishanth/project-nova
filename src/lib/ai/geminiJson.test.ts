/**
 * Tests for the Gemini structured-JSON extractor.
 *
 * The parser itself lives in server/geminiJson.ts (imported here by
 * relative path) because server/gateway.ts is its only production caller;
 * this file only exists so the extractor runs under the repo's normal
 * Vitest suite (vitest.config.ts includes src/** only).
 */
import { describe, expect, it } from "vitest";
import {
  extractStructuredJson,
  StructuredJsonParseError,
} from "../../../server/geminiJson";

describe("extractStructuredJson", () => {
  it("parses a plain JSON object", () => {
    expect(extractStructuredJson('{"filePath":"a.tsx","content":"hi"}')).toEqual({
      filePath: "a.tsx",
      content: "hi",
    });
  });

  it("parses a fenced block preceded and followed by prose", () => {
    const reply = [
      "Here is the file you asked for:",
      "```json",
      '{"filePath":"src/app/router.tsx","content":"export const x = 1;"}',
      "```",
      "Let me know if you need anything else.",
    ].join("\n");
    expect(extractStructuredJson(reply)).toEqual({
      filePath: "src/app/router.tsx",
      content: "export const x = 1;",
    });
  });

  it("parses an unlabelled fence anywhere in the text", () => {
    expect(
      extractStructuredJson('Sure thing:\n```\n{"a":1}\n```\nDone.'),
    ).toEqual({ a: 1 });
  });

  it("parses a top-level array", () => {
    expect(extractStructuredJson('Here it is:\n[{"id":1},{"id":2}]')).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("does not glue two separate JSON blocks together", () => {
    const reply = '{"first":true} some prose {"second":true}';
    expect(extractStructuredJson(reply)).toEqual({ first: true });
  });

  it("does not end a value early on braces inside a code string", () => {
    const reply = JSON.stringify({
      filePath: "src/app/App.tsx",
      content: "const x = { a: 1 }; function f() { return {}; }",
    });
    expect(extractStructuredJson(`prefix ${reply} suffix`)).toEqual({
      filePath: "src/app/App.tsx",
      content: "const x = { a: 1 }; function f() { return {}; }",
    });
  });

  it("tolerates trailing commas", () => {
    expect(extractStructuredJson('{"a":1,"b":[1,2,],}')).toEqual({
      a: 1,
      b: [1, 2],
    });
  });

  it("tolerates a raw newline inside a string value", () => {
    // A model emitting code as a string sometimes leaves a literal
    // newline unescaped; the extractor escapes it instead of failing.
    const reply = '{"content":"line one\nline two"}';
    expect(extractStructuredJson(reply)).toEqual({
      content: "line one\nline two",
    });
  });

  it("reports truncation (not a generic failure) for a cut-off document", () => {
    const truncated = '{"filePath":"src/app/router.tsx","content":"export const rou';
    let caught: unknown;
    try {
      extractStructuredJson(truncated);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StructuredJsonParseError);
    expect((caught as StructuredJsonParseError).kind).toBe("truncated");
    expect((caught as StructuredJsonParseError).preview).toContain("router.tsx");
  });

  it("reports invalid for a complete but malformed document", () => {
    let caught: unknown;
    try {
      extractStructuredJson('{"a": }');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StructuredJsonParseError);
    expect((caught as StructuredJsonParseError).kind).toBe("invalid");
  });

  it("reports empty for a blank reply", () => {
    let caught: unknown;
    try {
      extractStructuredJson("   \n");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StructuredJsonParseError);
    expect((caught as StructuredJsonParseError).kind).toBe("empty");
  });
});
