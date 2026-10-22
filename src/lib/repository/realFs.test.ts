import { describe, it, expect } from "vitest";
import { scanRealRepository, inspectRealFile, assertSafePath } from "../../../server/realFsService";
import path from "node:path";

describe("Real Repository Filesystem Engine", () => {
  const root = process.cwd();

  it("scans real repository and discovers root files and subdirectories", () => {
    const scan = scanRealRepository(root, { includeIgnored: false, includeHidden: true });
    expect(scan.totalFilesCount).toBeGreaterThan(10);
    expect(scan.totalDirectoriesCount).toBeGreaterThan(5);
    expect(scan.rootPath).toBe(path.resolve(root));

    // Verify vital files are discovered
    const filePaths = scan.files.map((f) => f.path.replace(/\\/g, "/"));
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("vite.config.ts");
    expect(filePaths).toContain("src/main.tsx");
  });

  it("redacts sensitive environment variable secrets safely", () => {
    const result = inspectRealFile(root, ".env");
    expect(result.isSecretOrRedacted).toBe(true);
    // Must NOT contain unredacted raw secret keys
    expect(result.content).toContain("[REDACTED_SECRET_VALUE]");
    expect(result.content).not.toContain("AQ.Ab8RN6I4F2VkyuUM");
  });

  it("prevents directory traversal attacks outside authorized repository root", () => {
    expect(() => {
      assertSafePath(root, "../../Windows/System32/cmd.exe");
    }).toThrow(/path traversal/i);

    expect(() => {
      assertSafePath(root, "../secret.txt");
    }).toThrow(/path traversal/i);
  });

  it("builds an end-to-end architecture topology with presentation, feature, and service layers", () => {
    const scan = scanRealRepository(root);
    expect(scan.architectureOverview.layers.length).toBeGreaterThanOrEqual(4);
    expect(scan.architectureOverview.nodes.length).toBeGreaterThanOrEqual(8);

    const nodeIds = scan.architectureOverview.nodes.map((n) => n.id);
    expect(nodeIds).toContain("entry_client");
    expect(nodeIds).toContain("server_gateway");
  });
});
