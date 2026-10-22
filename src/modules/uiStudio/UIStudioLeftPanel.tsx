import React, { useState, useMemo } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  Layers,
  Palette,
  AlertTriangle,
  Route,
  CheckCircle2,
  Code,
  Search,
  ChevronRight,
  ChevronDown,
  Image,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";
import type { ApplicationValidationReport } from "@/types/uiStudio";

export type LeftPanelSection = "files" | "pages" | "components" | "design" | "assets" | "health";

interface UIStudioLeftPanelProps {
  activeTab: LeftPanelSection;
  setActiveTab: (t: LeftPanelSection) => void;
  artifacts: BuildArtifact[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  detectedRoutes: string[];
  selectedRoute: string;
  onSelectRoute: (r: string) => void;
  validationReport: ApplicationValidationReport | null;
  onPreviewTokenChange?: (prop: string, val: string) => void;
  onApplyTokenChange?: (prop: string, val: string) => Promise<void>;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Record<string, TreeNode>;
  artifact?: BuildArtifact;
}

export const UIStudioLeftPanel: React.FC<UIStudioLeftPanelProps> = ({
  activeTab,
  setActiveTab,
  artifacts,
  selectedFilePath,
  onSelectFile,
  detectedRoutes,
  selectedRoute,
  onSelectRoute,
  validationReport,
  onPreviewTokenChange,
  onApplyTokenChange,
}) => {
  const [fileFilter, setFileFilter] = useState<string>("");
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({
    primaryColor: "#70C84B",
    accentColor: "#2563EB",
    navyColor: "#0A0D14",
    ivoryColor: "#FFFDF5",
    fontFamily: "Inter, sans-serif",
    borderRadius: "8px",
    spacingUnit: "16px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  });
  const [isApplyingToken, setIsApplyingToken] = useState<boolean>(false);
  const [tokenDirty, setTokenDirty] = useState<boolean>(false);

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  // Build hierarchical file tree from canonical artifacts
  const fileTree = useMemo(() => {
    const root: Record<string, TreeNode> = {};

    for (const art of artifacts) {
      if (fileFilter && !art.path.toLowerCase().includes(fileFilter.toLowerCase())) {
        continue;
      }
      const parts = art.path.split("/");
      let currentLevel = root;
      let curPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        curPath = curPath ? `${curPath}/${part}` : part;
        const isFile = i === parts.length - 1;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            path: curPath,
            isDir: !isFile,
            children: {},
            artifact: isFile ? art : undefined,
          };
        }
        currentLevel = currentLevel[part].children;
      }
    }
    return root;
  }, [artifacts, fileFilter]);

  const componentModules = useMemo(
    () =>
      artifacts.filter(
        (a) =>
          a.path.endsWith(".tsx") ||
          a.path.endsWith(".jsx") ||
          a.path.endsWith(".ts") ||
          a.path.endsWith(".js")
      ),
    [artifacts]
  );

  const assetFiles = useMemo(
    () =>
      artifacts.filter(
        (a) =>
          a.path.endsWith(".png") ||
          a.path.endsWith(".jpg") ||
          a.path.endsWith(".svg") ||
          a.path.endsWith(".ico") ||
          a.path.endsWith(".css") ||
          a.path.endsWith(".json")
      ),
    [artifacts]
  );

  const navSections = [
    { id: "files" as const, label: "Files", count: artifacts.length, icon: <Folder className="w-3.5 h-3.5" /> },
    { id: "pages" as const, label: "Pages", count: detectedRoutes.length, icon: <Route className="w-3.5 h-3.5" /> },
    { id: "components" as const, label: "Components", count: componentModules.length, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "design" as const, label: "Design", count: null, icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "assets" as const, label: "Assets", count: assetFiles.length, icon: <Image className="w-3.5 h-3.5" /> },
    {
      id: "health" as const,
      label: "Health",
      count: validationReport && validationReport.errors.length > 0 ? validationReport.errors.length : null,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      isError: Boolean(validationReport && validationReport.errors.length > 0),
    },
  ];

  const getFileBadge = (art?: BuildArtifact) => {
    if (!art) return null;
    if (art.status === "approved") {
      return <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">saved</span>;
    }
    return <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">active</span>;
  };

  // Render tree node recursively
  const renderTreeNodes = (nodes: Record<string, TreeNode>, depth = 0) => {
    const entries = Object.values(nodes).sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return entries.map((node) => {
      const isDir = node.isDir;
      const isCollapsed = Boolean(collapsedDirs[node.path]);
      const isSelected = selectedFilePath === node.path;

      if (isDir) {
        return (
          <div key={node.path} className="flex flex-col select-none">
            <button
              type="button"
              onClick={() => toggleDir(node.path)}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className="flex items-center gap-1.5 py-1 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
              {isCollapsed ? <Folder className="w-3.5 h-3.5 shrink-0 text-amber-600" /> : <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
              <span className="truncate">{node.name}</span>
            </button>
            {!isCollapsed && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          type="button"
          onClick={() => onSelectFile(node.path)}
          style={{ paddingLeft: `${depth * 12 + 18}px` }}
          className={`flex items-center justify-between py-1 px-2 text-xs rounded transition-colors text-left group ${
            isSelected
              ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
              : "text-foreground hover:bg-muted/50"
          }`}
          title={node.path}
        >
          <div className="flex items-center gap-1.5 truncate">
            <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate font-mono text-[11px]">{node.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isSelected ? (
              <span className="text-[9px] font-mono uppercase bg-white/20 px-1 rounded text-white">edit</span>
            ) : (
              getFileBadge(node.artifact)
            )}
          </div>
        </button>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border border-border rounded-md shadow-2xs overflow-hidden">
      {/* Navigation Rail Grid */}
      <div className="border-b border-border bg-[#FFFDF5] p-1.5 grid grid-cols-6 gap-1 shrink-0">
        {navSections.map((sec) => {
          const isActive = activeTab === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveTab(sec.id)}
              title={`${sec.label} Section`}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-colors text-center ${
                isActive
                  ? "bg-white text-foreground font-bold shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-0.5">
                {sec.icon}
                {sec.count !== null && (
                  <span
                    className={`text-[8px] font-mono px-0.5 rounded font-bold ${
                      sec.isError ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sec.count}
                  </span>
                )}
              </div>
              <span className="text-[9px] mt-0.5 truncate tracking-tight">{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* FILES TAB */}
        {activeTab === "files" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Workspace ({artifacts.length} Files)
              </span>
            </div>

            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-muted-foreground absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter files..."
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full text-xs py-1 pl-6 pr-2 border border-border rounded bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary font-sans"
              />
            </div>

            <div className="space-y-0.5 pt-1">
              {renderTreeNodes(fileTree)}
            </div>
          </div>
        )}

        {/* PAGES TAB */}
        {activeTab === "pages" && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-muted-foreground px-1 py-1 tracking-wider">
              Application Routes ({detectedRoutes.length})
            </div>
            {detectedRoutes.map((route) => (
              <button
                key={route}
                onClick={() => onSelectRoute(route)}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded transition-colors text-left ${
                  selectedRoute === route
                    ? "bg-primary/10 text-foreground font-bold border border-primary/20"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Route className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono">{route}</span>
                </div>
                {selectedRoute === route && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {/* COMPONENTS TAB */}
        {activeTab === "components" && (
          <div className="space-y-2 p-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Modules ({componentModules.length})
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("files")}
                className="text-[10px] text-primary hover:underline font-semibold"
              >
                Tree View
              </button>
            </div>

            <div className="space-y-1">
              {componentModules.map((c) => {
                const isSelected = selectedFilePath === c.path;
                return (
                  <div
                    key={c.path}
                    onClick={() => onSelectFile(c.path)}
                    className={`p-2 border rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/60 bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Code className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground font-mono truncate">
                          {c.path.split("/").pop()}
                        </span>
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                        {c.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{c.path}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DESIGN TAB */}
        {activeTab === "design" && (
          <div className="space-y-3 p-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Design System Tokens
              </span>
              {tokenDirty && (
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-semibold">Modified</span>
              )}
            </div>

            {/* Color Swatches */}
            <div className="space-y-2 border border-border p-2.5 rounded bg-card">
              <div className="text-[11px] font-bold text-foreground">Color Palette</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Primary</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={tokenDrafts.primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, primaryColor: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--primary", val);
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-border p-0"
                    />
                    <input
                      type="text"
                      value={tokenDrafts.primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, primaryColor: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--primary", val);
                      }}
                      className="w-full text-[10px] font-mono px-1 py-0.5 border border-border rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Accent</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={tokenDrafts.accentColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, accentColor: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--accent", val);
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-border p-0"
                    />
                    <input
                      type="text"
                      value={tokenDrafts.accentColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, accentColor: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--accent", val);
                      }}
                      className="w-full text-[10px] font-mono px-1 py-0.5 border border-border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography & Spacing */}
            <div className="border border-border p-2.5 rounded bg-card space-y-2">
              <div className="text-[11px] font-bold text-foreground">Typography & Sizing</div>
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] text-muted-foreground block">Font Family</label>
                  <select
                    value={tokenDrafts.fontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTokenDrafts((prev) => ({ ...prev, fontFamily: val }));
                      setTokenDirty(true);
                      onPreviewTokenChange?.("fontFamily", val);
                    }}
                    className="w-full text-[11px] px-1.5 py-1 border border-border rounded bg-white text-foreground"
                  >
                    <option value="Inter, sans-serif">Inter (Modern Clean)</option>
                    <option value="system-ui, sans-serif">System Default</option>
                    <option value="'Fira Code', monospace">Fira Code (Technical)</option>
                    <option value="Georgia, serif">Georgia (Editorial)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Border Radius</label>
                    <select
                      value={tokenDrafts.borderRadius}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, borderRadius: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--radius", val);
                      }}
                      className="w-full text-[11px] px-1 py-1 border border-border rounded bg-white text-foreground"
                    >
                      <option value="0px">None (0px)</option>
                      <option value="4px">Small (4px)</option>
                      <option value="8px">Medium (8px)</option>
                      <option value="16px">Large (16px)</option>
                      <option value="9999px">Full (Pill)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Base Spacing</label>
                    <select
                      value={tokenDrafts.spacingUnit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenDrafts((prev) => ({ ...prev, spacingUnit: val }));
                        setTokenDirty(true);
                        onPreviewTokenChange?.("--spacing", val);
                      }}
                      className="w-full text-[11px] px-1 py-1 border border-border rounded bg-white text-foreground"
                    >
                      <option value="12px">Compact (12px)</option>
                      <option value="16px">Standard (16px)</option>
                      <option value="24px">Relaxed (24px)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Actions */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                disabled={!tokenDirty || isApplyingToken}
                onClick={async () => {
                  if (!onApplyTokenChange) return;
                  setIsApplyingToken(true);
                  try {
                    await onApplyTokenChange("designTokens", JSON.stringify(tokenDrafts));
                    setTokenDirty(false);
                  } finally {
                    setIsApplyingToken(false);
                  }
                }}
                className="flex-1 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded shadow-2xs hover:bg-primary/90 disabled:opacity-40"
              >
                {isApplyingToken ? "Saving..." : "Apply Tokens"}
              </button>
              <button
                type="button"
                disabled={!tokenDirty}
                onClick={() => {
                  setTokenDrafts({
                    primaryColor: "#70C84B",
                    accentColor: "#2563EB",
                    navyColor: "#0A0D14",
                    ivoryColor: "#FFFDF5",
                    fontFamily: "Inter, sans-serif",
                    borderRadius: "8px",
                    spacingUnit: "16px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  });
                  setTokenDirty(false);
                }}
                className="px-2.5 py-1.5 border border-border bg-white text-muted-foreground hover:text-foreground text-xs rounded disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ASSETS TAB */}
        {activeTab === "assets" && (
          <div className="space-y-2 p-1">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Static Assets & Configurations ({assetFiles.length})
            </div>
            <div className="space-y-1">
              {assetFiles.map((a) => (
                <div
                  key={a.path}
                  onClick={() => onSelectFile(a.path)}
                  className={`p-2 border rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedFilePath === a.path
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Image className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-mono truncate">{a.path}</span>
                  </div>
                  <span className="text-[9px] uppercase px-1 rounded bg-muted text-muted-foreground font-mono shrink-0">
                    {a.path.split(".").pop()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HEALTH TAB */}
        {activeTab === "health" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Health Audit
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  validationReport?.isVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {validationReport?.isVerified ? "Verified" : "Pending Verification"}
              </span>
            </div>

            {validationReport && (
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="p-1.5 border border-border rounded bg-muted/30">
                  <div className="text-[9px] text-muted-foreground font-semibold">Static</div>
                  <div className="text-xs font-bold text-foreground font-mono">
                    {validationReport.breakdown?.staticChecks ?? 100}%
                  </div>
                </div>
                <div className="p-1.5 border border-border rounded bg-muted/30">
                  <div className="text-[9px] text-muted-foreground font-semibold">Build</div>
                  <div className="text-xs font-bold text-foreground font-mono">
                    {validationReport.breakdown?.buildChecks ?? 100}%
                  </div>
                </div>
                <div className="p-1.5 border border-border rounded bg-muted/30">
                  <div className="text-[9px] text-muted-foreground font-semibold">Archetype</div>
                  <div className="text-xs font-bold text-foreground font-mono">
                    {validationReport.breakdown?.archetypeCompliance ?? 100}%
                  </div>
                </div>
                <div className="p-1.5 border border-border rounded bg-muted/30">
                  <div className="text-[9px] text-muted-foreground font-semibold">Runtime</div>
                  <div className="text-xs font-bold text-foreground font-mono">
                    {validationReport.isVerified ? `${validationReport.breakdown?.runtimeHealth}%` : "Pending"}
                  </div>
                </div>
              </div>
            )}

            {validationReport && validationReport.errors.length > 0 ? (
              validationReport.errors.map((err, i) => (
                <div key={i} className="p-2.5 border border-red-200 bg-red-50 rounded space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err.type.toUpperCase()}: {err.file || "General"}</span>
                  </div>
                  <p className="text-[11px] text-red-700">{err.message}</p>
                  {err.suggestedFix && (
                    <div className="text-[10px] text-red-600 bg-red-100/60 p-1.5 rounded font-mono">
                      Fix: {err.suggestedFix}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <div className="text-xs font-bold text-foreground">All Criteria Verified</div>
                <p className="text-[11px]">Workspace structure, archetype compliance, and runtime sanity checks passed.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
