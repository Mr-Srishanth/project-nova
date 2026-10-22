import { describe, it, expect } from "vitest";
import { validateRelativeFilePath, validateFilePlanList } from "./pathValidator";

describe("Build Studio - Path Validation & Security Gates", () => {
  it("should accept valid relative paths", () => {
    expect(validateRelativeFilePath("src/index.ts").isValid).toBe(true);
    expect(validateRelativeFilePath("src/components/ui/Button.tsx").isValid).toBe(true);
    expect(validateRelativeFilePath("package.json").isValid).toBe(true);
    expect(validateRelativeFilePath("docs/specs/architecture.md").isValid).toBe(true);
  });

  it("should normalize backslashes to forward slashes", () => {
    const res = validateRelativeFilePath("src\\lib\\utils.ts");
    expect(res.isValid).toBe(true);
    expect(res.normalizedPath).toBe("src/lib/utils.ts");
  });

  it("should reject drive-letter paths (Windows security check)", () => {
    const res1 = validateRelativeFilePath("C:\\Windows\\System32\\cmd.exe");
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("Drive letters");

    const res2 = validateRelativeFilePath("d:/project/index.ts");
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("Drive letters");
  });

  it("should reject absolute paths and root slashes", () => {
    const res1 = validateRelativeFilePath("/etc/passwd");
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("relative");

    const res2 = validateRelativeFilePath("\\Windows\\Temp\\file.txt");
    expect(res2.isValid).toBe(false);
  });

  it("should reject UNC / network paths", () => {
    const res = validateRelativeFilePath("\\\\192.168.1.1\\share\\test.ts");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("UNC");
  });

  it("should strictly reject directory traversal ('..')", () => {
    const res1 = validateRelativeFilePath("../secret.env");
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("Directory traversal");

    const res2 = validateRelativeFilePath("src/../../AppData/config.json");
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("Directory traversal");
  });

  it("should reject Windows illegal characters (< > : \" | ? *)", () => {
    const res = validateRelativeFilePath("src/file*name?.ts");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Invalid character");
  });

  it("should reject trailing slashes (directories are not files)", () => {
    const res = validateRelativeFilePath("src/components/");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("directory");
  });

  it("should detect duplicate file paths in a file plan", () => {
    const list = ["src/index.ts", "package.json", "src/index.ts"];
    const check = validateFilePlanList(list);
    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain("Duplicate path detected");
  });

  it("should detect file and directory collisions", () => {
    // Cannot have both a file 'src/core' and a file 'src/core/types.ts'
    const list = ["src/core", "src/core/types.ts"];
    const check = validateFilePlanList(list);
    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain("File/Directory collision");
  });
});
