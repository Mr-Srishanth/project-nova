import fs from "node:fs";
import path from "node:path";
import { spawn, execSync, type ChildProcess } from "node:child_process";

// Allowed workspaces root
const WORKSPACES_ROOT = path.resolve(process.cwd(), "workspaces");

// Ensure base workspaces directory exists
if (!fs.existsSync(WORKSPACES_ROOT)) {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

// Track running processes by project / process ID
interface RunningProcess {
  processId: string;
  projectId: string;
  command: string;
  startedAt: string;
  process: ChildProcess;
  logs: string[];
  status: "running" | "exited" | "killed";
  exitCode: number | null;
}

const activeProcesses = new Map<string, RunningProcess>();

// Disallowed command patterns to prevent escape, destruction, or unsafe execution
const FORBIDDEN_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[c-z]:/i,
  /format\s+[c-z]:/i,
  /shutdown/i,
  /reboot/i,
  /:(){ :\|:& };:/, // Fork bomb
  /curl.*\|\s*sh/i,
  /wget.*\|\s*sh/i,
  /powershell.*-enc/i,
  /reg\s+delete/i,
  /net\s+user/i,
];

// Whitelisted command executables allowed in workspaces
const ALLOWED_EXECUTABLES = new Set([
  "npm",
  "bun",
  "yarn",
  "pnpm",
  "node",
  "vite",
  "tsc",
  "git",
  "echo",
  "cat",
  "ls",
  "dir",
  "pwd",
  "python",
  "pytest",
]);

export function getProjectWorkspacePath(projectId: string): string {
  // Sanitize projectId to prevent directory traversal
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const projectDir = path.resolve(WORKSPACES_ROOT, safeId);

  // Guard against traversal
  if (!projectDir.startsWith(WORKSPACES_ROOT)) {
    throw new Error("Invalid workspace directory: Path traversal detected.");
  }

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Ensure workspace is initialized with its own isolated git repository
  const gitDir = path.join(projectDir, ".git");
  if (!fs.existsSync(gitDir)) {
    try {
      execSync("git init -b main", { cwd: projectDir, stdio: "ignore" });
    } catch {
      try {
        execSync("git init", { cwd: projectDir, stdio: "ignore" });
      } catch {
        // Non-critical if git CLI fails
      }
    }
  }

  return projectDir;
}

export interface WorkspaceFileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
}

export function listWorkspaceFiles(projectId: string, relSubdir = ""): WorkspaceFileEntry[] {
  const root = getProjectWorkspacePath(projectId);
  const targetDir = path.resolve(root, relSubdir.replace(/^[/\\]+/, ""));

  if (!targetDir.startsWith(root)) {
    throw new Error("Directory traversal detected in workspace file query.");
  }

  if (!fs.existsSync(targetDir)) return [];

  const results: WorkspaceFileEntry[] = [];
  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".git" || ent.name === "node_modules" || ent.name === ".DS_Store") continue;
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      const stat = fs.statSync(full);
      results.push({
        path: rel,
        name: ent.name,
        isDirectory: ent.isDirectory(),
        size: ent.isDirectory() ? 0 : stat.size,
        lastModified: stat.mtime.toISOString(),
      });
      if (ent.isDirectory()) {
        scan(full);
      }
    }
  }

  scan(targetDir);
  return results;
}

export function writeWorkspaceFile(projectId: string, relPath: string, content: string): void {
  const root = getProjectWorkspacePath(projectId);
  const fullPath = path.resolve(root, relPath.replace(/^[/\\]+/, ""));

  if (!fullPath.startsWith(root)) {
    throw new Error("Access denied: File path escapes project workspace.");
  }

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, "utf-8");
}

export function readWorkspaceFile(projectId: string, relPath: string): string | null {
  const root = getProjectWorkspacePath(projectId);
  const fullPath = path.resolve(root, relPath.replace(/^[/\\]+/, ""));

  if (!fullPath.startsWith(root)) {
    throw new Error("Access denied: File path escapes project workspace.");
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return null;
  }

  return fs.readFileSync(fullPath, "utf-8");
}

export function deleteWorkspaceFile(projectId: string, relPath: string): boolean {
  const root = getProjectWorkspacePath(projectId);
  const fullPath = path.resolve(root, relPath.replace(/^[/\\]+/, ""));

  if (!fullPath.startsWith(root)) {
    throw new Error("Access denied: File path escapes project workspace.");
  }

  if (!fs.existsSync(fullPath)) return false;

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(fullPath);
  }
  return true;
}

export function executeWorkspaceCommand(
  projectId: string,
  commandStr: string,
  options?: { timeoutMs?: number; onLog?: (chunk: string) => void }
): Promise<{ processId: string; exitCode: number | null; logs: string[] }> {
  const root = getProjectWorkspacePath(projectId);
  const cleanCmd = commandStr.trim();

  // Safety checks
  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(cleanCmd)) {
      throw new Error(`Security policy violation: Command contains forbidden pattern: ${pattern}`);
    }
  }

  const parts = cleanCmd.split(/\s+/);
  const binary = parts[0].toLowerCase().replace(/\.exe$/, "");

  if (!ALLOWED_EXECUTABLES.has(binary)) {
    throw new Error(`Execution policy violation: Executable '${binary}' is not allowed in sandbox.`);
  }

  return new Promise((resolve, reject) => {
    const processId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logs: string[] = [];
    const timeoutMs = options?.timeoutMs || 60000;

    // Use shell for command resolution on Windows/POSIX
    const child = spawn(cleanCmd, {
      cwd: root,
      shell: true,
      env: {
        ...process.env,
        CI: "true",
        FORCE_COLOR: "1",
        PATH: process.env.PATH,
      },
    });

    const rec: RunningProcess = {
      processId,
      projectId,
      command: cleanCmd,
      startedAt: new Date().toISOString(),
      process: child,
      logs,
      status: "running",
      exitCode: null,
    };

    activeProcesses.set(processId, rec);

    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (rec.status === "running") {
          rec.status = "killed";
          child.kill("SIGKILL");
          const msg = `\n[Process timed out after ${timeoutMs / 1000}s and was terminated]`;
          logs.push(msg);
          options?.onLog?.(msg);
        }
      }, timeoutMs);
    }

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString("utf-8");
      logs.push(text);
      if (logs.length > 2000) logs.shift(); // Cap log memory
      options?.onLog?.(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString("utf-8");
      logs.push(text);
      if (logs.length > 2000) logs.shift();
      options?.onLog?.(text);
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      rec.status = "exited";
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      rec.exitCode = code;
      rec.status = rec.status === "killed" ? "killed" : "exited";
      resolve({ processId, exitCode: code, logs });
    });
  });
}

export function killWorkspaceProcess(processId: string): boolean {
  const p = activeProcesses.get(processId);
  if (!p || p.status !== "running") return false;
  p.status = "killed";
  p.process.kill("SIGKILL");
  return true;
}

export function getRunningProcessLogs(processId: string): string[] | null {
  const p = activeProcesses.get(processId);
  return p ? p.logs : null;
}
