import type { ProjectDocument, DocumentDriftFinding } from "@/types/document";
import type { BuildArtifact } from "@/types/artifact";
import type { Blueprint } from "@/types/blueprint";
import { generateId } from "@/lib/utils";

export interface DriftDetectionInput {
  document: ProjectDocument;
  artifacts: BuildArtifact[];
  blueprint?: Blueprint;
  documentedEnvVars?: string[];
}

export function detectDocumentDrift(input: DriftDetectionInput): DocumentDriftFinding[] {
  const { document, artifacts, blueprint, documentedEnvVars } = input;
  const findings: DocumentDriftFinding[] = [];
  const artifactPathSet = new Set(artifacts.map((a) => a.path));

  // 1. Inspect referenced files in the document (e.g. `src/foo/bar.ts` or package.json)
  const referencedFileMatches = document.content.matchAll(/`([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)`/g);
  for (const match of referencedFileMatches) {
    const candidatePath = match[1];
    // Check if this looks like a source file path inside the project
    if (
      candidatePath.startsWith("src/") ||
      candidatePath === "package.json" ||
      candidatePath === "tsconfig.json" ||
      candidatePath.endsWith(".sql")
    ) {
      if (!artifactPathSet.has(candidatePath)) {
        findings.push({
          id: generateId("drift_"),
          documentId: document.id,
          section: "File References",
          severity: "mismatch",
          reason: `Document references source file \`${candidatePath}\`, which does not exist in the project's artifact repository.`,
          sourceContext: `Artifact count: ${artifacts.length}`,
          suggestedAction: `Remove reference or synthesize \`${candidatePath}\` in Build Studio.`,
          status: "open",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 2. Inspect API Reference consistency
  if (document.type === "api_reference" && blueprint?.api) {
    const blueprintRoutes = new Set(blueprint.api.map((ep) => `${ep.method} ${ep.route}`));
    // Look for routes documented in Markdown like `GET /api/...`
    const docRouteMatches = document.content.matchAll(/`((?:GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z0-9_\-\/]+)`/g);
    for (const match of docRouteMatches) {
      const docRoute = match[1];
      if (!blueprintRoutes.has(docRoute)) {
        findings.push({
          id: generateId("drift_"),
          documentId: document.id,
          section: "API Endpoints",
          severity: "drift",
          reason: `Endpoint \`${docRoute}\` is documented but absent from the project's architecture blueprint.`,
          sourceContext: `Blueprint endpoints: ${blueprint.api.length}`,
          suggestedAction: "Update blueprint in Blueprint Studio or align API documentation.",
          status: "open",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 3. Inspect Environment Parameter references
  if (documentedEnvVars && documentedEnvVars.length > 0) {
    const envVarMatches = document.content.matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g);
    const knownEnvSet = new Set(documentedEnvVars);
    for (const match of envVarMatches) {
      const envName = match[1];
      // Check typical env var prefix patterns
      if (
        (envName.startsWith("DATABASE_") ||
          envName.startsWith("API_") ||
          envName.startsWith("JWT_") ||
          envName.startsWith("APP_") ||
          envName.endsWith("_KEY") ||
          envName.endsWith("_SECRET")) &&
        !knownEnvSet.has(envName)
      ) {
        findings.push({
          id: generateId("drift_"),
          documentId: document.id,
          section: "Environment Configuration",
          severity: "unverified",
          reason: `Document mentions environment parameter \`${envName}\`, which is not registered in Release Center environment specs.`,
          sourceContext: "Release Center Env Config",
          suggestedAction: `Register \`${envName}\` in Release Center or update documentation notes.`,
          status: "open",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return findings;
}
