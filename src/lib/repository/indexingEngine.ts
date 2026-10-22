import type {
  RepositoryIndex,
  IndexedFile,
  RepositorySourceType,
  DependencyGraphEdge,
  DependencyCycle,
  RepositoryDependencyGraph,
} from "@/types/repository";
import { checkFileExclusion, detectLanguageFromPath, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REPOSITORY } from "./exclusionRules";
import { parseSourceStructure, resolveRelativeImport } from "./structureParser";
import { validateRelativeFilePath } from "@/lib/build/pathValidator";
import { generateId } from "@/lib/utils";
import { activityLogger } from "@/lib/observability/activityLogger";

export interface SourceFileInput {
  path: string;
  content: string;
  lastModified?: string;
}

export interface IndexRepositoryOptions {
  projectId: string;
  sourceType: RepositorySourceType;
  sourceName: string;
  files: SourceFileInput[];
  onProgress?: (processed: number, total: number) => void;
  shouldCancel?: () => boolean;
}

/**
 * Builds a full, typed repository index from input source files.
 */
export async function indexRepository(options: IndexRepositoryOptions): Promise<RepositoryIndex> {
  const { projectId, sourceType, sourceName, files, onProgress, shouldCancel } = options;
  const startTime = performance.now();

  const indexedFiles: IndexedFile[] = [];
  const detectedLanguages: Record<string, number> = {};
  let manifestDependencies: Record<string, string> | undefined;
  let manifestDevDependencies: Record<string, string> | undefined;

  let totalFilesCount = Math.min(files.length, MAX_FILES_PER_REPOSITORY);
  let indexedFilesCount = 0;
  let skippedFilesCount = 0;
  let failedFilesCount = 0;

  // Track valid relative paths for import resolution
  const validFilePaths = new Set<string>();
  for (const f of files.slice(0, MAX_FILES_PER_REPOSITORY)) {
    const val = validateRelativeFilePath(f.path);
    if (val.isValid && val.normalizedPath) {
      validFilePaths.add(val.normalizedPath);
    }
  }

  // 1. Process files
  for (let i = 0; i < totalFilesCount; i++) {
    if (shouldCancel && shouldCancel()) {
      await activityLogger.log({
        projectId,
        category: "orchestration",
        eventType: "repo_index_cancelled",
        severity: "warning",
        outcome: "cancelled",
        sourceSubsystem: "orchestrator",
        summary: `Repository indexing cancelled by user for "${sourceName}".`,
      });
      throw new Error("Repository indexing was cancelled.");
    }

    const file = files[i];
    const pathValidation = validateRelativeFilePath(file.path);

    if (!pathValidation.isValid || !pathValidation.normalizedPath) {
      failedFilesCount++;
      indexedFiles.push({
        id: generateId("file"),
        path: file.path,
        language: "unknown",
        sizeBytes: (file.content || "").length,
        isExcluded: true,
        exclusionReason: pathValidation.error || "Path validation failed",
        parseStatus: "failed",
        parseDiagnostic: pathValidation.error,
      });
      continue;
    }

    const normPath = pathValidation.normalizedPath;
    const lang = detectLanguageFromPath(normPath);
    detectedLanguages[lang] = (detectedLanguages[lang] || 0) + 1;

    // Check exclusion
    const exclusion = checkFileExclusion(normPath);
    if (exclusion.isExcluded) {
      skippedFilesCount++;
      indexedFiles.push({
        id: generateId("file"),
        path: normPath,
        language: lang,
        sizeBytes: (file.content || "").length,
        isExcluded: true,
        exclusionReason: exclusion.reason,
        parseStatus: "skipped",
      });
      continue;
    }

    // Check size limit
    const sizeBytes = (file.content || "").length;
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      skippedFilesCount++;
      indexedFiles.push({
        id: generateId("file"),
        path: normPath,
        language: lang,
        sizeBytes,
        isExcluded: true,
        exclusionReason: `File size exceeds limit of ${MAX_FILE_SIZE_BYTES / 1024} KB.`,
        parseStatus: "skipped",
      });
      continue;
    }

    // Parse package.json manifest
    if (normPath === "package.json") {
      try {
        const pkg = JSON.parse(file.content);
        if (pkg && typeof pkg === "object") {
          manifestDependencies = pkg.dependencies;
          manifestDevDependencies = pkg.devDependencies;
        }
      } catch {
        // Safe manifest parse failure fallback
      }
    }

    // Parse structure
    try {
      const structure = parseSourceStructure(normPath, file.content, lang);
      indexedFilesCount++;

      indexedFiles.push({
        id: generateId("file"),
        path: normPath,
        language: lang,
        sizeBytes,
        lastModified: file.lastModified,
        isExcluded: false,
        parseStatus: "parsed",
        structure,
      });
    } catch (err: any) {
      failedFilesCount++;
      indexedFiles.push({
        id: generateId("file"),
        path: normPath,
        language: lang,
        sizeBytes,
        isExcluded: false,
        parseStatus: "failed",
        parseDiagnostic: err?.message || "Source structure extraction failed",
      });
    }

    if (onProgress) {
      onProgress(i + 1, totalFilesCount);
    }
  }

  // 2. Build Dependency Graph & Detect Cycles
  const dependencyGraph = buildDependencyGraph(indexedFiles, validFilePaths);

  // 3. Project Type Inference
  let projectType = "Generic Source Repository";
  if (manifestDependencies?.["react"] || manifestDevDependencies?.["@vitejs/plugin-react"]) {
    projectType = "React / Vite TypeScript Application";
  } else if (manifestDependencies?.["next"]) {
    projectType = "Next.js Web Application";
  } else if (manifestDependencies?.["express"] || manifestDependencies?.["fastify"]) {
    projectType = "Node.js REST Backend Service";
  }

  const durationMs = performance.now() - startTime;

  const repoIndex: RepositoryIndex = {
    id: generateId("repo_idx"),
    projectId,
    sourceType,
    sourceName,
    indexedAt: new Date().toISOString(),
    totalFilesCount,
    indexedFilesCount,
    skippedFilesCount,
    failedFilesCount,
    detectedLanguages,
    projectType,
    manifestDependencies,
    manifestDevDependencies,
    files: indexedFiles,
    dependencyGraph,
  };

  await activityLogger.log({
    projectId,
    category: "orchestration",
    eventType: "repo_indexed",
    severity: "info",
    outcome: "succeeded",
    sourceSubsystem: "orchestrator",
    durationMs,
    summary: `Indexed repository "${sourceName}": ${indexedFilesCount} files analyzed, ${skippedFilesCount} skipped (${Math.round(durationMs)}ms).`,
  });

  return repoIndex;
}

/**
 * Builds dependency graph, checks relative import resolution, and finds cycles.
 */
function buildDependencyGraph(
  files: IndexedFile[],
  availablePaths: Set<string>
): RepositoryDependencyGraph {
  const nodes = files.filter((f) => !f.isExcluded).map((f) => f.path);
  const nodeSet = new Set(nodes);
  const edges: DependencyGraphEdge[] = [];
  const unresolvedImports: { fromPath: string; importSpecifier: string }[] = [];

  const adjacency = new Map<string, Set<string>>();

  for (const file of files) {
    if (!file.structure || file.isExcluded) continue;

    for (const imp of file.structure.imports) {
      if (imp.isRelative) {
        const resolved = resolveRelativeImport(file.path, imp.source, availablePaths);
        if (resolved && nodeSet.has(resolved)) {
          edges.push({
            fromPath: file.path,
            toPath: resolved,
            importSpecifier: imp.source,
            isResolved: true,
            isExternalPackage: false,
          });

          if (!adjacency.has(file.path)) adjacency.set(file.path, new Set());
          adjacency.get(file.path)!.add(resolved);
        } else {
          edges.push({
            fromPath: file.path,
            toPath: imp.source,
            importSpecifier: imp.source,
            isResolved: false,
            isExternalPackage: false,
          });
          unresolvedImports.push({ fromPath: file.path, importSpecifier: imp.source });
        }
      } else {
        edges.push({
          fromPath: file.path,
          toPath: imp.source,
          importSpecifier: imp.source,
          isResolved: true,
          isExternalPackage: true,
        });
      }
    }
  }

  // Detect circular dependency cycles using DFS
  const cycles: DependencyCycle[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(curr: string, path: string[]) {
    visited.add(curr);
    recursionStack.add(curr);
    path.push(curr);

    const neighbors = adjacency.get(curr) || new Set();
    for (const n of neighbors) {
      if (!visited.has(n)) {
        dfs(n, [...path]);
      } else if (recursionStack.has(n)) {
        // Cycle detected
        const cycleStartIndex = path.indexOf(n);
        if (cycleStartIndex !== -1) {
          const cyclePath = path.slice(cycleStartIndex);
          cyclePath.push(n);
          // Avoid duplicate cycle reporting
          const cycleKey = cyclePath.slice(0, -1).sort().join("|");
          if (!cycles.some((c) => c.files.slice().sort().join("|") === cycleKey)) {
            cycles.push({ files: cyclePath });
          }
        }
      }
    }

    recursionStack.delete(curr);
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return {
    nodes,
    edges,
    unresolvedImports,
    cycles,
  };
}
