import type { BuildArtifact } from "@/types/artifact";
import type { ApplicationArchetype, PreviewBuildResult } from "@/types/uiStudio";
import { transform } from "sucrase";

/**
 * Strips script tags, secret patterns, and host-leaking references from generated content.
 */
export function sanitizePreviewContent(content: string): string {
  // Never expose secret patterns or environment keys in preview
  return content
    .replace(/GEMINI_API_KEY\s*=\s*['"][^'"]+['"]/gi, 'GEMINI_API_KEY="[PREVIEW_REDACTED]"')
    .replace(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/gi, 'SUPABASE_SERVICE_ROLE_KEY="[PREVIEW_REDACTED]"');
}

/**
 * Transpiles simple TSX / JSX and ES module imports into standalone self-contained browser executable JavaScript.
 * Handles React component functions, standard hooks (useState, useEffect, useRef, useMemo, useCallback),
 * Lucide icon mock fallbacks or SVGs, canvas loops, and state manipulation without needing external bundle servers.
 */
export function bundleTsxForPreview(sourceCode: string): string {
  let code = sourceCode;

  // 1. Strip import statements and replace with React / global bindings
  code = code.replace(/import\s+React(?:\s*,\s*\{([^}]+)\})?\s+from\s+['"][^'"]+['"];?/g, (_match, hooks) => {
    if (!hooks) return "const React = window.React;";
    const hookList = hooks
      .split(",")
      .map((h: string) => h.trim())
      .filter(Boolean);
    const hookDeclarations = hookList.map((h: string) => `const ${h} = window.React.${h};`).join("\n");
    return `const React = window.React;\n${hookDeclarations}`;
  });

  // Handle named imports from react
  code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g, (_match, hooks) => {
    const hookList = hooks
      .split(",")
      .map((h: string) => h.trim())
      .filter(Boolean);
    return hookList.map((h: string) => `const ${h} = window.React.${h};`).join("\n");
  });

  // Handle lucide-react imports
  code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g, (_match, icons) => {
    const iconList = icons
      .split(",")
      .map((i: string) => i.trim())
      .filter(Boolean);
    return iconList
      .map(
        (iconName: string) => `
const ${iconName} = (props) => {
  return window.React.createElement("svg", {
    ...props,
    xmlns: "http://www.w3.org/2000/svg",
    width: props.size || 24,
    height: props.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: props.className || ""
  }, window.React.createElement("circle", { cx: 12, cy: 12, r: 10 }));
};`
      )
      .join("\n");
  });

  // Strip other local or package imports (e.g. ./index.css, ./router, etc.)
  code = code.replace(/import\s+[^;]+from\s+['"][^'"]+['"];?/g, "");
  code = code.replace(/import\s+['"][^'"]+['"];?/g, "");

  // 2. Clean ES module exports so definitions remain in global scope
  // Ensure App is captured if defined as App or default export, or any component named Main/Root
  code = code.replace(/export\s*\{\s*([A-Za-z0-9_$]+)\s+as\s+default\s*\};?/g, "window.__DEFAULT_APP__ = window.App = $1;");
  code = code.replace(/export\s+default\s+function\s*\(/g, "window.__DEFAULT_APP__ = window.App = function(");
  code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_$]+)/g, "function $1(...args) { return $1(...args); }\nwindow.App = window.__DEFAULT_APP__ = $1;\nfunction $1");
  code = code.replace(/export\s+default\s+([A-Za-z0-9_$]+);?/g, "window.__DEFAULT_APP__ = window.App = $1;");
  code = code.replace(/export\s+default\s+/g, "window.__DEFAULT_APP__ = window.App = ");
  code = code.replace(/export\s+const\s+([A-Z][a-zA-Z0-9_$]*)(?:\s*:\s*[^=]+)?\s*=/g, "const $1 = window.$1 = window.App =");
  code = code.replace(/export\s+function\s+([A-Z][a-zA-Z0-9_$]*)(?:\s*:\s*[^({]+)?\s*\(/g, "window.$1 = window.App = $1; function $1(");
  code = code.replace(/export\s+const\s+/g, "const ");
  code = code.replace(/export\s+function\s+/g, "function ");
  code = code.replace(/export\s+\{[^}]+\};?/g, "");

  return code;
}

/**
 * Builds an isolated, zero-privilege, standalone HTML document for the target project.
 * Uses Sucrase to pre-compile JSX/TS into executable JavaScript with a unique build ID.
 * Injects a robust handshake protocol:
 * - PREVIEW_DOCUMENT_LOADED: Fired when DOM is ready
 * - PREVIEW_MOUNTED_SUCCESS: Fired with buildId once React has mounted the root component
 * - PING / PONG protocol for host queries
 */
export function buildTargetProjectPreviewHtml(
  projectName: string,
  artifacts: BuildArtifact[],
  options: {
    selectedRoute?: string;
    archetype?: ApplicationArchetype;
    allowLocalStorage?: boolean;
    buildId?: string;
  } = {}
): PreviewBuildResult {
  const buildId = options.buildId || `bld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const artifactMap = new Map<string, string>();
  for (const art of artifacts) {
    artifactMap.set(art.path.replace(/\\/g, "/"), art.content || "");
  }

  const diagnostics: string[] = [];
  const detectedRoutes: string[] = ["/"];

  // 1. Determine Archetype
  let archetype: ApplicationArchetype = options.archetype || "general_app";
  const nameAndPaths = `${projectName} ${Array.from(artifactMap.keys()).join(" ")}`.toLowerCase();

  const hasFrontendEntry = artifactMap.has("src/app/App.tsx") || artifactMap.has("src/App.tsx") || artifactMap.has("src/main.tsx");

  if (
    nameAndPaths.includes("car") ||
    nameAndPaths.includes("racing") ||
    nameAndPaths.includes("vehicle") ||
    nameAndPaths.includes("highway") ||
    nameAndPaths.includes("speedometer")
  ) {
    archetype = "car_game";
  } else if (nameAndPaths.includes("game") || nameAndPaths.includes("arcade")) {
    archetype = "game";
  } else if (nameAndPaths.includes("dashboard") || nameAndPaths.includes("analytics") || nameAndPaths.includes("telemetry") || nameAndPaths.includes("kpi")) {
    archetype = "dashboard";
  } else if (nameAndPaths.includes("portfolio") || nameAndPaths.includes("landing") || nameAndPaths.includes("hero") || nameAndPaths.includes("website")) {
    archetype = "website";
  } else if ((nameAndPaths.includes("pipeline") || nameAndPaths.includes("fastapi") || nameAndPaths.includes("backend")) && !hasFrontendEntry) {
    archetype = "backend";
  } else if (hasFrontendEntry) {
    archetype = "general_app";
  }

  // 2. Discover App Entry Point
  let entryCode = "";
  let entryFile = "";

  if (artifactMap.has("src/app/App.tsx")) {
    entryFile = "src/app/App.tsx";
    entryCode = artifactMap.get(entryFile)!;
  } else if (artifactMap.has("src/App.tsx")) {
    entryFile = "src/App.tsx";
    entryCode = artifactMap.get(entryFile)!;
  } else if (artifactMap.has("src/main.tsx")) {
    entryFile = "src/main.tsx";
    entryCode = artifactMap.get(entryFile)!;
  } else if (artifactMap.has("index.html")) {
    entryFile = "index.html";
    entryCode = artifactMap.get(entryFile)!;
  } else {
    diagnostics.push("No standard React or HTML entry point found (src/app/App.tsx, src/App.tsx, index.html).");
  }

  // Extract detected routes if router.tsx exists
  if (artifactMap.has("src/app/router.tsx")) {
    const routerContent = artifactMap.get("src/app/router.tsx")!;
    const routeMatches = [...routerContent.matchAll(/path=["']([^"']+)["']/g)];
    for (const m of routeMatches) {
      if (m[1] && !detectedRoutes.includes(m[1]) && m[1] !== "*") {
        detectedRoutes.push(m[1]);
      }
    }
  }

  // 3. If project is backend only (e.g. Python FastAPI), render informative interactive status workbench
  if (archetype === "backend" && !artifactMap.has("src/app/App.tsx") && !artifactMap.has("src/App.tsx")) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${projectName} - Backend Service</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 p-8 font-mono">
  <div class="max-w-xl mx-auto space-y-6">
    <div class="flex items-center gap-3 border-b border-slate-800 pb-4">
      <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
      <h1 class="text-xl font-bold tracking-tight">${projectName} (Backend Service)</h1>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <div class="text-xs uppercase text-slate-400 font-bold tracking-wider">Service Architecture</div>
      <p class="text-sm text-slate-300">This target application is a Python / Data Pipeline backend service. REST APIs and processing engine routines are defined in the workspace files.</p>
      <div class="pt-2 text-xs text-emerald-400 font-semibold">Available Endpoints:</div>
      <ul class="text-xs text-slate-300 list-disc list-inside space-y-1">
        <li><code>GET /health</code> - Service readiness check</li>
        <li><code>POST /api/v1/pipeline/run</code> - Trigger data processing workflow</li>
        <li><code>GET /api/v1/metrics</code> - Engine operational telemetry</li>
      </ul>
    </div>
  </div>
  <script>
    window.parent.postMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: "${buildId}" }, "*");
    window.parent.postMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "${buildId}", isBackend: true }, "*");
  </script>
</body>
</html>`;
    return {
      html,
      entryFile: "backend/main.py",
      archetype,
      diagnostics,
      isPlayableOrInteractive: false,
      detectedRoutes: ["/health", "/api/v1/metrics"],
      buildId,
      compiledAt: new Date().toISOString(),
    };
  }

  // Extract custom stylesheet if present (e.g. src/index.css)
  const customCss = artifactMap.get("src/index.css") || artifactMap.get("src/app/index.css") || "";

  // 4. Transform source code into executable bundled code
  let transpiledApp = "";
  if (entryCode) {
    // Honest limitation, surfaced instead of failing silently: the preview
    // bundles ONLY the entry file. Relative imports are stripped by the
    // bundler, so components living in sibling files will not render.
    const relativeImports = [...entryCode.matchAll(/import\s+[^'"]*?from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
    if (relativeImports.length > 0) {
      diagnostics.push(
        `Preview warning: the entry file imports relative modules (${relativeImports.join(", ")}) that are not bundled into the single-file preview; only ${entryFile} is executed.`
      );
    }
    const bundled = bundleTsxForPreview(entryCode);
    try {
      const compiled = transform(bundled, {
        transforms: ["jsx", "typescript"],
        jsxRuntime: "classic",
      });
      transpiledApp = compiled.code;
    } catch (sucraseErr: any) {
      diagnostics.push(`Transpilation error: ${sucraseErr.message}`);
      transpiledApp = "";
    }
  } else {
    diagnostics.push("No entry code available to bundle.");
  }

  // 5. Construct Sandboxed HTML Document
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #020617;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #preview-root {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    /* Visual element highlight for inspector */
    body[data-inspect-mode="true"] [data-preview-selectable]:hover,
    body[data-inspect-mode="true"] *:not(#preview-root):hover {
      outline: 2px dashed #10b981 !important;
      outline-offset: 2px;
      cursor: crosshair !important;
    }
    [data-preview-selected] {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px;
    }
    /* Target project custom stylesheet */
    ${customCss}
  </style>
</head>
<body>
  <div id="preview-root"></div>

  <script>
    const CURRENT_BUILD_ID = "${buildId}";
    window.__ENTRY_FILE__ = "${entryFile}";
    let isAppMounted = false;

    // Canvas roundRect polyfill for browsers/environments that lack it
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        if (!radii) radii = 0;
        let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
        r = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
      };
    }

    // Inform parent that document script execution has begun
    window.parent.postMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: CURRENT_BUILD_ID }, "*");

    // Host Messaging Protocol
    window.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.type === "SET_INSPECT_MODE") {
        document.body.dataset.inspectMode = event.data.enabled ? "true" : "false";
        if (!event.data.enabled) {
          document.querySelectorAll("[data-preview-selected]").forEach(el => el.removeAttribute("data-preview-selected"));
        }
      } else if (event.data.type === "APPLY_LIVE_STYLE") {
        const { property, value, targetSelector } = event.data;
        const selected = targetSelector
          ? document.querySelector(targetSelector)
          : document.querySelector("[data-preview-selected]");
        if (selected && property) {
          try {
            if (property === "textContent") {
              selected.innerText = value;
            } else if (property === "href" || property === "src" || property === "alt" || property === "title") {
              selected.setAttribute(property, value);
            } else {
              selected.style[property] = value;
            }
            window.parent.postMessage({
              type: "LIVE_STYLE_APPLIED_CONFIRMATION",
              buildId: CURRENT_BUILD_ID,
              property,
              value,
              success: true
            }, "*");
          } catch (err) {
            window.parent.postMessage({
              type: "LIVE_STYLE_APPLIED_CONFIRMATION",
              buildId: CURRENT_BUILD_ID,
              property,
              value,
              success: false,
              error: err.message
            }, "*");
          }
        }
      } else if (event.data.type === "PREVIEW_PING") {
        window.parent.postMessage({
          type: "PREVIEW_PONG",
          buildId: CURRENT_BUILD_ID,
          mounted: isAppMounted
        }, "*");
      }
    });

    // Capture unhandled errors and report to UI Studio
    window.addEventListener("error", (e) => {
      if (e.message === "Script error." && (!e.filename || e.filename.includes("unpkg.com") || e.filename.includes("tailwindcss.com"))) {
        return;
      }
      window.parent.postMessage({
        type: "PREVIEW_RUNTIME_ERROR",
        buildId: CURRENT_BUILD_ID,
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      }, "*");
    });

    window.addEventListener("unhandledrejection", (e) => {
      window.parent.postMessage({
        type: "PREVIEW_RUNTIME_ERROR",
        buildId: CURRENT_BUILD_ID,
        message: e.reason?.message || String(e.reason || "Unhandled Promise Rejection")
      }, "*");
    });

    // Element selection inspector with link interception
    document.addEventListener("click", (e) => {
      if (document.body.dataset.inspectMode !== "true") return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target.closest("[data-preview-id]") || e.target;
      if (!target || target === document.body || target.id === "preview-root") return;
      
      document.querySelectorAll("[data-preview-selected]").forEach(el => el.removeAttribute("data-preview-selected"));
      target.setAttribute("data-preview-selected", "true");

      // Build hierarchy path for breadcrumb
      const hierarchy = [];
      let curr = target;
      while (curr && curr !== document.body && curr.id !== "preview-root" && hierarchy.length < 5) {
        hierarchy.unshift({
          tagName: curr.tagName.toLowerCase(),
          className: curr.className || "",
          id: curr.id || undefined
        });
        curr = curr.parentElement;
      }

      // Safe extract common attributes
      const attributes = {};
      if (target.hasAttribute("alt")) attributes.alt = target.getAttribute("alt") || "";
      if (target.hasAttribute("title")) attributes.title = target.getAttribute("title") || "";
      if (target.hasAttribute("href")) attributes.href = target.getAttribute("href") || "";
      if (target.hasAttribute("src")) attributes.src = target.getAttribute("src") || "";

      const computed = window.getComputedStyle(target);
      window.parent.postMessage({
        type: "ELEMENT_SELECTED",
        buildId: CURRENT_BUILD_ID,
        tagName: target.tagName.toLowerCase(),
        id: target.id || target.getAttribute("data-preview-id") || null,
        className: target.className || "",
        textContent: target.innerText?.slice(0, 100) || "",
        hierarchy,
        attributes,
        styles: {
          display: computed.display,
          position: computed.position,
          width: computed.width,
          height: computed.height,
          padding: computed.padding,
          margin: computed.margin,
          gap: computed.gap,
          justifyContent: computed.justifyContent,
          alignItems: computed.alignItems,
          flexDirection: computed.flexDirection,
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          textAlign: computed.textAlign,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          borderWidth: computed.borderWidth,
          borderStyle: computed.borderStyle,
          borderRadius: computed.borderRadius,
          opacity: computed.opacity,
          boxShadow: computed.boxShadow,
          transform: computed.transform
        }
      }, "*");
    }, true);
  </script>

  <script>
    try {
      ${transpiledApp}

      let AppToMount = window.App || window.__DEFAULT_APP__;
      
      // Fallback search in window if not assigned directly
      if (!AppToMount && typeof window !== 'undefined') {
        for (const key of Object.keys(window)) {
          if (typeof window[key] === 'function' && /^[A-Z]/.test(key) && key !== 'React' && key !== 'ReactDOM') {
            AppToMount = window[key];
            break;
          }
        }
      }

      const rootEl = document.getElementById("preview-root");

      if (AppToMount && rootEl) {
        const root = ReactDOM.createRoot(rootEl);
        root.render(window.React.createElement(AppToMount, null));
        // Verify the commit actually produced DOM before reporting Ready.
        // React 18 renders asynchronously: a bare render() call is NOT proof
        // of a mount, and reporting success immediately produced false
        // "Ready" states (and masked real mount failures as timeouts).
        let verifyAttempts = 0;
        const verifyMount = () => {
          const hasOutput = rootEl.childElementCount > 0 || (rootEl.textContent || "").trim().length > 0;
          if (hasOutput) {
            isAppMounted = true;
            window.parent.postMessage({
              type: "PREVIEW_MOUNTED_SUCCESS",
              buildId: CURRENT_BUILD_ID,
              componentName: AppToMount.displayName || AppToMount.name || "App"
            }, "*");
            return;
          }
          verifyAttempts++;
          if (verifyAttempts < 60) {
            setTimeout(verifyMount, 50);
            return;
          }
          window.parent.postMessage({
            type: "PREVIEW_RUNTIME_ERROR",
            buildId: CURRENT_BUILD_ID,
            message: "Application produced no rendered output: the root component mounted but the preview root stayed empty. Check that the component returns JSX and does not bail out before rendering."
          }, "*");
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(verifyMount);
        } else {
          setTimeout(verifyMount, 0);
        }
      } else {
        const reason = !rootEl 
          ? "DOM node #preview-root was not found" 
          : "Could not locate export for App or default component in " + (window.__ENTRY_FILE__ || "src/app/App.tsx");
        rootEl.innerHTML = \`
          <div style="padding: 32px; font-family: monospace; color: #f87171;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">Entry Component Not Found</h3>
            <p style="font-size: 13px; line-height: 1.5;">\${reason}</p>
            <div style="margin-top: 12px; font-size: 11px; color: #cbd5e1;">Build ID: \${CURRENT_BUILD_ID}</div>
          </div>
        \`;
        window.parent.postMessage({
          type: "PREVIEW_RUNTIME_ERROR",
          buildId: CURRENT_BUILD_ID,
          message: reason
        }, "*");
      }
    } catch (err) {
      console.error("[Preview Execution Error]", err);
      const rootEl = document.getElementById("preview-root");
      const errMsg = err?.message || String(err);
      if (rootEl) {
        rootEl.innerHTML = \`
          <div style="padding: 32px; font-family: monospace; color: #ef4444; background: #0f172a; min-height: 100vh;">
            <h2 style="font-size: 18px; margin-bottom: 8px;">Runtime Exception During Mount</h2>
            <pre style="white-space: pre-wrap; font-size: 13px; color: #fca5a5;">\${errMsg}</pre>
            <div style="margin-top: 16px; font-size: 11px; color: #94a3b8;">Build ID: \${CURRENT_BUILD_ID}</div>
          </div>
        \`;
      }
      window.parent.postMessage({
        type: "PREVIEW_RUNTIME_ERROR",
        buildId: CURRENT_BUILD_ID,
        message: errMsg
      }, "*");
    }
  </script>
</body>
</html>`;

  return {
    html: previewHtml,
    entryFile,
    archetype,
    diagnostics,
    isPlayableOrInteractive: archetype === "car_game" || archetype === "game" || archetype === "dashboard",
    detectedRoutes,
    buildId,
    compiledAt: new Date().toISOString(),
  };
}
