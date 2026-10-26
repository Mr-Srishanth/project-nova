import { describe, it, expect } from "vitest";
import {
  parseSucrasePosition,
  formatTranspilationError,
  tryRepairMissingComma,
} from "./syntaxRepair";

describe("syntaxRepair", () => {
  it("parses Sucrase (line:column) positions (1-based)", () => {
    expect(parseSucrasePosition(`Unexpected token, expected "," (30:33)`)).toEqual({
      line: 30,
      column: 33,
    });
    expect(parseSucrasePosition("Something broke")).toBeNull();
  });

  it("formats an enriched diagnostic with file, line, and the actual source lines", () => {
    const source = [
      `const menu = [`,
      `  { id: 1, name: "Burger" }`,
      `  { id: 2, name: "Pizza" },`,
      `];`,
    ].join("\n");
    const out = formatTranspilationError(
      "src/app/App.tsx",
      source,
      new Error(`Unexpected token, expected "," (3:3)`)
    );
    // Original message is never dropped.
    expect(out).toContain(`Unexpected token, expected "," (3:3)`);
    expect(out).toContain("src/app/App.tsx");
    expect(out).toContain("line 3, column 3");
    // The error line itself is shown, marked, with a caret under it.
    expect(out).toContain(`> 3 |   { id: 2, name: "Pizza" },`);
    expect(out).toContain("^");
    // Context lines around it are shown too.
    expect(out).toContain(`  1 | const menu = [`);
  });

  it("formats without a snippet when no position can be parsed", () => {
    const out = formatTranspilationError("src/app/App.tsx", "const x = 1;", new Error("boom"));
    expect(out).toContain("Transpilation error: boom");
    expect(out).toContain("src/app/App.tsx");
  });

  it("repairs a missing comma between array elements and only then accepts", () => {
    const source = [
      `const menu = [`,
      `  { id: 1, name: "Burger" }`,
      `  { id: 2, name: "Pizza" },`,
      `];`,
      `export const App = () => <div>{menu.length}</div>;`,
    ].join("\n");
    const repair = tryRepairMissingComma(source, new Error(`Unexpected token, expected "," (3:3)`));
    expect(repair).not.toBeNull();
    expect(repair!.line).toBe(3);
    // The repaired source is exactly the original plus one comma.
    expect(repair!.repaired).toContain(`{ id: 1, name: "Burger" },`);
  });

  it("refuses to guess for non-comma errors (e.g. expected ';')", () => {
    const source = `export const App = () => { return <div unclosed tag ;`;
    expect(
      tryRepairMissingComma(source, new Error(`Unexpected token, expected ";" (1:23)`))
    ).toBeNull();
  });

  it("refuses when the comma is already there or the error has no position", () => {
    const source = `const x = [1, 2];`;
    expect(tryRepairMissingComma(source, new Error(`Unexpected token, expected "," (1:1)`))).toBeNull();
    expect(tryRepairMissingComma(source, new Error("expected ',' somewhere"))).toBeNull();
  });
});
