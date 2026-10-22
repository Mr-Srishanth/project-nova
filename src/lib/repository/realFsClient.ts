export interface RepoFileInfo {
  path: string;
  name: string;
  sizeBytes: number;
  lastModified: string;
  extension: string;
  isExcluded: boolean;
  exclusionReason?: string;
}

export interface RepoDirectoryInfo {
  path: string;
  name: string;
  filesCount: number;
  subdirectoriesCount: number;
  isExcluded: boolean;
}

export interface RepoArchitectureNode {
  id: string;
  name: string;
  path: string;
  category:
    | "entrypoint"
    | "page"
    | "component"
    | "module"
    | "gateway"
    | "storage"
    | "config"
    | "test"
    | "doc";
  summary: string;
  dependencies: string[];
}

export interface RepoArchitectureLayer {
  id: string;
  title: string;
  description: string;
  badge: string;
  nodeIds: string[];
}

export interface RepoScanResult {
  rootPath: string;
  directories: RepoDirectoryInfo[];
  files: RepoFileInfo[];
  totalFilesCount: number;
  totalDirectoriesCount: number;
  totalSizeBytes: number;
  scannedAt: string;
  architectureOverview: {
    layers: RepoArchitectureLayer[];
    nodes: RepoArchitectureNode[];
  };
}

export interface FileInspectionResult {
  path: string;
  name: string;
  sizeBytes: number;
  lastModified: string;
  isSecretOrRedacted: boolean;
  content: string;
  mimeType: string;
  imports: string[];
  exports: string[];
  relatedTests: string[];
}

const GATEWAY_BASE = "http://localhost:4000/api/repo";

export class RealFsRepositoryClient {
  async scan(options?: {
    rootDirectory?: string;
    includeIgnored?: boolean;
    includeHidden?: boolean;
    maxFiles?: number;
  }): Promise<RepoScanResult> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed to scan repository: ${res.statusText}`);
      }

      return (await res.json()) as RepoScanResult;
    } catch (err: any) {
      if (err.message?.includes("Failed to fetch") || err.message?.includes("ECONNREFUSED")) {
        throw new Error("Local filesystem gateway is offline. Please ensure 'bun run server' is active.");
      }
      throw err;
    }
  }

  async inspectFile(
    filePath: string,
    rootDirectory?: string
  ): Promise<FileInspectionResult> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/inspect-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, rootDirectory }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed to inspect file: ${res.statusText}`);
      }

      return (await res.json()) as FileInspectionResult;
    } catch (err: any) {
      if (err.message?.includes("Failed to fetch") || err.message?.includes("ECONNREFUSED")) {
        throw new Error("Local filesystem gateway is offline. Please ensure 'bun run server' is active.");
      }
      throw err;
    }
  }
}

export const realFsClient = new RealFsRepositoryClient();
