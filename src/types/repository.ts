export type RepositorySourceType = "project_artifacts" | "imported_snapshot";

export type DetectedLanguage =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "css"
  | "html"
  | "sql"
  | "unknown";

export interface FileExclusionRule {
  pattern: RegExp;
  reason: string;
}

export interface ExtractedSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "export";
  line?: number;
  isExported: boolean;
}

export interface ExtractedModuleImport {
  source: string; // e.g. "./utils", "react", "@/types"
  importedSymbols: string[];
  isRelative: boolean;
  resolvedPath?: string;
}

export interface ExtractedCodeStructure {
  imports: ExtractedModuleImport[];
  exports: string[];
  symbols: ExtractedSymbol[];
  isEntryPointCandidate: boolean;
  apiRouteCandidates: string[];
  analysisType: "parser_verified" | "heuristic";
}

export interface IndexedFile {
  id: string;
  path: string; // Relative to repository root
  language: DetectedLanguage;
  sizeBytes: number;
  contentHash?: string;
  lastModified?: string;
  isExcluded: boolean;
  exclusionReason?: string;
  parseStatus: "parsed" | "skipped" | "failed" | "unsupported";
  parseDiagnostic?: string;
  structure?: ExtractedCodeStructure;
}

export interface DependencyGraphEdge {
  fromPath: string;
  toPath: string;
  importSpecifier: string;
  isResolved: boolean;
  isExternalPackage: boolean;
}

export interface DependencyCycle {
  files: string[];
}

export interface RepositoryDependencyGraph {
  nodes: string[];
  edges: DependencyGraphEdge[];
  unresolvedImports: { fromPath: string; importSpecifier: string }[];
  cycles: DependencyCycle[];
}

export interface RepositoryIndex {
  id: string;
  projectId: string;
  sourceType: RepositorySourceType;
  sourceName: string;
  indexedAt: string;
  totalFilesCount: number;
  indexedFilesCount: number;
  skippedFilesCount: number;
  failedFilesCount: number;
  detectedLanguages: Record<string, number>;
  projectType: string; // e.g. "React / Vite TypeScript Application"
  manifestDependencies?: Record<string, string>;
  manifestDevDependencies?: Record<string, string>;
  files: IndexedFile[];
  dependencyGraph: RepositoryDependencyGraph;
}

export type DriftFindingCategory =
  | "missing_implementation"
  | "untracked_module"
  | "missing_documented_file"
  | "missing_api_route"
  | "manifest_mismatch"
  | "conflicting_brain_decision";

export interface ArchitectureDriftFinding {
  id: string;
  projectId: string;
  category: DriftFindingCategory;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: string;
  detectionMethod: "parser_verified" | "heuristic_comparison";
  confidence: "high" | "medium" | "tentative";
  targetReference?: string;
  suggestedAction: string;
  detectedAt: string;
}
