import type {
  RepositoryIndex,
  ArchitectureDriftFinding,
} from "@/types/repository";
import type { Blueprint } from "@/types/blueprint";
import type { ProjectDocument } from "@/types/document";
import type { ProjectMemory } from "@/types/memory";
import { generateId } from "@/lib/utils";

export interface DriftDetectionOptions {
  index: RepositoryIndex;
  blueprint?: Blueprint;
  documents?: ProjectDocument[];
  memories?: ProjectMemory[];
}

/**
 * Cross-references indexed repository implementation evidence against
 * project blueprints, documentation, and Project Brain active decisions.
 */
export function detectArchitectureDrift(options: DriftDetectionOptions): ArchitectureDriftFinding[] {
  const { index, blueprint, documents, memories } = options;
  const findings: ArchitectureDriftFinding[] = [];
  const now = new Date().toISOString();

  const indexedFilePaths = new Set(index.files.filter((f) => !f.isExcluded).map((f) => f.path));

  // Collect all detected API routes
  const detectedApiRoutes = new Set<string>();
  for (const f of index.files) {
    if (f.structure?.apiRouteCandidates) {
      for (const r of f.structure.apiRouteCandidates) {
        detectedApiRoutes.add(r.toUpperCase());
      }
    }
  }

  // 1. Cross-reference Blueprint API routes
  if (blueprint?.api && blueprint.api.length > 0) {
    for (const ep of blueprint.api) {
      const epKey = `${ep.method.toUpperCase()} ${ep.route.toUpperCase()}`;
      if (!detectedApiRoutes.has(epKey)) {
        findings.push({
          id: generateId("drift"),
          projectId: index.projectId,
          category: "missing_api_route",
          severity: "medium",
          title: `Blueprint API Route Not Implemented: ${ep.method} ${ep.route}`,
          explanation: `The project blueprint declares route \`${ep.method} ${ep.route}\`, but no matching route definition was detected across indexed source files.`,
          evidence: `Indexed route candidates: ${Array.from(detectedApiRoutes).join(", ") || "none detected"}`,
          detectionMethod: "heuristic_comparison",
          confidence: "medium",
          targetReference: ep.route,
          suggestedAction: `Implement route handler in backend routes or update the project blueprint.`,
          detectedAt: now,
        });
      }
    }
  }

  // 2. Cross-reference Blueprint Components & Database entities
  if (blueprint?.database?.entities && blueprint.database.entities.length > 0) {
    const hasSchemaFile = Array.from(indexedFilePaths).some(
      (p) => p.includes("schema") || p.endsWith(".sql") || p.includes("model") || p.includes("entities")
    );
    if (!hasSchemaFile && index.indexedFilesCount > 0) {
      findings.push({
        id: generateId("drift"),
        projectId: index.projectId,
        category: "missing_implementation",
        severity: "medium",
        title: `Database Entities Declared Without Detected Schema File`,
        explanation: `Blueprint declares ${blueprint.database.entities.length} database entities (${blueprint.database.entities.map((e) => e.name).join(", ")}), but no schema definition file (.sql, schema.ts, models.ts) was found in repository.`,
        evidence: `Repository has ${index.indexedFilesCount} indexed files.`,
        detectionMethod: "parser_verified",
        confidence: "high",
        suggestedAction: `Create database schema files or models under src/db or src/schema.`,
        detectedAt: now,
      });
    }
  }

  // 3. Cross-reference Documentation references to source files
  if (documents && documents.length > 0) {
    for (const doc of documents) {
      const referencedFileMatches = doc.content.matchAll(/`([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)`/g);
      for (const match of referencedFileMatches) {
        const candidatePath = match[1];
        if (
          candidatePath.startsWith("src/") ||
          candidatePath === "package.json" ||
          candidatePath === "tsconfig.json"
        ) {
          if (!indexedFilePaths.has(candidatePath)) {
            findings.push({
              id: generateId("drift"),
              projectId: index.projectId,
              category: "missing_documented_file",
              severity: "high",
              title: `Documented File Missing from Repository: \`${candidatePath}\``,
              explanation: `Document "${doc.title}" references source file \`${candidatePath}\`, which does not exist in the repository index.`,
              evidence: `Document: ${doc.title} (${doc.type})`,
              detectionMethod: "parser_verified",
              confidence: "high",
              targetReference: candidatePath,
              suggestedAction: `Verify if \`${candidatePath}\` was renamed or generate the missing file.`,
              detectedAt: now,
            });
          }
        }
      }
    }
  }

  // 4. Cross-reference Project Brain Decisions & Constraints
  if (memories && memories.length > 0) {
    const activeDecisions = memories.filter(
      (m) => (m.type === "decision" || m.type === "constraint") && m.status === "active"
    );

    for (const mem of activeDecisions) {
      // Check for technology decision drift
      const memText = (mem.title + " " + mem.content).toLowerCase();

      // Example check: Decision says "Use Tailwind", but no tailwind in package.json or config
      if (memText.includes("tailwind") && index.manifestDependencies) {
        const hasTailwind =
          Boolean(index.manifestDependencies["tailwindcss"]) ||
          Boolean(index.manifestDevDependencies?.["tailwindcss"]) ||
          Array.from(indexedFilePaths).some((p) => p.includes("tailwind.config"));

        if (!hasTailwind && index.indexedFilesCount > 5) {
          findings.push({
            id: generateId("drift"),
            projectId: index.projectId,
            category: "conflicting_brain_decision",
            severity: "medium",
            title: `Architectural Decision Drift: Tailwind CSS Missing`,
            explanation: `Project Brain active memory "${mem.title}" specifies Tailwind CSS, but neither package dependencies nor tailwind.config was detected in the repository.`,
            evidence: `Memory ID: ${mem.id} ("${mem.title}")`,
            detectionMethod: "parser_verified",
            confidence: "high",
            targetReference: mem.id,
            suggestedAction: `Install Tailwind CSS or update the architectural decision in Project Brain.`,
            detectedAt: now,
          });
        }
      }
    }
  }

  return findings;
}
