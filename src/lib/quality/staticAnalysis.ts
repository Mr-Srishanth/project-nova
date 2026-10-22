import type { BuildArtifact, FilePlan } from "@/types/artifact";
import type { QualityFinding } from "@/types/quality";
import { generateId } from "@/lib/utils";

export interface StaticAnalysisOptions {
  projectId: string;
  assessmentId: string;
  artifacts: BuildArtifact[];
  filePlan?: FilePlan;
}

export function runStaticAnalysis(options: StaticAnalysisOptions): QualityFinding[] {
  const { projectId, assessmentId, artifacts, filePlan } = options;
  const findings: QualityFinding[] = [];
  const artifactPathSet = new Set(artifacts.map((a) => a.path));

  // 1. Missing Required Artifacts based on the File Plan
  if (filePlan) {
    for (const planned of filePlan.files) {
      if (!artifactPathSet.has(planned.path)) {
        findings.push({
          id: generateId("qa_sa_"),
          projectId,
          assessmentId,
          category: "structure",
          severity: "error",
          title: "Missing Planned File Artifact",
          message: `The file plan requires "${planned.path}" (${planned.purpose}), but it has not been created or stored yet.`,
          filePath: planned.path,
          suggestedFix: `Generate or create "${planned.path}" in the Build Studio workspace.`,
          ruleId: "SA001_MISSING_PLANNED_ARTIFACT",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 2. Artifact-level inspections
  for (const art of artifacts) {
    const lines = art.content.split("\n");
    const trimmedContent = art.content.trim();

    // Check: Empty or suspiciously incomplete file
    if (trimmedContent.length === 0) {
      findings.push({
        id: generateId("qa_sa_"),
        projectId,
        assessmentId,
        category: "static_analysis",
        severity: "error",
        title: "Empty Artifact File",
        message: `Artifact "${art.path}" contains zero characters.`,
        filePath: art.path,
        suggestedFix: "Synthesize or implement source contents for this file.",
        ruleId: "SA002_EMPTY_ARTIFACT",
        status: "open",
        isAiGenerated: false,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    if (
      trimmedContent.startsWith("// Planned from blueprint") ||
      trimmedContent.startsWith("// Generated placeholder for")
    ) {
      if (lines.length <= 4) {
        findings.push({
          id: generateId("qa_sa_"),
          projectId,
          assessmentId,
          category: "static_analysis",
          severity: "warning",
          title: "Unimplemented Scaffold Stub",
          message: `File "${art.path}" still contains only initial scaffolding comments and no active implementation.`,
          filePath: art.path,
          lineNumber: 1,
          snippet: lines[0],
          suggestedFix: "Use Build Studio to synthesize or author code for this file.",
          ruleId: "SA003_SCAFFOLD_STUB",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 3. Inspect line-by-line: TODO / FIXME / Placeholder / Relative Imports
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmedLine = lineText.trim();

      // Placeholder / TODO / FIXME (Classified as suggestion/info or warning, not confirmed defect)
      if (/\b(TODO|FIXME|XXX)\b/i.test(trimmedLine)) {
        findings.push({
          id: generateId("qa_sa_"),
          projectId,
          assessmentId,
          category: "static_analysis",
          severity: "info",
          title: "Unresolved Work Annotation",
          message: `Work annotation detected: ${trimmedLine.slice(0, 80)}`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: trimmedLine,
          suggestedFix: "Verify if pending requirements or edge-cases need implementation.",
          ruleId: "SA004_TODO_FIXME_ANNOTATION",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Explicit unimplemented throw stubs
      if (
        /throw new Error\s*\(\s*["'](Not implemented|TODO|Unimplemented)/i.test(trimmedLine) ||
        /throw new NotImplementedError/i.test(trimmedLine)
      ) {
        findings.push({
          id: generateId("qa_sa_"),
          projectId,
          assessmentId,
          category: "static_analysis",
          severity: "warning",
          title: "Explicit Unimplemented Exception",
          message: `Runtime unimplemented exception thrown in production code path.`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: trimmedLine,
          suggestedFix: "Provide concrete logic for this subroutine.",
          ruleId: "SA005_UNIMPLEMENTED_THROW",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Broken relative imports between known artifacts
      // e.g. import ... from "./foo" or from "../foo"
      const importMatch = trimmedLine.match(/(?:import|from)\s+['"](\.[^'"]+)['"]/);
      if (importMatch && importMatch[1]) {
        const importSpecifier = importMatch[1];
        // Resolve target path relative to current artifact directory
        const resolvedPath = resolveRelativePath(art.path, importSpecifier);
        
        // Check if there is a matching artifact in the set (with or without .ts, .tsx, .js, .json)
        const exists = hasMatchingArtifact(artifactPathSet, resolvedPath);
        if (!exists) {
          findings.push({
            id: generateId("qa_sa_"),
            projectId,
            assessmentId,
            category: "static_analysis",
            severity: "error",
            title: "Unresolved Relative Import",
            message: `Import target "${importSpecifier}" (resolving to "${resolvedPath}") was not found in the project's artifact repository.`,
            filePath: art.path,
            lineNumber: lineNum,
            snippet: trimmedLine,
            suggestedFix: `Create or adjust import target "${resolvedPath}".`,
            ruleId: "SA006_BROKEN_RELATIVE_IMPORT",
            status: "open",
            isAiGenerated: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    // 4. Manifest consistency checks
    if (art.path === "package.json") {
      try {
        const pkg = JSON.parse(art.content);
        if (!pkg.name || !pkg.version) {
          findings.push({
            id: generateId("qa_sa_"),
            projectId,
            assessmentId,
            category: "dependency",
            severity: "warning",
            title: "Incomplete package.json Manifest",
            message: "package.json lacks 'name' or 'version' metadata fields.",
            filePath: "package.json",
            suggestedFix: "Add standard name and semantic version strings.",
            ruleId: "SA007_INCOMPLETE_PACKAGE_JSON",
            status: "open",
            isAiGenerated: false,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        findings.push({
          id: generateId("qa_sa_"),
          projectId,
          assessmentId,
          category: "dependency",
          severity: "error",
          title: "Malformed package.json Syntax",
          message: "package.json contains invalid JSON syntax and cannot be parsed.",
          filePath: "package.json",
          suggestedFix: "Fix JSON syntax errors in package.json.",
          ruleId: "SA008_MALFORMED_PACKAGE_JSON",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return findings;
}

function resolveRelativePath(fromPath: string, relativeSpecifier: string): string {
  const parts = fromPath.split("/");
  parts.pop(); // remove filename to get directory parts
  const relParts = relativeSpecifier.split("/");

  for (const p of relParts) {
    if (p === "." || p === "") continue;
    if (p === "..") {
      parts.pop();
    } else {
      parts.push(p);
    }
  }

  return parts.join("/");
}

function hasMatchingArtifact(existingPaths: Set<string>, targetBase: string): boolean {
  if (existingPaths.has(targetBase)) return true;

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".d.ts", "/index.ts", "/index.tsx"];
  for (const ext of extensions) {
    if (existingPaths.has(`${targetBase}${ext}`)) return true;
  }

  return false;
}
