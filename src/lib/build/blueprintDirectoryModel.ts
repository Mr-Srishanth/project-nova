import type { BuildArtifact, ArtifactType } from "@/types/artifact";

export interface BlueprintParsedNode {
  name: string;
  path: string; // normalized relative path from project root (e.g. "src/app/App.tsx", or "" for root)
  isDir: boolean;
  children: BlueprintParsedNode[];
}

export interface BlueprintDirectoryModel {
  rootName: string;
  files: string[]; // all leaf file paths relative to root (e.g. ["index.html", "src/app/App.tsx", "package.json"])
  directories: string[]; // all directory paths (e.g. ["src", "src/app", "src/components"])
  tree: BlueprintParsedNode;
  rawText: string;
  isTruncatedOrExample: boolean;
}

export interface SynchronizedFileNode {
  name: string;
  path: string; // relative path
  isDir: boolean;
  artifact?: BuildArtifact;
  status: "planned" | "generated" | "approved" | "modified" | "failed" | "unplanned";
  purpose?: string;
  language?: string;
  children: SynchronizedFileNode[];
  // Aggregated status counts for directory
  stats?: {
    total: number;
    planned: number;
    generated: number;
    approved: number;
    failed: number;
  };
}

/**
 * Accurately measures the visual column position where the item name begins.
 * For example:
 * "├── src/"           -> branch marker at index 0..2, name starts at 4 -> depth = 0
 * "│   ├── app/"       -> prefix length 4 before second branch marker -> depth = 1
 * "├── index.html"     -> branch marker at index 0..2, name starts at 4 -> depth = 0
 */
function getLineDepth(rawLine: string): { depth: number; name: string } {
  // Find where the branch indicator (├── or └──) or first word starts
  // Match leading tree connectors: spaces, tabs, │, ├, └, ─
  let index = 0;
  let level = 0;

  while (index < rawLine.length) {
    const ch = rawLine[index];
    if (ch === "├" || ch === "└") {
      // Branch marker found! The level is how many 4-char indentation blocks preceded it
      return {
        depth: level,
        name: rawLine.slice(index).replace(/^[├└]──\s*/, "").trim(),
      };
    }
    if (ch === "│" || ch === " ") {
      // Check if 4 characters of indentation
      if (rawLine.slice(index, index + 4).match(/^[│\s]{3,4}/)) {
        level++;
        index += 4;
        continue;
      }
    }
    index++;
  }

  // Fallback if no ├── symbol (plain indentation)
  const trimmed = rawLine.trimStart();
  const spaces = rawLine.length - trimmed.length;
  return {
    depth: Math.floor(spaces / 4),
    name: trimmed,
  };
}

/**
 * Parses ASCII or indented directory trees (e.g. blueprint.folderStructure).
 */
export function parseBlueprintDirectoryTree(
  treeText: string,
  fallbackRootName = "project"
): BlueprintDirectoryModel {
  const lines = treeText
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      rootName: fallbackRootName,
      files: [],
      directories: [],
      tree: { name: fallbackRootName, path: "", isDir: true, children: [] },
      rawText: treeText,
      isTruncatedOrExample: true,
    };
  }

  // Detect root name from first line if it looks like a folder (ends with / or \)
  let firstLine = lines[0].replace(/^[│├└─\s]+/, "").trim();
  let rootName = fallbackRootName;
  let startIndex = 0;

  if (firstLine.endsWith("/") || firstLine.endsWith("\\")) {
    rootName = firstLine.replace(/[\/\\]$/, "").trim() || fallbackRootName;
    startIndex = 1;
  }

  const allFiles: string[] = [];
  const allDirs = new Set<string>();

  // Stack of active directory segments at each depth
  // stack[depth] = segmentName
  const dirStack: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const { depth, name: rawName } = getLineDepth(rawLine);

    let name = rawName;
    if (!name || name === "..." || name.startsWith("...")) continue;

    // Remove comments
    name = name.split(/\s+#|\s+\/\//)[0].trim();

    const isDir = name.endsWith("/") || name.endsWith("\\");
    const cleanName = name.replace(/[\/\\]$/, "");

    // Truncate directory stack to current depth
    dirStack.length = depth;

    if (isDir) {
      dirStack[depth] = cleanName;
      const dirPath = dirStack.slice(0, depth + 1).join("/");
      allDirs.add(dirPath);
    } else {
      const parentDir = dirStack.slice(0, depth).join("/");
      const filePath = parentDir ? `${parentDir}/${cleanName}` : cleanName;
      allFiles.push(filePath);
      if (parentDir) {
        allDirs.add(parentDir);
      }
    }
  }

  // Check if structure looks truncated or incomplete (< 5 files or missing file extensions or has ellipsis)
  const isTruncatedOrExample =
    treeText.includes("...") ||
    allFiles.length < 5 ||
    !allFiles.some((f) => f.includes("."));

  // Build root parsed tree
  const rootNode: BlueprintParsedNode = {
    name: rootName,
    path: "",
    isDir: true,
    children: [],
  };

  const nodeMap = new Map<string, BlueprintParsedNode>();
  nodeMap.set("", rootNode);

  // Ensure directories exist in tree
  const sortedDirs = Array.from(allDirs).sort(
    (a, b) => a.split("/").length - b.split("/").length
  );
  for (const dirPath of sortedDirs) {
    const parts = dirPath.split("/");
    const dirName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const dirNode: BlueprintParsedNode = {
      name: dirName,
      path: dirPath,
      isDir: true,
      children: [],
    };
    nodeMap.set(dirPath, dirNode);

    const parentNode = nodeMap.get(parentPath) || rootNode;
    if (!parentNode.children.some((c) => c.name === dirName && c.isDir)) {
      parentNode.children.push(dirNode);
    }
  }

  // Place files in tree
  for (const filePath of allFiles) {
    const parts = filePath.split("/");
    const fileName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const fileNode: BlueprintParsedNode = {
      name: fileName,
      path: filePath,
      isDir: false,
      children: [],
    };

    const parentNode = nodeMap.get(parentPath) || rootNode;
    if (!parentNode.children.some((c) => c.name === fileName && !c.isDir)) {
      parentNode.children.push(fileNode);
    }
  }

  return {
    rootName,
    files: allFiles,
    directories: Array.from(allDirs),
    tree: rootNode,
    rawText: treeText,
    isTruncatedOrExample,
  };
}

/**
 * Merges Blueprint Directory Model with current Build Artifacts.
 */
export function synchronizeBlueprintAndArtifacts(
  blueprintModel: BlueprintDirectoryModel,
  artifacts: BuildArtifact[]
): {
  tree: SynchronizedFileNode;
  additionalArtifacts: BuildArtifact[];
  stats: {
    totalFiles: number;
    planned: number;
    generated: number;
    approved: number;
    failed: number;
    additional: number;
  };
} {
  const artifactMap = new Map<string, BuildArtifact>();
  for (const a of artifacts) {
    artifactMap.set(a.path.replace(/\\/g, "/"), a);
  }

  const blueprintPathSet = new Set(blueprintModel.files);

  // Identify additional artifacts not in blueprint
  const additionalArtifacts: BuildArtifact[] = [];
  for (const a of artifacts) {
    const norm = a.path.replace(/\\/g, "/");
    if (!blueprintPathSet.has(norm)) {
      additionalArtifacts.push(a);
    }
  }

  let totalFiles = 0;
  let countPlanned = 0;
  let countGenerated = 0;
  let countApproved = 0;
  let countFailed = 0;

  // Recursively map Blueprint tree to SynchronizedFileNode
  function mapNode(bpNode: BlueprintParsedNode): SynchronizedFileNode {
    if (bpNode.isDir) {
      const children = bpNode.children.map(mapNode);

      // Aggregate stats
      const stats = {
        total: 0,
        planned: 0,
        generated: 0,
        approved: 0,
        failed: 0,
      };

      for (const c of children) {
        if (!c.isDir) {
          stats.total++;
          if (c.status === "planned") stats.planned++;
          if (c.status === "generated" || c.status === "modified") stats.generated++;
          if (c.status === "approved") stats.approved++;
          if (c.status === "failed") stats.failed++;
        } else if (c.stats) {
          stats.total += c.stats.total;
          stats.planned += c.stats.planned;
          stats.generated += c.stats.generated;
          stats.approved += c.stats.approved;
          stats.failed += c.stats.failed;
        }
      }

      return {
        name: bpNode.name,
        path: bpNode.path,
        isDir: true,
        children,
        status: stats.approved === stats.total && stats.total > 0 ? "approved" : "planned",
        stats,
      };
    }

    // Leaf file
    totalFiles++;
    const artifact = artifactMap.get(bpNode.path);

    let status: SynchronizedFileNode["status"] = "planned";
    if (artifact) {
      if (artifact.status === "approved" || artifact.status === "applied") {
        status = "approved";
        countApproved++;
      } else if (artifact.status === "failed") {
        status = "failed";
        countFailed++;
      } else if (
        artifact.status === "generated" ||
        (artifact.content && !artifact.content.includes("// Generated placeholder") && !artifact.content.includes("// Planned"))
      ) {
        status = "generated";
        countGenerated++;
      } else {
        status = "planned";
        countPlanned++;
      }
    } else {
      countPlanned++;
    }

    return {
      name: bpNode.name,
      path: bpNode.path,
      isDir: false,
      artifact,
      status,
      purpose: artifact?.purpose,
      language: artifact?.language,
      children: [],
    };
  }

  const synchronizedTree = mapNode(blueprintModel.tree);

  return {
    tree: synchronizedTree,
    additionalArtifacts,
    stats: {
      totalFiles,
      planned: countPlanned,
      generated: countGenerated,
      approved: countApproved,
      failed: countFailed,
      additional: additionalArtifacts.length,
    },
  };
}

/**
 * Infers artifact type and language from a blueprint file path
 */
export function inferArtifactTypeAndLanguage(filePath: string): {
  type: ArtifactType;
  language: string;
} {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".py")) {
    return { type: lower.includes("test") ? "test" : "backend", language: "python" };
  }
  if (lower.includes("gitignore") || lower.includes(".env")) {
    return { type: "config", language: "text" };
  }
  if (lower.endsWith(".txt") && lower.includes("requirements")) {
    return { type: "config", language: "text" };
  }
  if (lower.endsWith("dockerfile")) {
    return { type: "config", language: "dockerfile" };
  }
  if (lower.includes("test.") || lower.includes(".spec.")) {
    return { type: "test", language: "typescript" };
  }
  if (lower.endsWith(".sql")) {
    return { type: "schema", language: "sql" };
  }
  if (lower.includes("/api/") || lower.includes("routes.") || lower.includes("controller.")) {
    return { type: "api", language: "typescript" };
  }
  if (lower.endsWith(".json") || lower.includes("config.") || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return { type: "config", language: ext === "json" ? "json" : "yaml" };
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return { type: "docs", language: "markdown" };
  }
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.includes("/ui/") || lower.includes("/components/")) {
    return { type: "frontend", language: "typescript" };
  }
  if (lower.endsWith(".html")) {
    return { type: "frontend", language: "html" };
  }
  if (lower.endsWith(".css")) {
    return { type: "frontend", language: "css" };
  }

  return { type: "backend", language: "typescript" };
}
