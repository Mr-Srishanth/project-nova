import type { ReviewFinding } from "@/types/review";
import type { BuildArtifact } from "@/types/artifact";
import type { RepositoryIndex } from "@/types/repository";
import type { ProjectMemory } from "@/types/memory";
import { runStaticAnalysis } from "@/lib/quality/staticAnalysis";
import { runSecurityAnalysis } from "@/lib/quality/securityAnalysis";
import { generateId } from "@/lib/utils";

export interface DeterministicReviewInput {
  projectId: string;
  artifacts: BuildArtifact[];
  repoIndex?: RepositoryIndex | null;
  memories?: ProjectMemory[];
}

/**
 * Runs deterministic code analysis using established Quality Lab rules,
 * circular dependency graphs from Phase 13, and Project Brain constraints.
 */
export function runDeterministicReview(input: DeterministicReviewInput): ReviewFinding[] {
  const { projectId, artifacts, repoIndex, memories } = input;
  const findings: ReviewFinding[] = [];
  const now = new Date().toISOString();

  // 1. Static Analysis Rules
  const staticFindings = runStaticAnalysis({
    projectId,
    assessmentId: "review_static",
    artifacts,
  });

  for (const sf of staticFindings) {
    findings.push({
      id: generateId("rev_find"),
      projectId,
      category: sf.category === "security" ? "security" : "correctness",
      severity: sf.severity === "error" ? "high" : "medium",
      confidence: "high",
      title: sf.title,
      explanation: sf.message,
      filePath: sf.filePath || "unknown",
      lineRange: sf.lineNumber ? { start: sf.lineNumber, end: sf.lineNumber } : undefined,
      evidenceSnippet: sf.filePath,
      detectionMethod: "deterministic_rule",
      potentialImpact: "Code quality degradation or unhandled edge cases.",
      recommendedAction: sf.suggestedFix || "Refactor suspicious pattern.",
      status: "open",
      relatedRuleId: sf.ruleId,
      detectedAt: now,
    });
  }

  // 2. Security Analysis Rules
  const securityFindings = runSecurityAnalysis({
    projectId,
    assessmentId: "review_sec",
    artifacts,
  });

  for (const sec of securityFindings) {
    findings.push({
      id: generateId("rev_find"),
      projectId,
      category: "security",
      severity: sec.severity === "error" ? "critical" : "high",
      confidence: "high",
      title: sec.title,
      explanation: sec.message,
      filePath: sec.filePath || "unknown",
      lineRange: sec.lineNumber ? { start: sec.lineNumber, end: sec.lineNumber } : undefined,
      evidenceSnippet: sec.filePath,
      detectionMethod: "deterministic_rule",
      potentialImpact: "Exposure of sensitive credentials or vulnerability to injection/traversal attacks.",
      recommendedAction: sec.suggestedFix || "Sanitize input or remove hardcoded secret.",
      status: "open",
      relatedRuleId: sec.ruleId,
      detectedAt: now,
    });
  }

  // 3. Circular Dependencies & Unresolved Imports from Phase 13 Repository Index
  if (repoIndex) {
    for (const cycle of repoIndex.dependencyGraph.cycles) {
      findings.push({
        id: generateId("rev_find"),
        projectId,
        category: "maintainability",
        severity: "medium",
        confidence: "high",
        title: `Circular Module Dependency Cycle Detected`,
        explanation: `Modules form a recursive dependency cycle: ${cycle.files.join(" ➔ ")}. This can lead to bundling errors and undefined runtime exports.`,
        filePath: cycle.files[0],
        evidenceSnippet: cycle.files.join(" ➔ "),
        detectionMethod: "parser_verified",
        potentialImpact: "Runtime initialization failure or bundling errors.",
        recommendedAction: "Decouple shared types or utilities into an independent module.",
        status: "open",
        detectedAt: now,
      });
    }

    for (const unresolved of repoIndex.dependencyGraph.unresolvedImports) {
      findings.push({
        id: generateId("rev_find"),
        projectId,
        category: "correctness",
        severity: "high",
        confidence: "high",
        title: `Unresolved Relative Import: "${unresolved.importSpecifier}"`,
        explanation: `File imports from "${unresolved.importSpecifier}", but target file does not exist in the project repository.`,
        filePath: unresolved.fromPath,
        evidenceSnippet: `import from "${unresolved.importSpecifier}"`,
        detectionMethod: "parser_verified",
        potentialImpact: "Module resolution compilation error or runtime crash.",
        recommendedAction: `Create the missing module or correct the import path.`,
        status: "open",
        detectedAt: now,
      });
    }
  }

  // 4. Project Brain Policy & Architectural Constraints Violation Check
  if (memories) {
    const activeConstraints = memories.filter(
      (m) => (m.type === "constraint" || m.type === "decision") && m.status === "active"
    );

    for (const mem of activeConstraints) {
      const text = (mem.title + " " + mem.content).toLowerCase();

      // Example: Constraint states "No eval" or "No innerHTML"
      if (text.includes("no eval") || text.includes("disallow eval")) {
        for (const art of artifacts) {
          if (/\beval\s*\(/.test(art.content)) {
            findings.push({
              id: generateId("rev_find"),
              projectId,
              category: "architecture",
              severity: "critical",
              confidence: "high",
              title: `Brain Constraint Violation: eval() detected in "${art.path}"`,
              explanation: `Project Brain constraint "${mem.title}" prohibits dynamic code evaluation. Found eval() usage.`,
              filePath: art.path,
              evidenceSnippet: `eval(...)`,
              detectionMethod: "deterministic_rule",
              potentialImpact: "Violation of project architectural security policy.",
              recommendedAction: "Replace dynamic eval() with safe deterministic parsing.",
              status: "open",
              relatedMemoryId: mem.id,
              detectedAt: now,
            });
          }
        }
      }
    }
  }

  return findings;
}
