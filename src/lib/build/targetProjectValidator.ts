import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { BuildArtifact } from "@/types/artifact";

export interface TargetProjectValidationResult {
  valid: boolean;
  isolatedWorkspaceDir: string;
  filesChecked: number;
  missingFiles: string[];
  syntaxErrors: string[];
  entryPointVerified: boolean;
  packageScriptsValid: boolean;
  viteConfigValid: boolean;
  diagnostics: string[];
}

/**
 * Validates a generated target project within an isolated sandbox directory.
 * Safely inspects configuration, package.json scripts, entry points, and path imports
 * without polluting or executing unvetted code in the primary host runtime.
 */
export async function validateTargetProjectInIsolation(
  projectName: string,
  artifacts: BuildArtifact[]
): Promise<TargetProjectValidationResult> {
  const tmpBase = os.tmpdir();
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const isolatedDir = path.join(tmpBase, `nova-test-target-${safeName}-${Date.now()}`);

  const diagnostics: string[] = [];
  const missingFiles: string[] = [];
  const syntaxErrors: string[] = [];
  let entryPointVerified = false;
  let packageScriptsValid = false;
  let viteConfigValid = false;

  try {
    fs.mkdirSync(isolatedDir, { recursive: true });

    // 1. Write all artifact files to isolated workspace
    for (const art of artifacts) {
      const fullPath = path.join(isolatedDir, art.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, art.content || "", "utf-8");
    }

    // 2. Verify mandatory root files for web projects
    const hasPackageJson = fs.existsSync(path.join(isolatedDir, "package.json"));
    if (!hasPackageJson) {
      missingFiles.push("package.json");
    } else {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(isolatedDir, "package.json"), "utf-8"));
        // Check scripts consistency
        if (pkg.scripts && typeof pkg.scripts === "object") {
          packageScriptsValid = true;
          // Check that build script or main does not point to phantom files like src/index.ts
          if (pkg.main && !fs.existsSync(path.join(isolatedDir, pkg.main))) {
            diagnostics.push(`package.json 'main' field references missing file: ${pkg.main}`);
          }
        } else {
          diagnostics.push("package.json does not declare standard build/dev scripts.");
        }
      } catch {
        syntaxErrors.push("package.json contains invalid JSON syntax.");
      }
    }

    // 3. Verify vite.config.ts if present
    const hasViteConfig = fs.existsSync(path.join(isolatedDir, "vite.config.ts"));
    if (hasViteConfig) {
      const viteContent = fs.readFileSync(path.join(isolatedDir, "vite.config.ts"), "utf-8");
      if (viteContent.includes("defineConfig")) {
        viteConfigValid = true;
      }
    } else {
      viteConfigValid = true; // non-critical if basic package.json present
    }

    // 4. Check for HTML entry point or client TSX entry
    const hasIndexHtml = fs.existsSync(path.join(isolatedDir, "index.html"));
    const hasAppTsx =
      fs.existsSync(path.join(isolatedDir, "src/app/App.tsx")) ||
      fs.existsSync(path.join(isolatedDir, "src/App.tsx")) ||
      fs.existsSync(path.join(isolatedDir, "src/main.tsx"));

    if (hasIndexHtml) {
      const htmlContent = fs.readFileSync(path.join(isolatedDir, "index.html"), "utf-8");
      // Find all module and local scripts (ignore external CDNs like http:// or https://)
      const scriptMatches = [...htmlContent.matchAll(/src=["']([^"']+)["']/g)];
      const localScripts = scriptMatches
        .map((m) => m[1])
        .filter((src) => !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("//"));

      if (localScripts.length > 0) {
        for (const localScript of localScripts) {
          const scriptPath = localScript.replace(/^\//, "");
          if (fs.existsSync(path.join(isolatedDir, scriptPath))) {
            entryPointVerified = true;
          } else {
            diagnostics.push(`index.html references script '${localScript}' which was not found.`);
          }
        }
      } else if (hasAppTsx) {
        entryPointVerified = true;
      }
    } else if (hasAppTsx) {
      entryPointVerified = true;
    }

    const isValid =
      missingFiles.length === 0 &&
      syntaxErrors.length === 0 &&
      entryPointVerified &&
      packageScriptsValid;

    return {
      valid: isValid,
      isolatedWorkspaceDir: isolatedDir,
      filesChecked: artifacts.length,
      missingFiles,
      syntaxErrors,
      entryPointVerified,
      packageScriptsValid,
      viteConfigValid,
      diagnostics,
    };
  } finally {
    // Clean up temporary workspace safely
    try {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    } catch {
      // Ignored non-critical cleanup
    }
  }
}
