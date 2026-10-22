export interface PathValidationResult {
  isValid: boolean;
  error?: string;
  normalizedPath?: string;
}

/**
 * Validates that a file plan path is safe, relative, and does not perform traversal or use invalid characters.
 */
export function validateRelativeFilePath(filePath: string): PathValidationResult {
  if (!filePath || typeof filePath !== "string") {
    return { isValid: false, error: "File path must be a non-empty string." };
  }

  const trimmed = filePath.trim();

  // Reject empty
  if (trimmed.length === 0) {
    return { isValid: false, error: "File path cannot be empty or whitespace only." };
  }

  // Reject drive-letter paths (e.g. C:, D:)
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return { isValid: false, error: "Drive letters (e.g. 'C:') are not allowed in relative project paths." };
  }

  // Reject UNC paths (e.g. \\server\share)
  if (trimmed.startsWith("\\\\") || trimmed.startsWith("//")) {
    return { isValid: false, error: "UNC / network paths are not allowed." };
  }

  // Reject root-rooted paths (e.g. /etc, \Windows)
  if (trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    return { isValid: false, error: "Paths must be strictly relative to the project root, not starting with '/' or '\\'." };
  }

  // Normalize backslashes to forward slashes for cross-platform consistency
  const normalized = trimmed.replace(/\\/g, "/");

  // Reject directory traversal segments (e.g. ../ or /../ or ending with /..)
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      return { isValid: false, error: "Directory traversal ('..') is strictly prohibited." };
    }
    if (seg === ".") {
      return { isValid: false, error: "Current directory notation ('.') is not allowed as a path segment." };
    }
    // Reject Windows reserved characters: < > : " | ? *
    if (/[<>:"|?*]/.test(seg)) {
      return { isValid: false, error: `Invalid character found in path segment '${seg}'. Characters < > : " | ? * are prohibited.` };
    }
  }

  // Reject trailing slash (must be a file path, not a directory)
  if (normalized.endsWith("/")) {
    return { isValid: false, error: "Target must be a file path, not a directory." };
  }

  return { isValid: true, normalizedPath: normalized };
}

/**
 * Validates a list of file paths to ensure there are no duplicate files or file-directory collisions.
 */
export function validateFilePlanList(paths: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalizedSet = new Set<string>();
  const directorySet = new Set<string>();

  for (const p of paths) {
    const val = validateRelativeFilePath(p);
    if (!val.isValid) {
      errors.push(`Invalid path "${p}": ${val.error}`);
      continue;
    }

    const norm = val.normalizedPath!;

    // Check duplicate
    if (normalizedSet.has(norm.toLowerCase())) {
      errors.push(`Duplicate path detected: "${norm}".`);
    } else {
      normalizedSet.add(norm.toLowerCase());
    }

    // Check file/directory collision
    const parts = norm.split("/");
    let currentDir = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = currentDir ? `${currentDir}/${parts[i]}` : parts[i];
      directorySet.add(currentDir.toLowerCase());
    }
  }

  // Ensure no file matches an ancestor directory of another file
  for (const f of normalizedSet) {
    if (directorySet.has(f)) {
      errors.push(`File/Directory collision: "${f}" cannot be both a file and a parent directory.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
