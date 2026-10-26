import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileCode2,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  AlertTriangle,
  FolderTree,
  Download,
  MonitorPlay,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { aiClient } from "@/lib/ai/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SourceEditor } from "@/components/build/SourceEditor";
import {
  parseBlueprintDirectoryTree,
  synchronizeBlueprintAndArtifacts,
  inferArtifactTypeAndLanguage,
} from "@/lib/build/blueprintDirectoryModel";
import { BlueprintFileExplorer } from "./BlueprintFileExplorer";
import { ZipExportModal } from "./ZipExportModal";
import { EnvConfigPanel } from "./EnvConfigPanel";
import {
  buildExportManifest,
  createProjectZipArchive,
  triggerBrowserZipDownload,
  type ZipExportManifest,
} from "@/lib/build/zipExportService";
import {
  deriveProjectEnvironmentReport,
  type TargetProjectEnvInputMap,
} from "@/lib/build/envConfigService";
import {
  generateTargetProjectBaseline,
} from "@/lib/build/targetProjectBaseline";
import {
  targetProjectEnvStorage,
  type TargetProjectVarStatus,
} from "@/lib/storage/targetProjectEnvStorage";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";
import { VSCodeIDEWorkspace } from "@/components/build/VSCodeIDEWorkspace";
import { InAppPreviewModal } from "@/components/build/InAppPreviewModal";
import { Code2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export const BuildStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject: selectedProject, projects, loading, updateActiveProject } = useActiveProject();
  const selectedProjectId = selectedProject?.id || "";

  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [generatingPath, setGeneratingPath] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // ZIP Export State
  const [zipModalOpen, setZipModalOpen] = useState<boolean>(false);
  const [zipManifest, setZipManifest] = useState<ZipExportManifest | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Target Project Local Environment Settings
  const [targetEnvVersion, setTargetEnvVersion] = useState<number>(0);

  // In-App Live Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  // View Mode: Modern VS Code IDE workspace vs. Classic Blueprint Explorer
  const [workspaceMode, setWorkspaceMode] = useState<"ide" | "classic">("ide");

  // Full-Screen IDE Workspace state
  const [isFullscreenIDE, setIsFullscreenIDE] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isFullscreen: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isFullscreen === "boolean") {
        setIsFullscreenIDE(customEvent.detail.isFullscreen);
      }
    };
    window.addEventListener("nova-ide-fullscreen-change", handleFullscreenChange);
    return () => {
      window.removeEventListener("nova-ide-fullscreen-change", handleFullscreenChange);
    };
  }, []);

  // Parse canonical Blueprint Directory Model
  const blueprintModel = useMemo(() => {
    const raw = selectedProject?.blueprint?.folderStructure || "";
    const rootName = selectedProject?.name.toLowerCase().replace(/\s+/g, "-") || "project";
    return parseBlueprintDirectoryTree(raw, rootName);
  }, [selectedProject]);

  // Self-heal and migrate persisted blueprint folderStructure if baseline files were missing
  useEffect(() => {
    if (!selectedProject || !selectedProject.blueprint) return;
    const structure = selectedProject.blueprint.folderStructure || "";
    if (!structure.includes(".env.example") || !structure.includes(".gitignore")) {
      const lines = structure.split("\n");
      const rootLine = lines[0];
      const rest = lines.slice(1);
      const additions: string[] = [];
      if (!structure.includes(".env.example")) additions.push("├── .env.example");
      if (!structure.includes(".gitignore")) additions.push("├── .gitignore");
      
      const newStructure = [rootLine, ...additions, ...rest].join("\n");
      const updatedBlueprint = {
        ...selectedProject.blueprint,
        folderStructure: newStructure,
      };

      updateActiveProject({ blueprint: updatedBlueprint }).catch((e) =>
        console.warn("[BuildStudio] Failed to auto-persist baseline blueprint structure:", e)
      );
    }
  }, [selectedProject?.id, selectedProject?.blueprint?.folderStructure]);

  // Synchronize Blueprint tree with actual artifacts
  const { tree: synchronizedTree, additionalArtifacts, stats } = useMemo(() => {
    return synchronizeBlueprintAndArtifacts(blueprintModel, artifacts);
  }, [blueprintModel, artifacts]);

  // Load stored artifacts for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setArtifacts([]);
      return;
    }

    let isMounted = true;

    artifactStorage.list(selectedProjectId).then((storedArtifacts) => {
      if (!isMounted) return;

      // Ensure every file in blueprint has at least a planned artifact record
      const existingMap = new Map(storedArtifacts.map((a) => [a.path.replace(/\\/g, "/"), a]));
      const newArtifactsToSave: BuildArtifact[] = [];

      // Baseline generator for target projects (guarantees runnable structure matching user intent)
      const baselineFiles = selectedProject
        ? generateTargetProjectBaseline(selectedProject, selectedProject.blueprint)
        : {};

      for (const filePath of blueprintModel.files) {
        if (!existingMap.has(filePath)) {
          const { type, language } = inferArtifactTypeAndLanguage(filePath);
          let initialContent = baselineFiles[filePath] || `// ${filePath}\n// Planned from Blueprint Studio\n`;

          if (filePath === ".env.example" && selectedProject) {
            const report = deriveProjectEnvironmentReport(selectedProject);
            initialContent = report.envExampleContent;
          } else if (filePath === ".gitignore" && selectedProject) {
            const report = deriveProjectEnvironmentReport(selectedProject);
            initialContent = report.gitignoreContent;
          }

          const isBaselineProvided = Boolean(baselineFiles[filePath]);
          const newArt: BuildArtifact = {
            id: `art_${selectedProjectId}_${Math.random().toString(36).slice(2, 9)}`,
            projectId: selectedProjectId,
            path: filePath,
            type,
            purpose: `Blueprint-defined artifact for ${filePath}`,
            status: filePath.startsWith(".env") || filePath === ".gitignore" || isBaselineProvided ? "approved" : "planned",
            content: initialContent,
            language,
            dependencies: [],
            versions: [],
          };
          newArtifactsToSave.push(newArt);
          existingMap.set(filePath, newArt);
        }
      }

      if (newArtifactsToSave.length > 0) {
        Promise.all(newArtifactsToSave.map((a) => artifactStorage.save(a))).then((saved) => {
          if (!isMounted) return;
          const combined = [...storedArtifacts, ...saved];
          setArtifacts(combined);
          if (!selectedPath && combined.length > 0) {
            setSelectedPath(combined[0].path);
          }
        });
      } else {
        setArtifacts(storedArtifacts);
        if (!selectedPath && storedArtifacts.length > 0) {
          setSelectedPath(storedArtifacts[0].path);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, blueprintModel.files]);

  const selectedArtifact = useMemo(() => {
    if (!selectedPath) return null;
    const existing = artifacts.find((a) => a.path === selectedPath);
    if (existing) return existing;

    // If path is in blueprint but artifact wasn't loaded yet, supply virtual planned artifact
    if (blueprintModel.files.includes(selectedPath)) {
      const { type, language } = inferArtifactTypeAndLanguage(selectedPath);
      return {
        id: `virtual_${selectedPath}`,
        projectId: selectedProjectId,
        path: selectedPath,
        type,
        purpose: `Planned from Blueprint Studio: ${selectedPath}`,
        status: "planned" as const,
        content: `// ${selectedPath}\n// Planned in Blueprint Studio. Click "Synthesize with AI" to generate code.\n`,
        language,
        dependencies: [],
        versions: [],
      };
    }
    return null;
  }, [artifacts, selectedPath, blueprintModel.files, selectedProjectId]);

  const handleExpandBlueprintTree = async () => {
    if (!selectedProject?.blueprint) return;
    const safeName = selectedProject.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const isDataEng =
      selectedProject.category === "Data Engineering" ||
      selectedProject.name.toLowerCase().includes("pipeline") ||
      selectedProject.technologies?.some((t) => ["python", "duckdb", "parquet", "fastapi"].includes(t.toLowerCase()));

    // Use approved target architecture (Data Pipeline vs Web Application)
    const expandedStructure = isDataEng
      ? `${safeName}/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
├── Dockerfile
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── engine.py
│   ├── storage.py
│   └── test_engine.py
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── api/
│   │   └── client.ts
│   └── types/
│       └── pipeline.ts
└── data/
    └── schema.sql`
      : `${safeName}/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── api/
│   │   └── routes.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── service.ts
│   │   └── service.test.ts
│   └── db/
│       └── schema.sql`;

    const updatedBlueprint = {
      ...selectedProject.blueprint,
      folderStructure: expandedStructure,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateActiveProject({ blueprint: updatedBlueprint });
    } catch (err: any) {
      setErrorBanner(`Failed to update blueprint: ${err.message}`);
    }
  };

  const handleSyncFromBlueprint = async () => {
    if (!selectedProject?.blueprint) return;
    const existingMap = new Map(artifacts.map((a) => [a.path, a]));
    const merged: BuildArtifact[] = [];

    // 1. Reconcile blueprint files
    for (const filePath of blueprintModel.files) {
      const existing = existingMap.get(filePath);
      if (existing) {
        merged.push(existing);
      } else {
        const { type, language } = inferArtifactTypeAndLanguage(filePath);
        let initialContent = `// ${filePath}\n// Planned from Blueprint Studio\n`;

        if (filePath === ".env.example" && selectedProject) {
          const report = deriveProjectEnvironmentReport(selectedProject);
          initialContent = report.envExampleContent;
        } else if (filePath === ".gitignore" && selectedProject) {
          const report = deriveProjectEnvironmentReport(selectedProject);
          initialContent = report.gitignoreContent;
        }

        const newArt: BuildArtifact = {
          id: `art_${selectedProjectId}_${Math.random().toString(36).slice(2, 9)}`,
          projectId: selectedProjectId,
          path: filePath,
          type,
          purpose: `Planned artifact for ${filePath}`,
          status: filePath.startsWith(".env") || filePath === ".gitignore" ? "approved" : "planned",
          content: initialContent,
          language,
          dependencies: [],
          versions: [],
        };
        const saved = await artifactStorage.save(newArt);
        merged.push(saved);
      }
    }

    // 2. Preserve any previously generated or approved additional artifacts so work is never lost
    for (const a of artifacts) {
      if (!blueprintModel.files.includes(a.path)) {
        merged.push(a);
      }
    }

    setArtifacts(merged);
    if (!selectedPath && merged.length > 0) {
      setSelectedPath(merged[0].path);
    }
  };

  const handleGenerateSingle = async (path: string) => {
    if (!selectedProject?.blueprint) {
      setErrorBanner("Cannot generate code: Project blueprint is missing.");
      return;
    }
    let targetArt = artifacts.find((a) => a.path === path);
    if (!targetArt && selectedArtifact && selectedArtifact.path === path) {
      targetArt = await artifactStorage.save(selectedArtifact);
      setArtifacts((prev) => [...prev, targetArt!]);
    }
    if (!targetArt) return;

    setErrorBanner(null);
    setGeneratingPath(path);

    try {
      const fullProjectContext = `PROJECT INTENT & OBJECTIVE:
Name: ${selectedProject.name}
Category: ${selectedProject.category || "General"}
Objective: ${selectedProject.objective || "No objective provided"}
Description: ${selectedProject.description || "No description provided"}
Technologies: ${(selectedProject.technologies || []).join(", ")}

BLUEPRINT ARCHITECTURE OVERVIEW:
${selectedProject.blueprint.overview}

FEATURES & REQUIREMENTS:
MVP: ${(selectedProject.blueprint.features?.mvp || []).join("; ")}
Important: ${(selectedProject.blueprint.features?.important || []).join("; ")}

CRITICAL DIRECTIVE:
Implement the real functional requirements of the project. If this is a car game, interactive game, or specialized system, write the actual game loop, controls, mechanics, physics, and canvas rendering. Do not write a generic enterprise landing page!`;

      const response = await aiClient.generateFile({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        filePath: targetArt.path,
        purpose: targetArt.purpose,
        language: targetArt.language,
        contextText: fullProjectContext,
      });

      await artifactStorage.recordVersion(
        selectedProject.id,
        path,
        response.content,
        response.explanation || "AI synthesized code artifact",
        "ai"
      );

      const statusUpdated = await artifactStorage.updateStatus(selectedProject.id, path, "generated");
      setArtifacts((prev) => prev.map((a) => (a.path === path ? statusUpdated : a)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Code generation failed.";
      setErrorBanner(`AI generation error: ${msg}`);
    } finally {
      setGeneratingPath(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedProject?.blueprint) return;
    setGeneratingAll(true);
    setErrorBanner(null);

    // Generate across all files defined in the canonical blueprint
    for (const filePath of blueprintModel.files) {
      let art = artifacts.find((a) => a.path === filePath);
      if (!art) {
        const { type, language } = inferArtifactTypeAndLanguage(filePath);
        art = await artifactStorage.save({
          id: `art_${selectedProjectId}_${Math.random().toString(36).slice(2, 9)}`,
          projectId: selectedProjectId,
          path: filePath,
          type,
          purpose: `Planned artifact for ${filePath}`,
          status: "planned",
          content: `// ${filePath}\n`,
          language,
          dependencies: [],
          versions: [],
        });
        setArtifacts((prev) => [...prev, art!]);
      }

      if (art.status === "approved") continue;

      try {
        setGeneratingPath(art.path);
        const fullProjectContext = `PROJECT INTENT & OBJECTIVE:
Name: ${selectedProject.name}
Category: ${selectedProject.category || "General"}
Objective: ${selectedProject.objective || "No objective provided"}
Description: ${selectedProject.description || "No description provided"}
Technologies: ${(selectedProject.technologies || []).join(", ")}

BLUEPRINT ARCHITECTURE OVERVIEW:
${selectedProject.blueprint.overview}

FEATURES & REQUIREMENTS:
MVP: ${(selectedProject.blueprint.features?.mvp || []).join("; ")}
Important: ${(selectedProject.blueprint.features?.important || []).join("; ")}

CRITICAL DIRECTIVE:
Implement the real functional requirements of the project. If this is a car game, interactive game, or specialized system, write the actual game loop, controls, mechanics, physics, and canvas rendering. Do not write a generic enterprise landing page!`;

        const response = await aiClient.generateFile({
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          filePath: art.path,
          purpose: art.purpose,
          language: art.language,
          contextText: fullProjectContext,
        });

        await artifactStorage.recordVersion(
          selectedProject.id,
          art.path,
          response.content,
          response.explanation || "AI synthesized code artifact",
          "ai"
        );

        const statusUpdated = await artifactStorage.updateStatus(selectedProject.id, art.path, "generated");
        setArtifacts((prev) => prev.map((a) => (a.path === art!.path ? statusUpdated : a)));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error generating files.";
        setErrorBanner(`Batch generation paused: ${msg}`);
        break;
      }
    }
    setGeneratingPath(null);
    setGeneratingAll(false);
  };

  const handleSaveContent = async (path: string, newContent: string) => {
    if (!selectedProject) return;
    let target = artifacts.find((a) => a.path === path);
    if (!target && selectedArtifact) {
      target = await artifactStorage.save({ ...selectedArtifact, content: newContent });
      setArtifacts((prev) => [...prev, target!]);
      return;
    }
    const updated = await artifactStorage.recordVersion(
      selectedProject.id,
      path,
      newContent,
      "Manual edits in source editor",
      "user"
    );
    setArtifacts((prev) => prev.map((a) => (a.path === path ? updated : a)));
  };

  const handleApproveArtifact = async (path: string) => {
    if (!selectedProject) return;
    let target = artifacts.find((a) => a.path === path);
    if (!target && selectedArtifact) {
      target = await artifactStorage.save(selectedArtifact);
      setArtifacts((prev) => [...prev, target!]);
    }
    const updated = await artifactStorage.updateStatus(selectedProject.id, path, "approved");
    setArtifacts((prev) => prev.map((a) => (a.path === path ? updated : a)));
  };

  const handleCreateNewFile = async (path: string) => {
    if (!selectedProject) return;
    const cleanPath = path.replace(/^[/\\]+/, "");
    const { type, language } = inferArtifactTypeAndLanguage(cleanPath);
    const newArt: BuildArtifact = {
      id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: selectedProject.id,
      path: cleanPath,
      type,
      purpose: `Custom created file: ${cleanPath}`,
      status: "modified",
      content: `// ${cleanPath}\n`,
      language,
      dependencies: [],
      versions: [],
    };
    const saved = await artifactStorage.save(newArt);
    setArtifacts((prev) => [...prev, saved]);
    setSelectedPath(cleanPath);
  };

  const handleDeleteFile = async (path: string) => {
    if (!selectedProject) return;
    await artifactStorage.delete(selectedProject.id, path);
    setArtifacts((prev) => prev.filter((a) => a.path !== path));
    if (selectedPath === path) {
      setSelectedPath(null);
    }
  };

  const handleRestoreVersion = async (path: string, oldContent: string) => {
    if (!selectedProject) return;
    const restored = await artifactStorage.recordVersion(
      selectedProject.id,
      path,
      oldContent,
      "Restored prior version snapshot",
      "user"
    );
    setArtifacts((prev) => prev.map((a) => (a.path === path ? restored : a)));
  };

  const handleOpenZipModal = () => {
    if (!selectedProject) return;
    const manifest = buildExportManifest(selectedProject.name, blueprintModel, artifacts);
    setZipManifest(manifest);
    setZipModalOpen(true);
  };

  const targetEnvReport = useMemo(() => {
    if (!selectedProject) return null;
    const stored = targetProjectEnvStorage.get(selectedProject.id);
    const varMap: TargetProjectEnvInputMap = {};
    for (const [k, v] of Object.entries(stored.variables)) {
      varMap[k] = { value: v.value, status: v.status };
    }
    return deriveProjectEnvironmentReport(selectedProject, varMap);
  }, [selectedProject, targetEnvVersion]);

  const handleUpdateTargetVariable = (varName: string, value: string, status?: TargetProjectVarStatus) => {
    if (!selectedProject) return;
    targetProjectEnvStorage.setVariable(selectedProject.id, varName, value, status || "CONFIGURED");
    setTargetEnvVersion((v) => v + 1);
  };

  const handleApplyProviderMapping = (provider: "supabase" | "gemini") => {
    if (!selectedProject) return;
    if (provider === "supabase") {
      const supUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
      const supKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
      if (supUrl) {
        targetProjectEnvStorage.setVariable(selectedProject.id, "VITE_SUPABASE_URL", supUrl, "CONFIGURED");
      }
      if (supKey) {
        targetProjectEnvStorage.setVariable(selectedProject.id, "VITE_SUPABASE_ANON_KEY", supKey, "CONFIGURED");
      }
    } else if (provider === "gemini") {
      targetProjectEnvStorage.setVariable(selectedProject.id, "AI_PROVIDER", "gemini", "CONFIGURED");
      targetProjectEnvStorage.setVariable(selectedProject.id, "GEMINI_API_KEY", "your-gemini-api-key-here", "EXAMPLE ONLY");
    }
    setTargetEnvVersion((v) => v + 1);
  };

  const handleConfirmZipDownload = async (options?: { includeConfiguredEnv?: boolean; userConfirmationGranted?: boolean }) => {
    if (!selectedProject) return;
    setIsExportingZip(true);
    try {
      let configuredContent: string | undefined = undefined;
      if (options?.includeConfiguredEnv && options?.userConfirmationGranted) {
        // Derive configured content from genuine target project environment report
        configuredContent = targetEnvReport?.envConfiguredContent;
      }

      const manifest = buildExportManifest(selectedProject.name, blueprintModel, artifacts, {
        includeConfiguredEnv: options?.includeConfiguredEnv,
        userConfirmationGranted: options?.userConfirmationGranted,
        configuredEnvContent: configuredContent,
      });

      const result = await createProjectZipArchive(manifest);
      triggerBrowserZipDownload(result.blob, result.filename);
      setZipModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to package project ZIP.";
      setErrorBanner(`Archive Export Error: ${msg}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Build Studio…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <FileCode2 className="w-12 h-12 mx-auto text-foreground-muted" />
          <h2 className="font-display font-bold text-xl text-foreground">No Projects Available</h2>
          <p className="text-sm text-foreground-muted">
            Create a project first in Project Discovery to generate architecture blueprints and code artifacts.
          </p>
          <Button onClick={() => navigate("/discover")}>Create Project Now</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto animate-fadeIn", isFullscreenIDE && "space-y-0 max-w-none m-0 p-0")}>
      {/* Header — Hidden in Full-Screen IDE mode */}
      {!isFullscreenIDE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-[#70C84B]/20 text-[#153A52] rounded-tactile border border-border">
                BLUEPRINT SYNCHRONIZED
              </span>
              <span className="text-xs text-foreground-muted">Build Studio & Code Generation</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl text-foreground">
              Build Studio
            </h1>
            <p className="text-sm text-foreground-muted">
              Directory structure synchronized with Blueprint Studio. Synthesize code, inspect diffs, and approve artifacts.
            </p>
          </div>

          {/* Global Active Project Indicator & Workspace Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <CompactProjectIndicator />

            <div className="flex bg-surface rounded-tactile border-2 border-border p-0.5 shadow-hard-xs">
              <button
                onClick={() => setWorkspaceMode("ide")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
                  workspaceMode === "ide"
                    ? "bg-[#153A52] text-white"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>VS Code IDE</span>
              </button>
              <button
                onClick={() => setWorkspaceMode("classic")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
                  workspaceMode === "classic"
                    ? "bg-[#153A52] text-white"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Blueprint Explorer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Status & Overview Card — Hidden in Full-Screen IDE mode */}
      {!isFullscreenIDE && selectedProject && (
        <Card className="bg-surface shadow-hard border-2 border-border p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  Architecture Blueprint: {selectedProject.blueprint?.title || "No blueprint attached"}
                </span>
                {selectedProject.blueprint && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-secondary-soft text-secondary rounded-tactile border border-secondary/20">
                    {selectedProject.blueprint.techStack?.map((t) => t.tech).join(", ") || "TypeScript"}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted">
                {selectedProject.blueprint?.overview ||
                  "Create a blueprint first in Blueprint Studio to enable file plan generation."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono px-3 py-1.5 bg-[#FAF7ED] rounded-tactile border border-border">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-foreground-muted" />
                  <span>
                    Total: <strong>{stats.totalFiles}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-secondary" />
                  <span>
                    Generated: <strong>{stats.generated}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    Approved: <strong>{stats.approved}</strong>
                  </span>
                </div>
              </div>

              {selectedProject.blueprint ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSyncFromBlueprint}
                    icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                  >
                    Sync Blueprint
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateAll}
                    disabled={generatingAll || !!generatingPath || blueprintModel.files.length === 0}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    {generatingAll ? "Synthesizing All…" : "Synthesize All Files"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewModalOpen(true)}
                    icon={<MonitorPlay className="w-3.5 h-3.5 text-emerald-600" />}
                  >
                    Live Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenZipModal}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download ZIP
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => navigate(`/blueprint?project=${selectedProject.id}`)}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Create Blueprint
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Notice if Blueprint structure is incomplete or truncated — Hidden in Full-Screen IDE mode */}
      {!isFullscreenIDE && blueprintModel.isTruncatedOrExample && selectedProject?.blueprint && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-tactile flex flex-col sm:flex-row items-start justify-between gap-3 shadow-hard-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-display font-bold text-xs text-amber-950 block">
                Blueprint Directory Tree is Incomplete or Truncated ({blueprintModel.files.length} files detected)
              </span>
              <p className="text-xs font-sans text-amber-900 leading-relaxed">
                The folder structure defined in Blueprint Studio contains only {blueprintModel.files.length} canonical files and is missing standard architecture artifacts (such as HTML/CSS entries, API routing, and build configs). Click &ldquo;Upgrade to Approved Full Structure&rdquo; to populate the canonical architecture.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleExpandBlueprintTree}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Upgrade to Approved Full Structure
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/blueprint?project=${selectedProjectId}`)}
              icon={<FolderTree className="w-3.5 h-3.5" />}
            >
              Edit in Blueprint Studio
            </Button>
          </div>
        </div>
      )}

      {/* Error notification banner — Hidden in Full-Screen IDE mode */}
      {!isFullscreenIDE && errorBanner && (
        <div className="p-3 bg-red-50 border-2 border-red-500 rounded-tactile flex items-start gap-2 shadow-hard-sm animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-red-800 font-mono leading-relaxed">
            {errorBanner}
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-xs font-bold text-red-600 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Workbench: VS Code IDE Workspace OR Classic Explorer */}
      {workspaceMode === "ide" && selectedProject ? (
        <VSCodeIDEWorkspace
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          artifacts={artifacts}
          plannedPaths={blueprintModel.files}
          selectedPath={selectedPath}
          onSelectPath={(path) => setSelectedPath(path)}
          onSaveContent={handleSaveContent}
          onCreateFile={handleCreateNewFile}
          onDeleteFile={handleDeleteFile}
          onRegenerateFile={handleGenerateSingle}
          onApproveArtifact={handleApproveArtifact}
          onOpenZipModal={handleOpenZipModal}
          onOpenLivePreview={() => setPreviewModalOpen(true)}
          onOpenUIStudio={() => setPreviewModalOpen(true)}
          isGenerating={Boolean(generatingPath)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
          {/* Left: Blueprint-Synchronized File Explorer */}
          <div className="lg:col-span-4 xl:col-span-4 bg-surface border-2 border-border rounded-tactile p-3.5 shadow-hard-sm">
            <BlueprintFileExplorer
              blueprintModel={blueprintModel}
              synchronizedTree={synchronizedTree}
              additionalArtifacts={additionalArtifacts}
              selectedPath={selectedPath}
              onSelectPath={(path) => setSelectedPath(path)}
              stats={stats}
            />
          </div>

          {/* Right: Source Editor & Artifact Controls */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col">
            {selectedArtifact ? (
              <div className="space-y-2 h-full flex flex-col">
                {/* Breadcrumb Bar */}
                <div className="px-3 py-1.5 bg-[#FAF7ED] border-2 border-border rounded-tactile text-xs font-mono text-foreground-muted flex items-center gap-1.5 truncate">
                  <span className="font-bold text-foreground">{blueprintModel.rootName}</span>
                  <span>/</span>
                  <span className="text-foreground font-semibold truncate">{selectedArtifact.path}</span>
                </div>

                <div className="flex-1">
                  <SourceEditor
                    artifact={selectedArtifact}
                    onSaveContent={handleSaveContent}
                    onApproveArtifact={handleApproveArtifact}
                    onRegenerateFile={handleGenerateSingle}
                    onRestoreVersion={handleRestoreVersion}
                    isGenerating={generatingPath === selectedArtifact.path}
                  />
                </div>
              </div>
            ) : (
              <Card className="h-full flex items-center justify-center p-12 text-center bg-surface border-2 border-border">
                <div className="space-y-2 text-foreground-muted">
                  <FileCode2 className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm font-bold">No file artifact selected</p>
                  <p className="text-xs">
                    Select a file from the blueprint tree on the left to inspect, edit, or generate code.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Target Project Environment & Secret Health Panel (Placed after code workspace; hidden in Full-Screen IDE mode) */}
      {!isFullscreenIDE && (
        <div id="target-project-env-section">
          {selectedProject && targetEnvReport && (
            <EnvConfigPanel
              report={targetEnvReport}
              projectId={selectedProject.id}
              onOpenSettings={() => navigate("/settings")}
              onUpdateTargetVariable={handleUpdateTargetVariable}
              onApplyProviderMapping={handleApplyProviderMapping}
            />
          )}
        </div>
      )}

      {/* In-App Live Preview Modal (Does not navigate to UI Studio; preserves IDE editor state) */}
      {selectedProject && (
        <InAppPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          projectName={selectedProject.name}
          artifacts={artifacts}
        />
      )}

      {/* ZIP Export Confirmation & Manifest Modal */}
      <ZipExportModal
        isOpen={zipModalOpen}
        onClose={() => setZipModalOpen(false)}
        manifest={zipManifest}
        onConfirmDownload={handleConfirmZipDownload}
        isExporting={isExportingZip}
        envReport={targetEnvReport}
        onNavigateToConfig={() => {
          const el = document.getElementById("target-project-env-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />
    </div>
  );
};
