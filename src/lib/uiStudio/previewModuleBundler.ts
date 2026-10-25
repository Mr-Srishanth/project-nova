/**
 * previewModuleBundler.ts — In-browser module bundler for UI Studio preview.
 *
 * Takes a map of virtual source files (TSX/CSS), transforms JSX,
 * resolves inter-file imports, and produces a single executable bundle
 * suitable for injection into an iframe via a Blob URL or srcdoc.
 *
 * Design decisions:
 *  - Pure string-transform — no WASM, no esbuild dependency.
 *  - JSX is transformed via a lightweight regex-based transpiler
 *    (sufficient for the preview use case; not a production compiler).
 *  - Errors are caught per-module and surfaced as structured diagnostics
 *    so a single broken file doesn't crash the entire preview.
 *
 * Recent fixes preserved:
 *  - CSS files are injected as <style> blocks, not JS modules.
 *  - Import resolution correctly handles relative and bare imports.
 *  - Runtime errors in user code are caught by an error boundary injected
 *    into the preview wrapper.
 */

import { transform } from "sucrase";
import type { SourceFile } from "./studioSourceStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BundleResult {
  /** The complete HTML string for iframe srcdoc */
  html: string;
  /** Structured errors encountered during bundling */
  errors: BundleError[];
  /** Whether the bundle is usable (may have warnings but no fatal errors) */
  ok: boolean;
}

export interface BundleError {
  fileId: string;
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning";
}

// ---------------------------------------------------------------------------
// JSX & TypeScript Transform
// ---------------------------------------------------------------------------

function transformJsx(code: string, fileId: string): { code: string; errors: BundleError[] } {
  const errors: BundleError[] = [];

  try {
    const result = transform(code, {
      transforms: ["typescript", "jsx"],
      jsxRuntime: "classic",
      production: true,
      filePath: fileId,
    });
    return { code: result.code, errors };
  } catch (err) {
    errors.push({
      fileId,
      message: `Compile error: ${err instanceof Error ? err.message : String(err)}`,
      severity: "error",
    });
    return { code, errors };
  }
}

// ---------------------------------------------------------------------------
// Module resolution
// ---------------------------------------------------------------------------

function resolveImport(
  importPath: string,
  fromFileId: string,
  fileMap: Map<string, SourceFile>,
): string | null {
  // Normalise the import path
  let resolved = importPath;

  // Relative imports
  if (resolved.startsWith("./") || resolved.startsWith("../")) {
    const fromDir = fromFileId.includes("/")
      ? fromFileId.substring(0, fromFileId.lastIndexOf("/"))
      : "";
    const segments = (fromDir ? fromDir + "/" + resolved : resolved).split("/");
    const normalised: string[] = [];
    for (const seg of segments) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") {
        normalised.pop();
      } else {
        normalised.push(seg);
      }
    }
    resolved = normalised.join("/");
  }

  // Try exact match, then with extensions
  const extensions = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  return null;
}

// ---------------------------------------------------------------------------
// CSS handling
// ---------------------------------------------------------------------------

function bundleCssFiles(files: Map<string, SourceFile>): string {
  const cssBlocks: string[] = [];
  for (const [, file] of files) {
    if (file.language === "css") {
      cssBlocks.push(`/* --- ${file.id} --- */\n${file.code}`);
    }
  }
  return cssBlocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Main bundler
// ---------------------------------------------------------------------------

/**
 * Bundle all project files into an HTML string for iframe preview.
 */
export function bundleProject(files: Record<string, SourceFile>): BundleResult {
  const errors: BundleError[] = [];
  const fileMap = new Map(Object.entries(files));

  // 1. Collect and bundle CSS
  const css = bundleCssFiles(fileMap);

  // 2. Transform each JS/TSX module
  const modules = new Map<string, string>();

  for (const [fileId, file] of fileMap) {
    if (file.language === "css" || file.language === "json") continue;

    let code = file.code;

    // Transform JSX and TypeScript via sucrase
    const transformed = transformJsx(code, fileId);
    if (transformed.errors.length > 0) {
      errors.push(...transformed.errors);
      const errMsg = JSON.stringify(transformed.errors.map((e) => e.message).join("; "));
      modules.set(fileId, `__errors.push({ fileId: "${fileId}", message: ${errMsg} });`);
      continue;
    }
    code = transformed.code;

    const exportAssignments: string[] = [];

    // Track default export functions: export default function Foo
    code = code.replace(
      /export\s+default\s+function\s*(\w*)/g,
      (_, name: string) => {
        const fnName = name || "__defaultFn";
        exportAssignments.push(`__exports.default = ${fnName};`);
        return `function ${fnName}`;
      },
    );

    // Track default export expressions: export default Foo;
    code = code.replace(
      /export\s+default\s+([^;\n]+);?/g,
      (_, expr: string) => {
        exportAssignments.push(`__exports.default = ${expr.trim()};`);
        return "";
      },
    );

    // Track named exports: export function Foo / export const Foo / export let Foo
    code = code.replace(
      /export\s+(function|const|let|var|class)\s+(\w+)/g,
      (_, decl: string, name: string) => {
        exportAssignments.push(`__exports.${name} = ${name};`);
        return `${decl} ${name}`;
      },
    );

    // Transform imports into module references
    code = code.replace(
      /import\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
      (_, name: string, path: string) => {
        if (path === "react" || path === "React") {
          return `const ${name} = window.React;`;
        }
        if (path === "react-dom" || path === "ReactDOM") {
          return `const ${name} = window.ReactDOM;`;
        }
        const resolved = resolveImport(path, fileId, fileMap);
        if (resolved) {
          return `const ${name} = (__modules["${resolved}"] && __modules["${resolved}"].default) || {};`;
        }
        return `const ${name} = {}; /* unresolved: ${path} */`;
      },
    );

    code = code.replace(
      /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?/g,
      (_, names: string, path: string) => {
        const cleanNames = names.split(",").map((n: string) => n.trim()).filter(Boolean);
        if (path === "react" || path === "React") {
          return cleanNames
            .map((n: string) => {
              const parts = n.split(/\s+as\s+/);
              const source = parts[0]!.trim();
              const alias = (parts[1] ?? source).trim();
              return `const ${alias} = window.React.${source};`;
            })
            .join("\n");
        }
        if (path === "react-dom" || path === "ReactDOM") {
          return cleanNames
            .map((n: string) => {
              const parts = n.split(/\s+as\s+/);
              const source = parts[0]!.trim();
              const alias = (parts[1] ?? source).trim();
              return `const ${alias} = window.ReactDOM.${source};`;
            })
            .join("\n");
        }
        const resolved = resolveImport(path, fileId, fileMap);
        if (resolved) {
          return cleanNames
            .map((n: string) => {
              const parts = n.split(/\s+as\s+/);
              const source = parts[0]!.trim();
              const alias = (parts[1] ?? source).trim();
              return `const ${alias} = __modules["${resolved}"] && __modules["${resolved}"]["${source}"];`;
            })
            .join("\n");
        }
        return `/* unresolved import: { ${names} } from "${path}" */`;
      },
    );

    // Append export assignments at the end of the module
    if (exportAssignments.length > 0) {
      code += "\n" + exportAssignments.join("\n");
    }

    modules.set(fileId, code);
  }

  // 3. Execution order (components before App.tsx)
  const orderedIds = Array.from(modules.keys()).sort((a, b) => {
    if (a === "App.tsx") return 1;
    if (b === "App.tsx") return -1;
    return a.localeCompare(b);
  });

  // 4. Build the runtime
  const moduleRegistrations = orderedIds
    .map((id) => {
      const code = modules.get(id)!;
      return `
// --- Module: ${id} ---
(function() {
  var __exports = { default: null };
  try {
    ${code}
    __modules["${id}"] = __exports;
  } catch (e) {
    __errors.push({ fileId: "${id}", message: e.message || String(e) });
    __modules["${id}"] = { default: null };
  }
})();`;
    })
    .join("\n");

  // 5. Compose HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${css}
  </style>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin><\/script>
</head>
<body>
  <div id="root"></div>
  <script>
    var __modules = {};
    var __errors = [];

    window.onerror = function(msg, src, line, col, err) {
      var el = document.getElementById("root");
      if (el) {
        el.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin:16px;">' +
          '<h3 style="margin:0 0 8px;font-size:16px">Runtime Error</h3>' +
          '<pre style="white-space:pre-wrap;margin:0;font-family:monospace;font-size:13px">' + (msg || 'Unknown error') + '</pre>' +
          '</div>';
      }
      return true;
    };

    try {
      ${moduleRegistrations}

      if (__errors.length > 0) {
        var errHtml = __errors.map(function(e) {
          return '<div style="padding:12px;margin:8px 0;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-family:monospace;font-size:13px;">' +
            '<strong>' + e.fileId + ':</strong> ' + e.message + '</div>';
        }).join('');
        document.getElementById("root").innerHTML =
          '<div style="padding:16px">' +
          '<h3 style="color:#dc2626;margin:0 0 12px">Build Errors</h3>' +
          errHtml + '</div>';
      } else {
        var App = __modules["App.tsx"] && __modules["App.tsx"].default;
        if (App) {
          var root = ReactDOM.createRoot(document.getElementById("root"));
          root.render(React.createElement(App));
        } else {
          document.getElementById("root").innerHTML =
            '<div style="padding:24px;text-align:center;color:#6b7280;font-family:sans-serif">' +
            '<p>No App component found. Create an App.tsx with a default export.</p></div>';
        }
      }
    } catch (e) {
      document.getElementById("root").innerHTML =
        '<div style="padding:24px;font-family:sans-serif;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin:16px;">' +
        '<h3 style="margin:0 0 8px;font-size:16px">Bundle Error</h3>' +
        '<pre style="white-space:pre-wrap;margin:0;font-family:monospace;font-size:13px">' + (e.message || String(e)) + '</pre>' +
        '</div>';
    }
  <\/script>
</body>
</html>`;

  const hasErrors = errors.some((e) => e.severity === "error");

  return { html, errors, ok: !hasErrors };
}
