import fs from "node:fs";
import path from "node:path";

export interface RepoFileInfo {
  path: string; // Relative to root
  name: string;
  sizeBytes: number;
  lastModified: string;
  extension: string;
  isExcluded: boolean;
  exclusionReason?: string;
}

export interface RepoDirectoryInfo {
  path: string; // Relative to root ("" for root)
  name: string;
  filesCount: number;
  subdirectoriesCount: number;
  isExcluded: boolean;
}

export interface RepoScanResult {
  rootPath: string;
  directories: RepoDirectoryInfo[];
  files: RepoFileInfo[];
  totalFilesCount: number;
  totalDirectoriesCount: number;
  totalSizeBytes: number;
  scannedAt: string;
  architectureOverview: RepoArchitectureMap;
}

export interface RepoArchitectureMap {
  layers: Array<{
    id: string;
    title: string;
    description: string;
    badge: string;
    nodeIds: string[];
  }>;
  nodes: Array<{
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
    dependencies: string[]; // paths or node ids it imports/depends on
  }>;
}

// Security: paths that should not have their raw content returned
const SECRET_OR_PROTECTED_FILES = [
  /^\.env(\..+)?$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.key$/i,
  /\.pem$/i,
  /\.pfx$/i,
];

// Folders usually excluded from primary analysis
const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cache",
  ".next",
  "coverage",
]);

/**
 * Validates that requested relative path stays strictly within the rootPath
 */
export function assertSafePath(rootPath: string, relativePath: string): string {
  const normalizedRoot = path.resolve(rootPath);
  const targetPath = path.resolve(normalizedRoot, relativePath);

  // Security: check path containment to prevent path traversal
  if (!targetPath.startsWith(normalizedRoot)) {
    throw new Error("Access denied: path traversal attempt detected outside authorized repository root.");
  }

  return targetPath;
}

/**
 * Recursively scans the repository up to maxDepth and maxFiles
 */
export function scanRealRepository(
  rootDirectory: string,
  options?: {
    includeIgnored?: boolean;
    includeHidden?: boolean;
    maxFiles?: number;
    maxDepth?: number;
  }
): RepoScanResult {
  const root = path.resolve(rootDirectory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Repository root does not exist or is not a directory: ${root}`);
  }

  const includeIgnored = options?.includeIgnored ?? false;
  const includeHidden = options?.includeHidden ?? true;
  const maxFiles = options?.maxFiles ?? 2500;
  const maxDepth = options?.maxDepth ?? 12;

  const directories: RepoDirectoryInfo[] = [];
  const files: RepoFileInfo[] = [];
  let totalSizeBytes = 0;
  const visitedRealPaths = new Set<string>();

  function walk(currentDir: string, currentRelDir: string, depth: number) {
    if (depth > maxDepth || files.length >= maxFiles) return;

    // Guard against symlink loops
    try {
      const real = fs.realpathSync(currentDir);
      if (visitedRealPaths.has(real)) return;
      visitedRealPaths.add(real);
    } catch {
      return;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return; // Gracefully handle unreadable directories
    }

    let dirFilesCount = 0;
    let dirSubdirsCount = 0;

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const name = entry.name;
      const isHidden = name.startsWith(".") && name !== "." && name !== "..";
      if (!includeHidden && isHidden) continue;

      const fullEntryPath = path.join(currentDir, name);
      const relPath = currentRelDir ? `${currentRelDir}/${name}` : name;
      const isIgnoredDir = entry.isDirectory() && DEFAULT_IGNORED_DIRS.has(name.toLowerCase());

      if (entry.isDirectory()) {
        dirSubdirsCount++;
        directories.push({
          path: relPath,
          name,
          filesCount: 0,
          subdirectoriesCount: 0,
          isExcluded: isIgnoredDir,
        });

        // If it's an ignored directory (e.g. node_modules, .git), we record the folder exists
        // but avoid walking its subchildren unless explicitly enabled
        if (!isIgnoredDir || includeIgnored) {
          walk(fullEntryPath, relPath, depth + 1);
        }
      } else if (entry.isFile()) {
        dirFilesCount++;
        try {
          const stats = fs.statSync(fullEntryPath);
          totalSizeBytes += stats.size;
          const ext = path.extname(name).toLowerCase();

          files.push({
            path: relPath,
            name,
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: ext,
            isExcluded: isIgnoredDir || ext === ".lock" || ext === ".lockb",
            exclusionReason: isIgnoredDir
              ? "Inside ignored folder"
              : undefined,
          });
        } catch {
          // Skip file if permission/stat error
        }
      }
    }
  }

  // Record root
  directories.push({
    path: "",
    name: path.basename(root),
    filesCount: 0,
    subdirectoriesCount: 0,
    isExcluded: false,
  });

  walk(root, "", 0);

  // Generate End-to-End Architecture Overview
  const architectureOverview = buildArchitectureOverview(files, root);

  return {
    rootPath: root,
    directories,
    files,
    totalFilesCount: files.length,
    totalDirectoriesCount: directories.length,
    totalSizeBytes,
    scannedAt: new Date().toISOString(),
    architectureOverview,
  };
}

/**
 * Inspects a file's content safely. Redacts .env values.
 */
export function inspectRealFile(
  rootDirectory: string,
  relativePath: string
): {
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
} {
  const filePath = assertSafePath(rootDirectory, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${relativePath}`);
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    throw new Error(`Cannot inspect directory as file: ${relativePath}`);
  }

  const fileName = path.basename(filePath);
  const isSecret = SECRET_OR_PROTECTED_FILES.some((re) => re.test(fileName));

  // Determine if binary
  const ext = path.extname(fileName).toLowerCase();
  const binaryExtensions = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".tar", ".gz", ".exe", ".dll", ".wasm", ".bin"
  ]);

  if (binaryExtensions.has(ext)) {
    return {
      path: relativePath,
      name: fileName,
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
      isSecretOrRedacted: false,
      content: `[Binary content - ${stat.size} bytes. Binary files are not rendered as raw text.]`,
      mimeType: "application/octet-stream",
      imports: [],
      exports: [],
      relatedTests: [],
    };
  }

  // Read raw text
  let raw = "";
  try {
    // Read up to 512KB
    const buf = Buffer.alloc(Math.min(stat.size, 512 * 1024));
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    raw = buf.toString("utf-8");
  } catch (err: any) {
    raw = `[Error reading file content: ${err.message}]`;
  }

  // Redact .env content: show key names with [REDACTED_VALUE]
  if (isSecret || fileName.startsWith(".env")) {
    const lines = raw.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx);
        return `${key}=[REDACTED_SECRET_VALUE]`;
      }
      return "[REDACTED]";
    });
    raw = lines.join("\n");
  }

  // Parse basic imports and exports if code file
  const imports: string[] = [];
  const exports: string[] = [];
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    const importRegex = /(?:import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))/g;
    let match;
    while ((match = importRegex.exec(raw)) !== null) {
      const src = match[1] || match[2];
      if (src && !imports.includes(src)) imports.push(src);
    }

    const exportRegex = /export\s+(?:const|function|class|type|interface|default)\s+([a-zA-Z0-9_$]+)/g;
    while ((match = exportRegex.exec(raw)) !== null) {
      if (match[1] && !exports.includes(match[1])) exports.push(match[1]);
    }
  }

  // Find related tests if file is not a test
  const relatedTests: string[] = [];
  const baseWithoutExt = relativePath.replace(/\.(tsx?|jsx?)$/, "");
  const testCandidate1 = `${baseWithoutExt}.test.ts`;
  const testCandidate2 = `${baseWithoutExt}.test.tsx`;
  if (fs.existsSync(path.resolve(rootDirectory, testCandidate1))) {
    relatedTests.push(testCandidate1);
  }
  if (fs.existsSync(path.resolve(rootDirectory, testCandidate2))) {
    relatedTests.push(testCandidate2);
  }

  return {
    path: relativePath,
    name: fileName,
    sizeBytes: stat.size,
    lastModified: stat.mtime.toISOString(),
    isSecretOrRedacted: isSecret,
    content: raw,
    mimeType: "text/plain",
    imports,
    exports,
    relatedTests,
  };
}

/**
 * Builds high-level architecture overview based on actual repository contents
 */
function buildArchitectureOverview(files: RepoFileInfo[], rootDir: string): RepoArchitectureMap {
  const nodes: RepoArchitectureMap["nodes"] = [];
  const filePaths = new Set(files.map((f) => f.path.replace(/\\/g, "/")));

  function addNode(
    id: string,
    name: string,
    relPath: string,
    category: RepoArchitectureMap["nodes"][0]["category"],
    summary: string,
    dependencies: string[]
  ) {
    if (filePaths.has(relPath) || fs.existsSync(path.resolve(rootDir, relPath))) {
      nodes.push({ id, name, path: relPath, category, summary, dependencies });
    }
  }

  // 1. Entry & Config
  addNode("entry_html", "index.html", "index.html", "entrypoint", "Vite HTML host template and viewport container", []);
  addNode("entry_client", "main.tsx", "src/main.tsx", "entrypoint", "React client entrypoint mounting DOM and Global styles", ["src/app/App.tsx"]);
  addNode("vite_config", "vite.config.ts", "vite.config.ts", "config", "Vite build pipeline & path alias '@' resolver", []);
  addNode("pkg_json", "package.json", "package.json", "config", "Node project manifest, workspace scripts & dependencies", []);

  // 2. Gateway Server
  addNode("server_gateway", "gateway.ts", "server/gateway.ts", "gateway", "Local AI & FS Gateway on loopback port 4000", ["@google/genai", "src/types"]);

  // 3. Application Routing & Shell
  addNode("app_root", "App.tsx", "src/app/App.tsx", "page", "Application root hosting AppRouter", ["src/app/router.tsx"]);
  addNode("app_router", "router.tsx", "src/app/router.tsx", "page", "Central route dispatcher registering all 20+ modules", ["src/components/layout/AppShell.tsx"]);
  addNode("app_shell", "AppShell.tsx", "src/components/layout/AppShell.tsx", "component", "Top-level responsive navigation shell & sidebar", []);

  // 4. Core Feature Modules
  addNode("mod_discovery", "DiscoveryPage.tsx", "src/modules/discovery/DiscoveryPage.tsx", "module", "Project Discovery & Intelligent Idea Understanding Engine", ["src/lib/ai/client.ts"]);
  addNode("mod_blueprint", "BlueprintStudioPage.tsx", "src/modules/blueprint/BlueprintStudioPage.tsx", "module", "Architecture Blueprint Studio with SVG topologies", ["src/lib/blueprintDefaults.ts"]);
  addNode("mod_build", "BuildStudioPage.tsx", "src/modules/build/BuildStudioPage.tsx", "module", "Artifact Build & Code Generation Studio", ["src/lib/build/pathValidator.ts"]);
  addNode("mod_quality", "QualityEnginePage.tsx", "src/modules/quality/QualityEnginePage.tsx", "module", "Static, Security, and Code Quality Analysis", ["src/lib/quality/staticAnalysis.ts"]);
  addNode("mod_repository", "RepositoryPage.tsx", "src/modules/repository/RepositoryPage.tsx", "module", "Repository Explorer & Architecture Intelligence", ["src/lib/repository/realFsService.ts"]);
  addNode("mod_settings", "SettingsPage.tsx", "src/modules/settings/SettingsPage.tsx", "module", "System Settings, Supabase Status & AI Health", ["src/lib/supabase/client.ts", "src/lib/ai/client.ts"]);

  // 5. Libraries & Storage
  addNode("lib_ai_client", "client.ts", "src/lib/ai/client.ts", "module", "Client adapter communicating with AI & FS Gateway", ["server/gateway.ts"]);
  addNode("lib_supabase", "client.ts", "src/lib/supabase/client.ts", "storage", "Supabase PostgreSQL client & authentication provider", ["@supabase/supabase-js"]);
  addNode("lib_project_storage", "projectStorage.ts", "src/lib/storage/projectStorage.ts", "storage", "Dual-mode persistence (Supabase Cloud + Local Storage fallback)", ["src/lib/supabase/client.ts"]);

  const layers: RepoArchitectureMap["layers"] = [
    {
      id: "layer_presentation",
      title: "Presentation & Routing",
      description: "React client, AppShell, and feature pages",
      badge: "Frontend UI",
      nodeIds: ["entry_html", "entry_client", "app_root", "app_router", "app_shell"],
    },
    {
      id: "layer_features",
      title: "ProjectNova Studios & Modules",
      description: "Discovery, Blueprint, Build, Quality, and Repository Studios",
      badge: "Domain Modules",
      nodeIds: ["mod_discovery", "mod_blueprint", "mod_build", "mod_quality", "mod_repository", "mod_settings"],
    },
    {
      id: "layer_services",
      title: "Storage Adapters & Local Gateway",
      description: "Loopback server gateway, Supabase DB, and AI client adapters",
      badge: "Services & Gateway",
      nodeIds: ["server_gateway", "lib_ai_client", "lib_supabase", "lib_project_storage"],
    },
    {
      id: "layer_config",
      title: "Configuration & Build Pipeline",
      description: "Vite bundler, TypeScript compiler, and package manifest",
      badge: "Tooling & Infra",
      nodeIds: ["vite_config", "pkg_json"],
    },
  ];

  return { layers, nodes };
}
