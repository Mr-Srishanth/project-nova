import type {
  ExtractedCodeStructure,
  ExtractedModuleImport,
  ExtractedSymbol,
  DetectedLanguage,
} from "@/types/repository";

/**
 * Deterministic Structure & AST Token Parser
 * Safely parses TypeScript, JavaScript, and JSON manifests without executing code or running external shell scripts.
 */

export function parseSourceStructure(
  filePath: string,
  content: string,
  language: DetectedLanguage
): ExtractedCodeStructure {
  const imports: ExtractedModuleImport[] = [];
  const exports: string[] = [];
  const symbols: ExtractedSymbol[] = [];
  const apiRouteCandidates: string[] = [];

  // Check candidate entry points (e.g. index.ts, main.tsx, app.ts, server.ts)
  const isEntryPointCandidate =
    /(^|\/)(index|main|app|server|entry|root)\.(tsx?|jsx?|mjs)$/i.test(filePath);

  if (language === "json") {
    return {
      imports: [],
      exports: [],
      symbols: [],
      isEntryPointCandidate: false,
      apiRouteCandidates: [],
      analysisType: "parser_verified",
    };
  }

  if (language !== "typescript" && language !== "javascript") {
    return {
      imports: [],
      exports: [],
      symbols: [],
      isEntryPointCandidate,
      apiRouteCandidates: [],
      analysisType: "heuristic",
    };
  }

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
      continue;
    }

    // 1. Module Imports
    // Pattern: import ... from "..." or import "..."
    const importMatch = line.match(/^import\s+(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]/);
    if (importMatch) {
      const clause = importMatch[1] || "";
      const source = importMatch[2];
      const isRelative = source.startsWith(".") || source.startsWith("/");

      const importedSymbols: string[] = [];
      if (clause) {
        // extract named imports inside { a, b as c }
        const namedMatch = clause.match(/\{([^}]+)\}/);
        if (namedMatch) {
          namedMatch[1]
            .split(",")
            .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
            .filter(Boolean)
            .forEach((sym) => importedSymbols.push(sym));
        } else {
          // Default or namespace import
          const defaultImport = clause.replace(/\* as \w+/, "").trim();
          if (defaultImport) importedSymbols.push(defaultImport);
        }
      }

      imports.push({
        source,
        importedSymbols,
        isRelative,
      });
    }

    // Dynamic import pattern: import("...")
    const dynImportMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynImportMatch && !line.startsWith("import ")) {
      const source = dynImportMatch[1];
      imports.push({
        source,
        importedSymbols: ["*dynamic*"],
        isRelative: source.startsWith("."),
      });
    }

    // 2. Named Exports & Default Exports
    if (line.startsWith("export default ")) {
      exports.push("default");
    } else if (line.startsWith("export ")) {
      // export const foo = ..., export function bar(), export class Baz, export interface Qux, export type T
      const exportDefMatch = line.match(
        /^export\s+(?:async\s+)?(function|class|interface|type|const|let|var)\s+([a-zA-Z0-9_$]+)/
      );
      if (exportDefMatch) {
        const rawKind = exportDefMatch[1];
        const name = exportDefMatch[2];
        const kind: ExtractedSymbol["kind"] =
          rawKind === "const" || rawKind === "let" || rawKind === "var"
            ? "variable"
            : (rawKind as ExtractedSymbol["kind"]);

        exports.push(name);
        symbols.push({
          name,
          kind,
          line: i + 1,
          isExported: true,
        });
      }

      // export { a, b, c }
      const exportClauseMatch = line.match(/^export\s+\{([^}]+)\}/);
      if (exportClauseMatch) {
        exportClauseMatch[1]
          .split(",")
          .map((s) => s.trim().split(/\s+as\s+/)[1] || s.trim().split(/\s+as\s+/)[0])
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((exp) => exports.push(exp));
      }
    } else {
      // 3. Internal Non-Exported Symbols
      const defMatch = line.match(
        /^(?:async\s+)?(function|class|interface|type)\s+([a-zA-Z0-9_$]+)/
      );
      if (defMatch) {
        symbols.push({
          name: defMatch[2],
          kind: defMatch[1] as ExtractedSymbol["kind"],
          line: i + 1,
          isExported: false,
        });
      }
    }

    // 4. API Route Detection Candidate
    // E.g. app.get("/api/...", router.post("/api/..."), or fastify route patterns
    const routeMatch = line.match(
      /(?:\b(?:app|router|server)\.(get|post|put|delete|patch)|\broute\(?)\s*\(\s*['"](\/[a-zA-Z0-9_\-\/:]+)['"]/i
    );
    if (routeMatch) {
      const method = (routeMatch[1] || "GET").toUpperCase();
      const path = routeMatch[2];
      apiRouteCandidates.push(`${method} ${path}`);
    }
  }

  return {
    imports,
    exports,
    symbols,
    isEntryPointCandidate,
    apiRouteCandidates,
    analysisType: "parser_verified",
  };
}

/**
 * Resolves a relative import specifier to a canonical relative path within repository files.
 */
export function resolveRelativeImport(
  importerPath: string,
  importSpecifier: string,
  availablePaths: Set<string>
): string | undefined {
  if (!importSpecifier.startsWith(".")) {
    return undefined;
  }

  // Get directory of importer
  const importerDirParts = importerPath.replace(/\\/g, "/").split("/");
  importerDirParts.pop(); // remove filename

  const specifierParts = importSpecifier.split("/");

  const resolvedParts = [...importerDirParts];
  for (const part of specifierParts) {
    if (part === ".") continue;
    if (part === "..") {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }

  const basePath = resolvedParts.join("/");

  // Try candidate extensions: exact, .ts, .tsx, .js, .jsx, /index.ts, /index.tsx
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
    `${basePath}/index.js`,
  ];

  for (const cand of candidates) {
    if (availablePaths.has(cand)) {
      return cand;
    }
  }

  return undefined;
}
