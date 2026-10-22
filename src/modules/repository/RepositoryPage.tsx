import React, { useState, useEffect } from "react";
import {
  RotateCw,
  Search,
  AlertCircle,
  Copy,
  Layers,
  FolderTree,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  realFsClient,
  type RepoScanResult,
  type FileInspectionResult,
} from "@/lib/repository/realFsClient";
import { RepoTreeExplorer } from "./RepoTreeExplorer";
import { FileInspectionPanel } from "./FileInspectionPanel";
import { RepoArchitectureMapView } from "./RepoArchitectureMapView";

export const RepositoryPage: React.FC = () => {
  const [scanResult, setScanResult] = useState<RepoScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // View mode: Real tree explorer vs. Architecture overview
  const [viewMode, setViewMode] = useState<"tree" | "architecture">("tree");

  // Selection & inspection
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>("src/app/App.tsx");
  const [inspection, setInspection] = useState<FileInspectionResult | null>(null);
  const [inspecting, setInspecting] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const [showExcluded, setShowExcluded] = useState<boolean>(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    runScan();
  }, [showExcluded]);

  useEffect(() => {
    if (selectedFilePath) {
      inspectFile(selectedFilePath);
    }
  }, [selectedFilePath]);

  const runScan = async () => {
    setLoading(true);
    setScanError(null);
    try {
      const res = await realFsClient.scan({
        includeIgnored: showExcluded,
        includeHidden: true,
      });
      setScanResult(res);
      // Default to main file if none selected
      if (!selectedFilePath && res.files.length > 0) {
        const defaultFile =
          res.files.find((f) => f.path.includes("App.tsx") || f.path.includes("main.tsx")) ||
          res.files[0];
        setSelectedFilePath(defaultFile.path);
      }
    } catch (err: any) {
      setScanError(err.message || "Failed to scan repository filesystem.");
    } finally {
      setLoading(false);
    }
  };

  const inspectFile = async (filePath: string) => {
    setInspecting(true);
    try {
      const res = await realFsClient.inspectFile(filePath);
      setInspection(res);
    } catch (err: any) {
      console.error("File inspection failed:", err);
    } finally {
      setInspecting(false);
    }
  };

  const handleCopyTreeAsMarkdown = () => {
    if (!scanResult) return;
    const lines = [
      `# Repository File Structure: ${scanResult.rootPath}`,
      `Total Files: ${scanResult.totalFilesCount} | Directories: ${scanResult.totalDirectoriesCount}`,
      "",
      "```",
    ];

    const sortedFiles = [...scanResult.files]
      .filter((f) => (showExcluded ? true : !f.isExcluded))
      .map((f) => f.path)
      .sort();

    for (const f of sortedFiles.slice(0, 300)) {
      lines.push(f);
    }
    if (sortedFiles.length > 300) {
      lines.push(`... and ${sortedFiles.length - 300} more files`);
    }
    lines.push("```");

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const formatTotalSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-tactile-sm bg-accent-yellow-soft border border-border text-[11px] font-mono font-semibold text-foreground mb-2">
            <span>REPOSITORY INTELLIGENCE & ARCHITECTURE EXPLORER</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Real Repository Explorer
          </h1>
          <p className="text-sm font-sans text-foreground-muted mt-1">
            Live filesystem inspection of {scanResult ? scanResult.rootPath : "F:\\project nova"}. Verified from disk, protecting secret credentials and displaying live architectural topology.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyTreeAsMarkdown}
            icon={<Copy className="w-3.5 h-3.5" />}
          >
            {copiedNotice ? "Copied Markdown!" : "Copy Tree"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={runScan}
            disabled={loading}
            icon={<RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            {loading ? "Scanning…" : "Refresh Filesystem"}
          </Button>
        </div>
      </div>

      {scanError && (
        <div className="p-4 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Metrics Bar */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 bg-surface border-2 border-border shadow-hard-sm">
            <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block">
              Total Files
            </span>
            <span className="font-display font-bold text-lg text-foreground">
              {scanResult.totalFilesCount}
            </span>
          </Card>
          <Card className="p-3 bg-surface border-2 border-border shadow-hard-sm">
            <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block">
              Directories
            </span>
            <span className="font-display font-bold text-lg text-foreground">
              {scanResult.totalDirectoriesCount}
            </span>
          </Card>
          <Card className="p-3 bg-surface border-2 border-border shadow-hard-sm">
            <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block">
              Disk Footprint
            </span>
            <span className="font-display font-bold text-lg text-foreground">
              {formatTotalSize(scanResult.totalSizeBytes)}
            </span>
          </Card>
          <Card className="p-3 bg-surface border-2 border-border shadow-hard-sm">
            <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block">
              Scan Source
            </span>
            <span className="font-display font-bold text-sm text-foreground truncate block">
              Local Loopback
            </span>
          </Card>
        </div>
      )}

      {/* View Toggle Tabs */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-border pb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`px-3 py-1.5 rounded-tactile font-display font-bold text-xs flex items-center gap-1.5 transition-all ${
              viewMode === "tree"
                ? "bg-[#70C84B] text-[#153A52] shadow-hard-sm"
                : "bg-surface hover:bg-[#FAF7ED] text-foreground border border-border"
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            Repository Tree & Source Viewer
          </button>
          <button
            type="button"
            onClick={() => setViewMode("architecture")}
            className={`px-3 py-1.5 rounded-tactile font-display font-bold text-xs flex items-center gap-1.5 transition-all ${
              viewMode === "architecture"
                ? "bg-[#70C84B] text-[#153A52] shadow-hard-sm"
                : "bg-surface hover:bg-[#FAF7ED] text-foreground border border-border"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            End-to-End Architecture Map
          </button>
        </div>

        {viewMode === "tree" && (
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files or paths..."
                className="pl-8 pr-3 py-1 bg-[#FAF7ED] border border-border rounded text-xs text-foreground focus:outline-none focus:bg-surface focus:ring-1 focus:ring-foreground"
              />
            </div>

            {/* Extension filter */}
            <select
              value={selectedExtension}
              onChange={(e) => setSelectedExtension(e.target.value)}
              className="bg-[#FAF7ED] border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Extensions</option>
              <option value=".ts">.ts</option>
              <option value=".tsx">.tsx</option>
              <option value=".json">.json</option>
              <option value=".md">.md</option>
              <option value=".css">.css</option>
            </select>

            {/* Show Excluded Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer text-foreground-muted select-none">
              <input
                type="checkbox"
                checked={showExcluded}
                onChange={(e) => setShowExcluded(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span>Include ignored (dist, node_modules)</span>
            </label>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === "tree" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
          {/* Left: Tree Explorer */}
          <div className="lg:col-span-5 bg-surface border-2 border-border rounded-tactile p-3 shadow-hard-sm">
            {scanResult ? (
              <RepoTreeExplorer
                files={scanResult.files}
                directories={scanResult.directories}
                selectedFilePath={selectedFilePath}
                onSelectFile={(path) => setSelectedFilePath(path)}
                searchQuery={searchQuery}
                showExcluded={showExcluded}
                selectedExtension={selectedExtension}
              />
            ) : (
              <div className="p-8 text-center text-xs font-mono text-foreground-muted">
                {loading ? "Scanning repository structure..." : "No repository scanned."}
              </div>
            )}
          </div>

          {/* Right: Inspection & Source Preview */}
          <div className="lg:col-span-7 flex flex-col">
            <FileInspectionPanel
              inspection={inspection}
              loading={inspecting}
              onNavigateToFile={(targetPath) => {
                if (scanResult?.files.some((f) => f.path.includes(targetPath))) {
                  const match = scanResult.files.find((f) => f.path.includes(targetPath));
                  if (match) setSelectedFilePath(match.path);
                }
              }}
            />
          </div>
        </div>
      ) : (
        /* Architecture View */
        scanResult && (
          <RepoArchitectureMapView
            layers={scanResult.architectureOverview.layers}
            nodes={scanResult.architectureOverview.nodes}
            onSelectNode={(filePath) => {
              setSelectedFilePath(filePath);
              setViewMode("tree");
            }}
          />
        )
      )}
    </div>
  );
};
