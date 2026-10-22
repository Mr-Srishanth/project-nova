import type { FileExclusionRule, DetectedLanguage } from "@/types/repository";

export const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB per file
export const MAX_FILES_PER_REPOSITORY = 500;
export const MAX_DIRECTORY_DEPTH = 10;

/**
 * Explicit exclusion rules for repository files.
 * Protects against dependency inflation, cache clutter, sensitive private keys, and credential leakage.
 */
export const EXCLUSION_RULES: FileExclusionRule[] = [
  {
    pattern: /(^|\/)(node_modules|bower_components)(\/|$)/i,
    reason: "Third-party dependency packages excluded from source analysis.",
  },
  {
    pattern: /(^|\/)\.git(\/|$)/i,
    reason: "Internal version control directory excluded.",
  },
  {
    pattern: /(^|\/)(dist|build|out|\.next|\.nuxt|\.turbo)(\/|$)/i,
    reason: "Compiled production build artifacts excluded.",
  },
  {
    pattern: /(^|\/)(coverage|\.nyc_output)(\/|$)/i,
    reason: "Test coverage reports and intermediate outputs excluded.",
  },
  {
    pattern: /(^|\/)\.cache(\/|$)/i,
    reason: "Build cache directory excluded.",
  },
  {
    pattern: /(^|\/)(venv|\.venv|env|__pycache__)(\/|$)/i,
    reason: "Virtual environments and Python bytecode excluded.",
  },
  {
    pattern: /(^|\/)(\.env(\..+)?|id_rsa|id_ed25519|.*\.key|.*\.pem|.*\.pfx|.*\.pkcs12)$/i,
    reason: "Potential secret or private credential file excluded for security.",
  },
  {
    pattern: /\.(exe|dll|so|dylib|bin|zip|tar|gz|7z|rar|iso|dmg)$/i,
    reason: "Compiled binary or compressed archive excluded.",
  },
  {
    pattern: /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|mp4|webm|mp3|wav)$/i,
    reason: "Static media / binary asset excluded from AST code parsing.",
  },
  {
    pattern: /\.(lock|lockb)$/i,
    reason: "Package manager lockfiles excluded from semantic symbol indexing.",
  },
];

/**
 * Checks if a relative path should be excluded from analysis.
 */
export function checkFileExclusion(relativePath: string): { isExcluded: boolean; reason?: string } {
  const normalized = relativePath.replace(/\\/g, "/");

  // Check directory depth
  const depth = normalized.split("/").length - 1;
  if (depth > MAX_DIRECTORY_DEPTH) {
    return {
      isExcluded: true,
      reason: `File exceeds maximum allowed directory nesting depth of ${MAX_DIRECTORY_DEPTH}.`,
    };
  }

  for (const rule of EXCLUSION_RULES) {
    if (rule.pattern.test(normalized)) {
      return { isExcluded: true, reason: rule.reason };
    }
  }

  return { isExcluded: false };
}

/**
 * Detects programming language or file type from extension.
 */
export function detectLanguageFromPath(filePath: string): DetectedLanguage {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".sql")) return "sql";

  return "unknown";
}
