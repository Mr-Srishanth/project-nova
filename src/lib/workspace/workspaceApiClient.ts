export interface WorkspaceFileMetadata {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
}

export interface WorkspaceCommandResult {
  success: boolean;
  exitCode: number | null;
  processId: string;
  logs: string[];
  error?: string;
}

const GATEWAY_BASE = "http://localhost:4000";

export const workspaceApiClient = {
  async listFiles(projectId: string): Promise<WorkspaceFileMetadata[]> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/files?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        throw new Error(`Failed to list workspace files: HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.files || [];
    } catch (err: any) {
      console.warn("[Workspace API] listFiles error:", err);
      return [];
    }
  },

  async readFile(projectId: string, path: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${GATEWAY_BASE}/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.content || "";
    } catch (err: any) {
      console.warn("[Workspace API] readFile error:", err);
      return null;
    }
  },

  async writeFile(projectId: string, path: string, content: string): Promise<boolean> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, path, content }),
      });
      return res.ok;
    } catch (err: any) {
      console.warn("[Workspace API] writeFile error:", err);
      return false;
    }
  },

  async deleteFile(projectId: string, path: string): Promise<boolean> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/file/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, path }),
      });
      return res.ok;
    } catch (err: any) {
      console.warn("[Workspace API] deleteFile error:", err);
      return false;
    }
  },

  async syncArtifactsToWorkspace(
    projectId: string,
    files: { path: string; content: string }[]
  ): Promise<{ success: boolean; syncedCount: number; totalFiles: number }> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, files }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      console.warn("[Workspace API] syncArtifacts error:", err);
      return { success: false, syncedCount: 0, totalFiles: 0 };
    }
  },

  async executeCommand(projectId: string, command: string): Promise<WorkspaceCommandResult> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, command }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          exitCode: data.exitCode ?? 1,
          processId: data.processId || "",
          logs: data.logs || [],
          error: data.error || `HTTP ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        exitCode: 1,
        processId: "",
        logs: [],
        error: err.message || "Network error communicating with AI Gateway runner",
      };
    }
  },

  async killProcess(processId: string): Promise<boolean> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/workspace/command/kill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      return res.ok;
    } catch (err: any) {
      console.warn("[Workspace API] killProcess error:", err);
      return false;
    }
  },
};
