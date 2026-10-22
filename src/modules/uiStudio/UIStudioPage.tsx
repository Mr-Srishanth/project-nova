import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Monitor,
  Tablet,
  Smartphone,
  Play,
  Square,
  RotateCcw,
  Download,
  Hammer,
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  RefreshCw,
  Maximize,
  Minimize,
  Save,
  Undo2,
  Redo2,
  Eye,
  Code2,
  SplitSquareHorizontal,
  FlaskConical,
  ExternalLink,
  X,
  CheckCircle2,
  FolderTree,
  MessageSquare,
  Sliders,
  History,
  Palette,
  Activity,
  Route as RouteIcon,
  MousePointerClick,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type {
  AIEditPlan,
  AIConversationMessage,
  UIStudioNotification,
  PreviewBuildResult,
  ApplicationValidationReport,
} from "@/types/uiStudio";
import type { OperationHistoryEntry } from "@/types/uiStudioHistory";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { uiStudioHistoryStorage } from "@/lib/storage/uiStudioHistoryStorage";
import { uiChatSessionStorage, type UIChatSession } from "@/lib/storage/uiChatSessionStorage";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";
import { validateApplicationTarget } from "@/lib/validation/applicationValidator";
import { planAIEdits } from "@/lib/uiStudio/aiEditEngine";
import { StudioExplorer } from "./StudioExplorer";
import { ElementInspector } from "./ElementInspector";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { OperationHistoryView } from "./OperationHistoryView";
import { InAppNotificationBanner } from "./InAppNotificationBanner";
import type { InspectedElementData, InspectorChange } from "@/types/inspector";
import {
  resolveSourceArtifactForElement,
  applyStyleToProject,
  validateCssValue,
} from "@/lib/uiStudio/inspectorEngine";
import { PreviewSessionController, type PreviewSessionSnapshot } from "@/lib/uiStudio/previewSession";
import { StudioDocumentManager, type FileSaveStatus } from "@/lib/uiStudio/studioDocuments";
import { useProjectOpener } from "@/lib/uiStudio/useProjectOpener";
import { generateTargetProjectBaseline } from "@/lib/build/targetProjectBaseline";
import {
  buildExportManifest,
  createProjectZipArchive,
  triggerBrowserZipDownload,
} from "@/lib/build/zipExportService";
import { parseBlueprintDirectoryTree } from "@/lib/build/blueprintDirectoryModel";
import { MonacoCodeEditor } from "@/components/build/MonacoCodeEditor";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

type StudioViewport = "desktop" | "tablet" | "mobile" | "small";
type CenterMode = "code" | "preview" | "split";
type LeftSection = "files" | "pages" | "design" | "health";
type RightTab = "ai" | "inspector" | "history";
type MobileTab = "workspace" | "files" | "assistant" | "inspector";

const VIEWPORTS: Array<{ id: StudioViewport; label: string; width: number | null; Icon: any }> = [
  { id: "desktop", label: "Desktop · 1440px", width: 1440, Icon: Monitor },
  { id: "tablet", label: "Tablet · 768px", width: 768, Icon: Tablet },
  { id: "mobile", label: "Mobile · 390px", width: 390, Icon: Smartphone },
  { id: "small", label: "Small mobile · 320px", width: 320, Icon: Smartphone },
];

const STAGE_LABELS: Record<PreviewSessionSnapshot["stage"], string> = {
  idle: "Idle",
  building: "Building",
  loading: "Loading",
  ready: "Ready",
  build_error: "Build Failed",
  runtime_error: "Runtime Error",
  load_timeout: "Load Timeout",
  mount_timeout: "Mount Timeout",
  stopped: "Stopped",
};

interface PreviewDoc {
  buildId: string;
  html: string;
}

export const UIStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");
  const { activeProject, setActiveProjectId: setGlobalActiveProjectId } = useActiveProject();

  // --- Projects -------------------------------------------------------------
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projectIdParam || activeProject?.id || null
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // --- Document manager (single edit -> save pipeline) -----------------------
  const managerRef = useRef<StudioDocumentManager | null>(null);
  if (!managerRef.current) managerRef.current = new StudioDocumentManager(artifactStorage);
  const manager = managerRef.current;
  const [docTick, setDocTick] = useState(0);
  useEffect(() => manager.subscribe(() => setDocTick((t) => t + 1)), [manager]);

  const projState = selectedProjectId ? manager.getProjectState(selectedProjectId) : null;
  const filesList = useMemo(
    () => (projState ? [...projState.files.values()].sort((a, b) => a.path.localeCompare(b.path)) : []),
    // docTick: the manager mutates project state in place; the subscription
    // tick is what invalidates these derived views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projState, docTick]
  );
  const savedArtifacts = useMemo(
    () => (selectedProjectId ? manager.getSavedArtifacts(selectedProjectId) : []),
    // projState identity changes on every manager emit; saved content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProjectId, projState, docTick]
  );

  // --- Editor state -----------------------------------------------------------
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const tabsByProjectRef = useRef<Record<string, { open: string[]; active: string | null }>>({});
  const [centerMode, setCenterMode] = useState<CenterMode>("split");
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // --- Layout -----------------------------------------------------------------
  const [leftSection, setLeftSection] = useState<LeftSection>("files");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(264);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("ai");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isFocusPreview, setIsFocusPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("workspace");
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // --- Preview session ----------------------------------------------------------
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<PreviewSessionController | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new PreviewSessionController({
      sendPing: (buildId) => {
        iframeRef.current?.contentWindow?.postMessage({ type: "PREVIEW_PING", buildId }, "*");
      },
      onChange: (snap) => setPreviewSnap(snap),
    });
  }
  const session = sessionRef.current;
  const [previewSnap, setPreviewSnap] = useState<PreviewSessionSnapshot>(() => session.getSnapshot());
  const [currentDoc, setCurrentDoc] = useState<PreviewDoc | null>(null);
  const [fallbackDoc, setFallbackDoc] = useState<PreviewDoc | null>(null);
  const [showingFallback, setShowingFallback] = useState(false);
  const [lastBuildResult, setLastBuildResult] = useState<PreviewBuildResult | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [viewport, setViewport] = useState<StudioViewport>("desktop");
  const [zoom, setZoom] = useState<number>(100);
  const [selectedRoute, setSelectedRoute] = useState("/");
  const currentDocRef = useRef<PreviewDoc | null>(null);
  currentDocRef.current = currentDoc;
  const lastBuildKeyRef = useRef<string>("");

  // --- Inspector ----------------------------------------------------------------
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<InspectedElementData | null>(null);
  const [inspectorChanges, setInspectorChanges] = useState<InspectorChange[]>([]);
  const [inspectorRedoStack, setInspectorRedoStack] = useState<InspectorChange[]>([]);

  // --- AI assistant ---------------------------------------------------------------
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"edit" | "auto" | "plan" | "ask">("edit");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [activePlan, setActivePlan] = useState<AIEditPlan | null>(null);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const activeOperationIdRef = useRef<string | null>(null);
  activeOperationIdRef.current = activeOperationId;
  const [conversationHistory, setConversationHistory] = useState<AIConversationMessage[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);

  // --- History / validation / notifications ---------------------------------------
  const [historyEntries, setHistoryEntries] = useState<OperationHistoryEntry[]>([]);
  const [testReport, setTestReport] = useState<ApplicationValidationReport | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [notifications, setNotifications] = useState<UIStudioNotification[]>([]);

  const pushNotification = useCallback(
    (type: UIStudioNotification["type"], title: string, message: string, actionLabel?: string, onAction?: () => void) => {
      const newNotif: UIStudioNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
        actionLabel,
        onAction,
      };
      setNotifications((prev) => [...prev.slice(-3), newNotif]);
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // --- Load project list ------------------------------------------------------------
  useEffect(() => {
    projectStorage.list().then(async (list) => {
      let activeList = list;
      if (activeList.length === 0) {
        const defaultProj = await projectStorage.create({
          name: "NitroPulse Car Game",
          description: "2D Canvas retro car racing game with high-speed physics, dynamic obstacles, and responsive controls.",
          objective: "Deliver a playable retro racing simulation with dynamic obstacles and high-score tracking.",
          category: "Developer Tool",
          technologies: ["React", "TypeScript", "HTML5 Canvas"],
        });
        activeList = [defaultProj];
      }
      setProjects(activeList);
      if (activeList.length > 0) {
        const targetId =
          projectIdParam && activeList.some((p) => p.id === projectIdParam)
            ? projectIdParam
            : activeProject && activeList.some((p) => p.id === activeProject.id)
            ? activeProject.id
            : activeList[0].id;
        setSelectedProjectId((prev) => prev || targetId);
        setGlobalActiveProjectId(targetId, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  // --- Chat sessions ------------------------------------------------------------------
  const loadChatSessions = useCallback(async (projId: string) => {
    const sessions = await uiChatSessionStorage.list(projId);
    if (sessions.length > 0) {
      const latest = sessions[0];
      setActiveChatSessionId(latest.id);
      setConversationHistory(latest.messages);
    } else {
      const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const initialSession: UIChatSession = {
        id: newId,
        projectId: projId,
        title: "Session 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      await uiChatSessionStorage.save(initialSession);
      setActiveChatSessionId(newId);
      setConversationHistory([]);
    }
  }, []);

  const persistChatMessages = useCallback(
    async (messages: AIConversationMessage[]) => {
      if (!selectedProjectId || !activeChatSessionId) return;
      const existing = await uiChatSessionStorage.get(activeChatSessionId);
      const updated: UIChatSession = {
        id: activeChatSessionId,
        projectId: selectedProjectId,
        title: existing?.title || `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages,
      };
      await uiChatSessionStorage.save(updated);
    },
    [selectedProjectId, activeChatSessionId]
  );

  const handleStartNewChatSession = useCallback(async () => {
    if (!selectedProjectId) return;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession: UIChatSession = {
      id: newId,
      projectId: selectedProjectId,
      title: `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    await uiChatSessionStorage.save(newSession);
    setActiveChatSessionId(newId);
    setConversationHistory([]);
    setActivePlan(null);
    setActiveOperationId(null);
    pushNotification("info", "New Chat Session", "Started fresh conversation thread.");
  }, [selectedProjectId, pushNotification]);

  // --- Open project in the document manager --------------------------------------------
  // The open is triggered by the *resolved project record* via useProjectOpener,
  // not by the id alone: selectedProjectId can be set (URL param / global active
  // project) before projectStorage.list() resolves, and an id-keyed effect ran
  // too early, found no record, and never ran again — leaving the project
  // unopened and unseeded (Rev 0, no files). The opener fires as soon as the
  // record arrives, exactly once per selection.
  const openSelectedProject = useCallback(
    async (project: Project, isCurrent: () => boolean) => {
      const projectId = project.id;
      await manager.openProject(projectId);
      // Seed any missing baseline files (never overwrites saved content).
      const baseline = generateTargetProjectBaseline(project, project.blueprint);
      const state = manager.getProjectState(projectId);
      if (state) {
        const missing: BuildArtifact[] = [];
        for (const [path, content] of Object.entries(baseline)) {
          if (!state.files.has(path)) {
            missing.push({
              id: `art_${projectId}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
              projectId,
              path,
              type: path.includes("app") || path.endsWith(".tsx") ? "frontend" : "config",
              purpose: `Baseline for ${path}`,
              status: "approved",
              content,
              language: path.endsWith(".tsx") || path.endsWith(".ts") ? "typescript" : "text",
              dependencies: [],
              versions: [],
            });
          }
        }
        if (missing.length > 0) await manager.seedFiles(projectId, missing);
      }
      if (!isCurrent()) return;
      const hist = await uiStudioHistoryStorage.list(projectId);
      setHistoryEntries(hist);
      await loadChatSessions(projectId);
      const savedTabs = tabsByProjectRef.current[projectId];
      const entryPath = manager.getProjectState(projectId)?.files.has("src/app/App.tsx")
        ? "src/app/App.tsx"
        : manager.getProjectState(projectId)?.files.keys().next().value || null;
      setOpenTabs(savedTabs?.open?.length ? savedTabs.open : entryPath ? [entryPath] : []);
      setSelectedFilePath(savedTabs?.active || entryPath);
      setSelectedElement(null);
      setInspectorChanges([]);
      setInspectorRedoStack([]);
      setActivePlan(null);
      setActiveOperationId(null);
      setCurrentDoc(null);
      setFallbackDoc(null);
      setShowingFallback(false);
      setLastBuildResult(null);
      lastBuildKeyRef.current = "";
    },
    [manager, loadChatSessions]
  );
  useProjectOpener(selectedProject, openSelectedProject);

  // Persist the tab strip per project so switching back restores it.
  useEffect(() => {
    if (selectedProjectId) {
      tabsByProjectRef.current[selectedProjectId] = { open: openTabs, active: selectedFilePath };
    }
  }, [selectedProjectId, openTabs, selectedFilePath]);

  // --- Preview build orchestration ---------------------------------------------------------
  const startBuild = useCallback(() => {
    if (!selectedProject || !selectedProjectId || !projState) return;
    const buildId = session.nextBuildId(projState.revision);
    const result = buildTargetProjectPreviewHtml(selectedProject.name, savedArtifacts, {
      selectedRoute,
      buildId,
    });
    setLastBuildResult(result);
    session.beginBuild(buildId);
    const transpileErrors = result.diagnostics.filter((d) => d.toLowerCase().includes("transpilation"));
    if (!result.entryFile) {
      setCurrentDoc(null);
      session.failBuild(buildId, "No standard React or HTML entry point found (src/app/App.tsx, src/App.tsx, src/main.tsx, index.html).");
      return;
    }
    if (transpileErrors.length > 0) {
      setCurrentDoc(null);
      session.failBuild(buildId, result.diagnostics.join(" | "));
      return;
    }
    setShowingFallback(false);
    setCurrentDoc({ buildId, html: result.html });
  }, [selectedProject, selectedProjectId, projState, savedArtifacts, selectedRoute, session]);

  // Rebuild whenever the saved revision, route, project or run-state changes.
  // Builds always come from the last confirmed revision — never from drafts.
  useEffect(() => {
    if (!selectedProjectId || !projState) return;
    if (!isRunning) {
      session.stop();
      lastBuildKeyRef.current = "";
      return;
    }
    const key = `${selectedProjectId}|${projState.revision}|${selectedRoute}`;
    if (key === lastBuildKeyRef.current) return;
    lastBuildKeyRef.current = key;
    startBuild();
  }, [selectedProjectId, projState, selectedRoute, isRunning, startBuild, session]);

  // React to preview session transitions: fallback bookkeeping + AI verification states.
  useEffect(() => {
    const snap = previewSnap;
    if (snap.stage === "ready" && snap.mountedBuildId) {
      const doc = currentDocRef.current;
      if (doc && doc.buildId === snap.mountedBuildId) {
        setFallbackDoc(doc);
        setShowingFallback(false);
      }
      const opId = activeOperationIdRef.current;
      if (opId) {
        uiStudioHistoryStorage.updateStatus(opId, "runtime_verified");
        setHistoryEntries((prev) =>
          prev.map((entry) => (entry.id === opId ? { ...entry, status: "runtime_verified" } : entry))
        );
        setActivePlan((prev) =>
          prev && prev.applied ? { ...prev, verificationLevel: "runtime_verified", validationError: undefined } : prev
        );
      }
    }
    if (
      (snap.stage === "build_error" || snap.stage === "runtime_error" || snap.stage === "load_timeout" || snap.stage === "mount_timeout") &&
      snap.error
    ) {
      setFallbackDoc((prev) => {
        if (prev && currentDocRef.current && prev.buildId !== currentDocRef.current.buildId) {
          setShowingFallback(true);
        }
        return prev;
      });
      const opId = activeOperationIdRef.current;
      if (opId) {
        const errMsg = snap.error.message;
        uiStudioHistoryStorage.updateStatus(opId, "failed", errMsg);
        setHistoryEntries((prev) =>
          prev.map((entry) => (entry.id === opId ? { ...entry, status: "failed", validationError: errMsg } : entry))
        );
        setActivePlan((prev) =>
          prev && prev.applied ? { ...prev, verificationLevel: "failed", validationError: errMsg } : prev
        );
      }
    }
  }, [previewSnap]);

  // --- Iframe message bridge ----------------------------------------------------------------
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      const type = e.data.type;
      if (type === "ELEMENT_SELECTED") {
        setSelectedElement(e.data as InspectedElementData);
        setRightTab("inspector");
        setRightPanelOpen(true);
        if (window.innerWidth < 768) setMobileTab("inspector");
        return;
      }
      if (typeof type === "string" && type.startsWith("PREVIEW_")) {
        session.handleMessage(e.data);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [session]);

  // Keep inspect mode in sync with the iframe document.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "SET_INSPECT_MODE", enabled: inspectMode }, "*");
  }, [inspectMode, currentDoc, showingFallback]);

  // --- Panel resizing ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isResizingLeft) return;
    const onMove = (e: MouseEvent) => setLeftPanelWidth(Math.max(200, Math.min(460, e.clientX)));
    const onUp = () => setIsResizingLeft(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingLeft]);

  useEffect(() => {
    if (!isResizingRight) return;
    const onMove = (e: MouseEvent) =>
      setRightPanelWidth(Math.max(320, Math.min(760, window.innerWidth - e.clientX)));
    const onUp = () => setIsResizingRight(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingRight]);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const onMove = (e: MouseEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(22, Math.min(78, pct)));
    };
    const onUp = () => setIsDraggingSplit(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingSplit]);

  // --- Derived state ------------------------------------------------------------------------------
  const aggregateStatus: FileSaveStatus = useMemo(() => {
    if (!projState) return "saved";
    let anyFailed = false;
    let anySaving = false;
    let anyDirty = false;
    for (const f of projState.files.values()) {
      if (f.status === "failed") anyFailed = true;
      if (f.status === "saving") anySaving = true;
      if (f.draftContent !== f.savedContent) anyDirty = true;
    }
    return anyFailed ? "failed" : anySaving ? "saving" : anyDirty ? "unsaved" : "saved";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projState, docTick]);

  const failedFiles = useMemo(
    () => filesList.filter((f) => f.status === "failed"),
    [filesList]
  );

  const activeFile = selectedFilePath && projState ? projState.files.get(selectedFilePath) || null : null;

  const identified = useMemo(() => {
    if (!selectedElement || savedArtifacts.length === 0) return null;
    return resolveSourceArtifactForElement(selectedElement, savedArtifacts);
  }, [selectedElement, savedArtifacts]);

  const validationReport = useMemo(() => {
    if (!selectedProject || savedArtifacts.length === 0) return null;
    return validateApplicationTarget(selectedProject.name, savedArtifacts, lastBuildResult?.archetype || "general_app", {
      isMounted: previewSnap.stage === "ready",
      hasRuntimeError: Boolean(previewSnap.error),
      runtimeErrorMsg: previewSnap.error?.message || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, savedArtifacts, lastBuildResult, previewSnap, docTick]);

  const displayedDoc = showingFallback && fallbackDoc ? fallbackDoc : currentDoc;
  const stage = previewSnap.stage;
  const isErrorStage =
    stage === "build_error" || stage === "runtime_error" || stage === "load_timeout" || stage === "mount_timeout";

  // --- File / project actions ---------------------------------------------------------------------
  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSearchParams({ project: id });
    setGlobalActiveProjectId(id, true);
  };

  const handleSelectFile = (path: string) => {
    setSelectedFilePath(path);
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    if (window.innerWidth < 768) setMobileTab("workspace");
  };

  const handleCloseTab = (path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (selectedFilePath === path) {
        setSelectedFilePath(next.length > 0 ? next[next.length - 1] : null);
      }
      return next;
    });
  };

  const handleSaveActive = async () => {
    if (!selectedProjectId || !selectedFilePath) return;
    const ok = await manager.saveFile(selectedProjectId, selectedFilePath);
    if (ok) {
      pushNotification("success", "Saved", `${selectedFilePath} persisted. Preview rebuilds from the new revision.`);
    } else {
      const err = manager.getProjectState(selectedProjectId)?.files.get(selectedFilePath)?.error;
      pushNotification("error", "Save Failed", err || "The file could not be saved. Your draft is intact — retry from the toolbar.");
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedProjectId) return;
    for (const f of failedFiles) {
      await manager.retrySave(selectedProjectId, f.path);
    }
  };

  const handleUndo = async () => {
    if (!selectedProjectId) return;
    const affected = await manager.undo(selectedProjectId);
    if (affected) pushNotification("info", "Undo", `Reverted: ${affected.join(", ")}`);
  };

  const handleRedo = async () => {
    if (!selectedProjectId) return;
    const affected = await manager.redo(selectedProjectId);
    if (affected) pushNotification("info", "Redo", `Reapplied: ${affected.join(", ")}`);
  };

  const handleCreateFile = async (path: string): Promise<boolean> => {
    if (!selectedProjectId) return false;
    return manager.createFile(selectedProjectId, path, "");
  };

  const handleRenameFile = async (oldPath: string, newPath: string): Promise<boolean> => {
    if (!selectedProjectId) return false;
    const ok = await manager.renameFile(selectedProjectId, oldPath, newPath);
    if (ok) {
      const normalized = newPath.replace(/\\/g, "/");
      setOpenTabs((prev) => prev.map((p) => (p === oldPath ? normalized : p)));
      if (selectedFilePath === oldPath) setSelectedFilePath(normalized);
    }
    return ok;
  };

  const handleDeleteFile = async (path: string): Promise<boolean> => {
    if (!selectedProjectId) return false;
    const ok = await manager.deleteFile(selectedProjectId, path);
    if (ok) handleCloseTab(path);
    return ok;
  };

  // --- Preview actions ------------------------------------------------------------------------------
  const handleRefresh = () => {
    lastBuildKeyRef.current = "";
    if (!isRunning) setIsRunning(true);
    else startBuild();
  };

  const handleOpenExternal = () => {
    const doc = displayedDoc;
    if (!doc) return;
    const blob = new Blob([doc.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const toggleFullscreen = () => {
    if (isFocusPreview) {
      setIsFocusPreview(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      setIsFocusPreview(true);
      workspaceRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const handleRunTests = () => {
    if (!selectedProject) return;
    const report = validateApplicationTarget(
      selectedProject.name,
      savedArtifacts,
      lastBuildResult?.archetype || "general_app",
      {
        isMounted: stage === "ready",
        hasRuntimeError: Boolean(previewSnap.error),
        runtimeErrorMsg: previewSnap.error?.message || null,
      }
    );
    setTestReport(report);
    setShowTestPanel(true);
  };

  const handleDownloadZip = async () => {
    if (!selectedProject) return;
    const model = parseBlueprintDirectoryTree(
      selectedProject.blueprint?.folderStructure || "app/\n├── index.html\n└── src/app/App.tsx"
    );
    const manifest = buildExportManifest(selectedProject.name, model, savedArtifacts);
    const result = await createProjectZipArchive(manifest);
    triggerBrowserZipDownload(result.blob, result.filename);
  };

  // --- Inspector actions ------------------------------------------------------------------------------
  const handleApplyLiveStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedElement || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "APPLY_LIVE_STYLE",
          property,
          value,
          targetSelector: selectedElement.id ? `#${selectedElement.id}` : undefined,
        },
        "*"
      );
      const changeItem: InspectorChange = {
        id: `vis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        property,
        previousValue: selectedElement.styles[property] || "",
        newValue: value,
        elementLabel: `<${selectedElement.tagName}> ${selectedElement.id ? `#${selectedElement.id}` : ""}`,
        previewId: selectedElement.id,
        sourceFile: identified?.artifact ? identified.artifact.path : null,
        timestamp: new Date().toISOString(),
        isAppliedLive: true,
        isSavedToSource: false,
        status: "preview_only",
      };
      setInspectorChanges((prev) => [changeItem, ...prev.slice(0, 49)]);
    },
    [selectedElement, identified]
  );

  const handleSaveStyleToSource = async (
    property: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!selectedProjectId) return { success: false, error: "No target project active" };
    if (!selectedElement) return { success: false, error: "No element selected to edit" };
    const validation = validateCssValue(property, value);
    if (!validation.valid) return { success: false, error: validation.error || "Invalid property value" };

    try {
      const result = applyStyleToProject(savedArtifacts, selectedElement, property, value);
      const priorByPath = new Map(savedArtifacts.map((a) => [a.path, a.content || ""]));
      const applied = await manager.applyExternalChanges(
        selectedProjectId,
        result.updates.map((u) => ({ path: u.path, content: u.updatedContent })),
        { label: `Visual Inspector: ${property} = ${value} (${result.strategy})`, author: "user" }
      );
      if (applied.failedPath) {
        return { success: false, error: `Persistence failed for ${applied.failedPath}: ${applied.error || "unknown error"}` };
      }

      const opId = `op_vis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const histEntry: OperationHistoryEntry = {
        id: opId,
        timestamp: new Date().toISOString(),
        projectId: selectedProjectId,
        projectName: selectedProject?.name || "Project",
        userPrompt: `Visual Edit: <${selectedElement.tagName}> ${property} -> ${value}`,
        mode: "edit",
        affectedFiles: result.updates.map((u) => u.path),
        summary: `Inspector updated ${property} in ${result.resolvedPath}`,
        diffExplanation: `Applied ${result.strategy} for ${property}: ${value}`,
        status: "saved",
        items: result.updates.map((u) => ({
          id: `item_${opId}_${u.path}`,
          filePath: u.path,
          action: u.isNewFile ? "create" : "modify",
          summary: `Set ${property}: ${value}`,
          diffExplanation: `Updated style via Visual Inspector (${result.strategy})`,
          originalContent: priorByPath.get(u.path) || "",
          proposedContent: u.updatedContent,
        })),
        previousFileSnapshots: Object.fromEntries(result.updates.map((u) => [u.path, priorByPath.get(u.path) || ""])),
      };
      await uiStudioHistoryStorage.save(histEntry);
      setHistoryEntries((prev) => [histEntry, ...prev]);

      setInspectorChanges((prev) =>
        prev.map((c) =>
          c.property === property && !c.isSavedToSource
            ? { ...c, isSavedToSource: true, status: "saved", sourceFile: result.resolvedPath }
            : c
        )
      );
      pushNotification(
        "success",
        "Saved to Source",
        `${property} written to ${result.resolvedPath} (${result.strategy}${result.confidence !== "high" ? "; target file was inferred" : ""}).`
      );
      return { success: true };
    } catch (err: any) {
      pushNotification("error", "Inspector Save Failed", err.message || "Failed to persist to source file");
      return { success: false, error: err.message || "Failed to persist to source" };
    }
  };

  const handleUndoInspectorChange = async () => {
    if (inspectorChanges.length === 0 || !selectedProjectId) return;
    const [lastChange, ...rest] = inspectorChanges;
    if (lastChange.isSavedToSource) {
      const affected = await manager.undo(selectedProjectId);
      if (affected) {
        setInspectorChanges(rest);
        setInspectorRedoStack((prev) => [lastChange, ...prev]);
      }
      return;
    }
    setInspectorChanges(rest);
    setInspectorRedoStack((prev) => [lastChange, ...prev]);
    if (selectedElement && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "APPLY_LIVE_STYLE",
          property: lastChange.property,
          value: lastChange.previousValue || "",
          targetSelector: selectedElement.id ? `#${selectedElement.id}` : undefined,
        },
        "*"
      );
    }
  };

  const handleRedoInspectorChange = async () => {
    if (inspectorRedoStack.length === 0 || !selectedProjectId) return;
    const [redoItem, ...rest] = inspectorRedoStack;
    if (redoItem.isSavedToSource) {
      const affected = await manager.redo(selectedProjectId);
      if (affected) {
        setInspectorRedoStack(rest);
        setInspectorChanges((prev) => [redoItem, ...prev]);
      }
      return;
    }
    setInspectorRedoStack(rest);
    setInspectorChanges((prev) => [redoItem, ...prev]);
    if (selectedElement && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "APPLY_LIVE_STYLE",
          property: redoItem.property,
          value: redoItem.newValue,
          targetSelector: selectedElement.id ? `#${selectedElement.id}` : undefined,
        },
        "*"
      );
    }
  };

  // --- History revert -----------------------------------------------------------------------------------
  const handleRevertHistoryEntry = async (entry: OperationHistoryEntry) => {
    if (!selectedProjectId) return;
    if (!entry.previousFileSnapshots || Object.keys(entry.previousFileSnapshots).length === 0) {
      pushNotification("warning", "Revert Unavailable", "No file snapshots recorded for this operation.");
      return;
    }
    const changes = Object.entries(entry.previousFileSnapshots).map(([path, content]) => ({ path, content }));
    const result = await manager.applyExternalChanges(selectedProjectId, changes, {
      label: `Revert operation: ${entry.summary}`,
      author: "user",
    });
    if (result.failedPath) {
      pushNotification("error", "Revert Failed", `Could not restore ${result.failedPath}: ${result.error || "unknown error"}`);
      return;
    }
    await uiStudioHistoryStorage.updateStatus(entry.id, "reverted");
    setHistoryEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: "reverted" } : e)));
    pushNotification("success", "Reverted Successfully", `Restored files to state prior to ${entry.id}.`);
  };

  // --- AI assistant ---------------------------------------------------------------------------------------
  const executeApply = async (plan: AIEditPlan, opId: string) => {
    if (!selectedProjectId || !selectedProject) return;
    const result = await manager.applyExternalChanges(
      selectedProjectId,
      plan.items.map((item) => ({ path: item.filePath, content: item.proposedContent })),
      { label: `AI ${plan.mode}: ${plan.summary}`, author: "ai" }
    );
    if (result.failedPath) {
      pushNotification("error", "Apply Failed", `Could not persist ${result.failedPath}: ${result.error || "unknown error"}`);
      await uiStudioHistoryStorage.updateStatus(opId, "failed", result.error || "Persistence failed");
      setHistoryEntries((prev) =>
        prev.map((e) => (e.id === opId ? { ...e, status: "failed", validationError: result.error || undefined } : e))
      );
      return;
    }
    setActivePlan((prev) => (prev ? { ...prev, applied: true, verificationLevel: "saved" } : null));
    await uiStudioHistoryStorage.updateStatus(opId, "saved");
    setHistoryEntries((prev) => prev.map((e) => (e.id === opId ? { ...e, status: "saved" } : e)));
    pushNotification("success", "Changes Saved", "Project files saved through the source pipeline. Building and verifying runtime…");
  };

  const handlePlanAIEdit = async () => {
    if (!selectedProject || !selectedProjectId || !aiPrompt.trim() || isAiProcessing) return;
    const promptSnapshot = aiPrompt;
    const modeSnapshot = aiMode;
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveOperationId(operationId);
    setIsAiProcessing(true);

    const userMsg: AIConversationMessage = {
      id: `msg_user_${Date.now()}`,
      operationId,
      role: "user",
      mode: modeSnapshot,
      content: promptSnapshot,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...conversationHistory, userMsg];
    setConversationHistory(nextHistory);
    persistChatMessages(nextHistory);
    setAiPrompt("");

    try {
      const plan = await planAIEdits({
        operationId,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        userPrompt: promptSnapshot,
        mode: modeSnapshot,
        artifacts: savedArtifacts,
        activeFilePath: selectedFilePath,
        errorContext: previewSnap.error?.message || null,
      });

      if (selectedProjectId !== selectedProject.id) return;

      const snapshots: Record<string, string> = {};
      for (const item of plan.items) {
        const existing = savedArtifacts.find((a) => a.path === item.filePath);
        if (existing?.content) snapshots[item.filePath] = existing.content;
      }

      const historyEntry: OperationHistoryEntry = {
        id: operationId,
        timestamp: new Date().toISOString(),
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        userPrompt: promptSnapshot,
        mode: modeSnapshot,
        affectedFiles: plan.items.map((i) => i.filePath),
        summary: plan.summary,
        diffExplanation: plan.items[0]?.diffExplanation,
        status: modeSnapshot === "auto" ? "applied" : "proposed",
        items: plan.items,
        advisoryText: plan.advisoryText,
        previousFileSnapshots: snapshots,
      };
      await uiStudioHistoryStorage.save(historyEntry);
      setHistoryEntries((prev) => [historyEntry, ...prev]);
      setActivePlan(plan);

      const assistantMsg: AIConversationMessage = {
        id: `msg_ai_${Date.now()}`,
        operationId,
        role: "assistant",
        mode: modeSnapshot,
        content: plan.advisoryText || plan.summary,
        timestamp: new Date().toISOString(),
        plan,
      };
      const finalHistory = [...nextHistory, assistantMsg];
      setConversationHistory(finalHistory);
      persistChatMessages(finalHistory);

      if (modeSnapshot === "auto" && plan.items.length > 0) {
        await executeApply(plan, operationId);
      }
    } catch (err: any) {
      pushNotification("error", "AI Operation Failed", err.message || "Failed to formulate edit plan");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!activePlan || !activeOperationId || isAiProcessing) return;
    setIsAiProcessing(true);
    try {
      await executeApply(activePlan, activeOperationId);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleRejectPlan = async () => {
    if (!activePlan || !activeOperationId) return;
    await uiStudioHistoryStorage.updateStatus(activeOperationId, "rejected");
    setHistoryEntries((prev) =>
      prev.map((e) => (e.id === activeOperationId ? { ...e, status: "rejected" } : e))
    );
    setActivePlan(null);
    setActiveOperationId(null);
    pushNotification("info", "Changes Rejected", "Proposed modifications discarded.");
  };

  // --- Design tokens -----------------------------------------------------------------------------------------
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({
    primaryColor: "#70C84B",
    accentColor: "#2563EB",
    borderRadius: "8px",
    spacingUnit: "16px",
    fontFamily: "Inter, sans-serif",
  });
  const [tokenDirty, setTokenDirty] = useState(false);

  const handleApplyTokens = async () => {
    if (!selectedProjectId) return;
    const cssPath = "src/index.css";
    const existing = savedArtifacts.find((a) => a.path === cssPath);
    const base = (existing?.content || "").replace(/\n?\/\* Visual Design Tokens \*\/\n:root \{[^}]*\}\n?/g, "");
    const rules = `\n/* Visual Design Tokens */\n:root {\n  --primary: ${tokenDrafts.primaryColor};\n  --accent: ${tokenDrafts.accentColor};\n  --radius: ${tokenDrafts.borderRadius};\n  --spacing: ${tokenDrafts.spacingUnit};\n  font-family: ${tokenDrafts.fontFamily};\n}\n`;
    const result = await manager.applyExternalChanges(
      selectedProjectId,
      [{ path: cssPath, content: base + rules }],
      { label: "Apply design tokens", author: "user" }
    );
    if (result.failedPath) {
      pushNotification("error", "Failed to Save Tokens", result.error || "Persistence failed");
      return;
    }
    setTokenDirty(false);
    pushNotification("success", "Design Tokens Saved", "Global design tokens persisted to src/index.css");
  };

  const activeViewport = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];
  const canUndo = selectedProjectId ? manager.canUndo(selectedProjectId) : false;
  const canRedo = selectedProjectId ? manager.canRedo(selectedProjectId) : false;
  const hasDirty = selectedProjectId ? manager.isDirty(selectedProjectId) : false;

  const handleSaveAll = async () => {
    if (!selectedProjectId) return;
    const res = await manager.saveAllDirty(selectedProjectId);
    if (res.failed.length > 0) {
      pushNotification("error", "Some Files Failed to Save", `Failed: ${res.failed.join(", ")}. Drafts are intact — use Retry.`);
    } else if (res.saved.length > 0) {
      pushNotification("success", "All Changes Saved", `Saved ${res.saved.length} file(s). Preview rebuilds from the new revision.`);
    }
  };

  const stagePillCls =
    stage === "ready"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : isErrorStage
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : stage === "stopped" || stage === "idle"
      ? "bg-white/5 text-zinc-400 border-white/10"
      : "bg-amber-500/15 text-amber-300 border-amber-500/30";

  const savePill =
    aggregateStatus === "saved"
      ? { label: "Saved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
      : aggregateStatus === "saving"
      ? { label: "Saving…", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" }
      : aggregateStatus === "failed"
      ? { label: "Save Failed", cls: "bg-red-500/15 text-red-300 border-red-500/30" }
      : { label: "Unsaved", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };

  const detectedRoutes = lastBuildResult?.detectedRoutes || ["/"];
  const previewWarnings = (lastBuildResult?.diagnostics || []).filter(
    (d) => !d.toLowerCase().includes("transpilation")
  );

  const leftSections: Array<{ id: LeftSection; label: string; Icon: any }> = [
    { id: "files", label: "Explorer", Icon: FolderTree },
    { id: "pages", label: "Pages", Icon: RouteIcon },
    { id: "design", label: "Design", Icon: Palette },
    { id: "health", label: "Health", Icon: Activity },
  ];

  return (
    <div ref={workspaceRef} className="flex flex-col h-full w-full overflow-hidden bg-[#0b0d10] text-zinc-200">
      {/* ======================= TOP TOOLBAR ======================= */}
      <div className="h-11 shrink-0 flex items-center gap-2 px-2 border-b border-white/10 bg-[#101318] z-20">
        <button
          type="button"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/5 cursor-pointer"
          title={leftPanelOpen ? "Hide Explorer" : "Show Explorer"}
        >
          {leftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <select
          value={selectedProjectId || ""}
          onChange={(e) => handleSelectProject(e.target.value)}
          className="text-xs font-medium py-1.5 px-2 rounded bg-[#0b0d10] border border-white/10 text-zinc-100 cursor-pointer focus:outline-none focus:border-emerald-500/60 max-w-[190px] truncate"
          title="Select project"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {validationReport && (
          <span className="hidden lg:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10 uppercase">
            {validationReport.archetype.replace("_", " ")}
          </span>
        )}

        <span
          className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/10"
          title="Source revision — increments only after a save is confirmed in storage"
        >
          Rev {projState?.revision ?? 0}
        </span>

        <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${savePill.cls}`}>
          {aggregateStatus === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
          {savePill.label}
        </span>
        {aggregateStatus === "failed" && (
          <button
            type="button"
            onClick={handleRetryFailed}
            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!hasDirty && aggregateStatus !== "failed"}
          className="hidden sm:flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border border-white/10 text-zinc-200 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
          title="Save all modified files (editor also supports Ctrl+S per file)"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="p-1.5 rounded text-zinc-300 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
          title="Undo last saved change"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          className="p-1.5 rounded text-zinc-300 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Center-mode switch */}
        <div className="hidden md:flex items-center bg-[#0b0d10] border border-white/10 rounded p-0.5" role="tablist" aria-label="Workspace mode">
          {(
            [
              { id: "code", label: "Code", Icon: Code2 },
              { id: "split", label: "Split", Icon: SplitSquareHorizontal },
              { id: "preview", label: "Preview", Icon: Eye },
            ] as Array<{ id: CenterMode; label: string; Icon: any }>
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={centerMode === id}
              onClick={() => setCenterMode(id)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                centerMode === id ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
          title="Build the preview from the last saved revision"
        >
          <Hammer className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Build</span>
        </button>
        <button
          type="button"
          onClick={handleRunTests}
          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded border border-white/10 text-zinc-200 hover:bg-white/5 cursor-pointer"
          title="Validate the saved project (static + runtime checks)"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Test</span>
        </button>
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded border cursor-pointer ${
            isRunning
              ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
              : "border-white/10 text-zinc-300 hover:bg-white/5"
          }`}
          title={isRunning ? "Stop live preview" : "Start live preview"}
        >
          {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden xl:inline">Live Preview</span>
        </button>

        {/* Viewport controls — set the REAL iframe width; content reflows */}
        <div className="hidden lg:flex items-center bg-[#0b0d10] border border-white/10 rounded p-0.5">
          {VIEWPORTS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewport(id)}
              title={label}
              aria-pressed={viewport === id}
              className={`p-1.5 rounded cursor-pointer ${viewport === id ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded text-zinc-300 hover:bg-white/5 cursor-pointer"
          title={isFocusPreview ? "Exit fullscreen focus" : "Fullscreen workspace"}
        >
          {isFocusPreview ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={handleDownloadZip}
          className="p-1.5 rounded text-zinc-300 hover:bg-white/5 cursor-pointer"
          title="Download project as ZIP"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/build?project=${selectedProjectId}`)}
          className="hidden md:flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded border border-white/10 text-zinc-200 hover:bg-white/5 cursor-pointer"
          title="Open Build Studio"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Build Studio</span>
        </button>
        <button
          type="button"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="p-1.5 rounded text-zinc-300 hover:bg-white/5 cursor-pointer"
          title={rightPanelOpen ? "Hide right panel" : "Show right panel"}
        >
          {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

      {/* ======================= MOBILE TAB BAR ======================= */}
      <div className="md:hidden h-10 border-b border-white/10 bg-[#101318] flex items-center px-1 shrink-0 text-xs font-medium">
        {(
          [
            { id: "workspace", label: "Studio", Icon: Eye },
            { id: "files", label: "Files", Icon: FolderTree },
            { id: "assistant", label: "Assistant", Icon: MessageSquare },
            { id: "inspector", label: "Inspector", Icon: Sliders },
          ] as Array<{ id: MobileTab; label: string; Icon: any }>
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded cursor-pointer ${
              mobileTab === id ? "bg-white/10 text-zinc-50" : "text-zinc-400"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ======================= MAIN ROW ======================= */}
      <div className="flex-1 flex min-h-0 relative">
        {/* ---------- LEFT: Explorer / Pages / Design / Health ---------- */}
        {!isFocusPreview && leftPanelOpen && (
          <aside
            style={{ width: `${leftPanelWidth}px` }}
            className={`shrink-0 h-full min-h-0 flex-col bg-[#101318] border-r border-white/10 ${
              mobileTab === "files" ? "flex w-full absolute inset-0 z-30 md:relative md:w-auto" : "hidden md:flex"
            }`}
          >
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 shrink-0">
              {leftSections.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLeftSection(id)}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                    leftSection === id ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {leftSection === "files" && (
              <div className="flex-1 min-h-0">
                <StudioExplorer
                  files={filesList}
                  selectedFilePath={selectedFilePath}
                  openPaths={openTabs}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                />
              </div>
            )}

            {leftSection === "pages" && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider px-1 py-1">
                  Application Routes ({detectedRoutes.length})
                </div>
                {detectedRoutes.map((route) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => setSelectedRoute(route)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded text-left cursor-pointer ${
                      selectedRoute === route
                        ? "bg-emerald-500/15 text-zinc-50 border border-emerald-500/30"
                        : "hover:bg-white/5 text-zinc-300 border border-transparent"
                    }`}
                  >
                    <RouteIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono">{route}</span>
                  </button>
                ))}
              </div>
            )}

            {leftSection === "design" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Design Tokens</span>
                  {tokenDirty && <span className="text-[9px] bg-amber-500/15 text-amber-300 px-1 rounded font-semibold">Modified</span>}
                </div>
                {(
                  [
                    { key: "primaryColor", label: "Primary", type: "color" },
                    { key: "accentColor", label: "Accent", type: "color" },
                  ] as const
                ).map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="text-[10px] text-zinc-500 block mb-1">{label}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type={type}
                        value={tokenDrafts[key]}
                        onChange={(e) => {
                          setTokenDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                          setTokenDirty(true);
                        }}
                        className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/15 p-0"
                      />
                      <input
                        type="text"
                        value={tokenDrafts[key]}
                        onChange={(e) => {
                          setTokenDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                          setTokenDirty(true);
                        }}
                        className="w-full text-[11px] font-mono px-1.5 py-1 rounded bg-[#0b0d10] border border-white/15 text-zinc-100"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Font Family</label>
                  <select
                    value={tokenDrafts.fontFamily}
                    onChange={(e) => {
                      setTokenDrafts((prev) => ({ ...prev, fontFamily: e.target.value }));
                      setTokenDirty(true);
                    }}
                    className="w-full text-[11px] px-1.5 py-1.5 rounded bg-[#0b0d10] border border-white/15 text-zinc-100"
                  >
                    <option value="Inter, sans-serif">Inter (Modern Clean)</option>
                    <option value="system-ui, sans-serif">System Default</option>
                    <option value="'Fira Code', monospace">Fira Code (Technical)</option>
                    <option value="Georgia, serif">Georgia (Editorial)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Border Radius</label>
                    <select
                      value={tokenDrafts.borderRadius}
                      onChange={(e) => {
                        setTokenDrafts((prev) => ({ ...prev, borderRadius: e.target.value }));
                        setTokenDirty(true);
                      }}
                      className="w-full text-[11px] px-1.5 py-1.5 rounded bg-[#0b0d10] border border-white/15 text-zinc-100"
                    >
                      <option value="0px">None (0px)</option>
                      <option value="4px">Small (4px)</option>
                      <option value="8px">Medium (8px)</option>
                      <option value="16px">Large (16px)</option>
                      <option value="9999px">Full (Pill)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Base Spacing</label>
                    <select
                      value={tokenDrafts.spacingUnit}
                      onChange={(e) => {
                        setTokenDrafts((prev) => ({ ...prev, spacingUnit: e.target.value }));
                        setTokenDirty(true);
                      }}
                      className="w-full text-[11px] px-1.5 py-1.5 rounded bg-[#0b0d10] border border-white/15 text-zinc-100"
                    >
                      <option value="12px">Compact (12px)</option>
                      <option value="16px">Standard (16px)</option>
                      <option value="24px">Relaxed (24px)</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!tokenDirty}
                  onClick={handleApplyTokens}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded disabled:opacity-40 cursor-pointer"
                >
                  Apply Tokens to src/index.css
                </button>
                <p className="text-[10px] text-zinc-600 leading-snug">
                  Tokens are written as CSS variables into the project stylesheet through the same save pipeline as
                  code edits, and the preview rebuilds from the new revision.
                </p>
              </div>
            )}

            {leftSection === "health" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Health Audit</span>
                  {validationReport && (
                    <span className="text-xs font-mono font-semibold text-zinc-100">{validationReport.score}%</span>
                  )}
                </div>
                {validationReport ? (
                  <>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      {(
                        [
                          { label: "Static", value: validationReport.breakdown?.staticChecks },
                          { label: "Build", value: validationReport.breakdown?.buildChecks },
                          { label: "Arch", value: validationReport.breakdown?.archetypeCompliance },
                          { label: "Runtime", value: validationReport.isVerified ? validationReport.breakdown?.runtimeHealth : undefined },
                        ] as const
                      ).map(({ label, value }) => (
                        <div key={label} className="p-1.5 rounded bg-white/5 border border-white/10">
                          <div className="text-[9px] text-zinc-500 font-medium">{label}</div>
                          <div className="text-[11px] font-semibold text-zinc-100 font-mono">
                            {value === undefined ? "—" : `${value}%`}
                          </div>
                        </div>
                      ))}
                    </div>
                    {validationReport.errors.length > 0 ? (
                      validationReport.errors.map((err, i) => (
                        <div key={i} className="p-2.5 border border-red-500/30 bg-red-500/10 rounded space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-300">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {err.type.toUpperCase()}: {err.file || "General"}
                            </span>
                          </div>
                          <p className="text-[11px] text-red-200/80">{err.message}</p>
                          {err.suggestedFix && (
                            <div className="text-[10px] text-red-200/70 bg-red-500/10 p-1.5 rounded font-mono">
                              Fix: {err.suggestedFix}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                        <div className="text-xs font-semibold text-zinc-100">All Criteria Verified</div>
                        <p className="text-[11px] text-zinc-500">
                          Structure, archetype compliance and runtime sanity checks passed.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-zinc-500">Open a project to see its health audit.</p>
                )}
              </div>
            )}
          </aside>
        )}

        {!isFocusPreview && leftPanelOpen && (
          <div
            onMouseDown={() => setIsResizingLeft(true)}
            className="w-1 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500 transition-colors h-full hidden md:block shrink-0"
            title="Drag to resize Explorer"
          />
        )}

        {/* ---------- CENTER: Editor + Preview ---------- */}
        <main
          className={`flex-1 min-w-0 h-full min-h-0 ${mobileTab === "workspace" ? "flex" : "hidden md:flex"}`}
        >
          {/* Editor */}
          {centerMode !== "preview" && (
            <div
              className="flex flex-col min-w-0 h-full bg-[#0b0d10]"
              style={centerMode === "split" ? { width: `${splitRatio}%` } : { flex: 1 }}
            >
              <div className="h-9 shrink-0 flex items-end gap-0.5 px-1.5 bg-[#101318] border-b border-white/10 overflow-x-auto">
                {openTabs.map((path) => {
                  const f = projState?.files.get(path);
                  const dirty = f ? f.draftContent !== f.savedContent : false;
                  const isActive = path === selectedFilePath;
                  return (
                    <div
                      key={path}
                      className={`group flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-t text-[11px] font-mono whitespace-nowrap cursor-pointer border-b-2 ${
                        isActive
                          ? "bg-[#0b0d10] text-zinc-50 border-emerald-500"
                          : "text-zinc-400 hover:text-zinc-100 border-transparent"
                      }`}
                      onClick={() => setSelectedFilePath(path)}
                      title={path}
                    >
                      <span>{path.split("/").pop()}</span>
                      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(path);
                        }}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-white/10 cursor-pointer"
                        title="Close tab"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {openTabs.length === 0 && (
                  <span className="text-[11px] text-zinc-600 px-2 py-1.5">No file open</span>
                )}
              </div>
              <div className="flex-1 min-h-0 relative">
                {activeFile ? (
                  <MonacoCodeEditor
                    key={activeFile.path}
                    filePath={activeFile.path}
                    value={activeFile.draftContent}
                    onChange={(val) => selectedProjectId && manager.edit(selectedProjectId, activeFile.path, val)}
                    onSave={handleSaveActive}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <Code2 className="w-8 h-8 text-zinc-700" />
                    <p className="text-sm font-medium text-zinc-300">No file selected</p>
                    <p className="text-xs text-zinc-500 max-w-xs">
                      Pick a file in the Explorer to edit it. Edits are drafts until you save — the preview always
                      builds from the last saved revision.
                    </p>
                  </div>
                )}
              </div>
              {activeFile && (
                <div className="h-6 shrink-0 flex items-center gap-3 px-2.5 bg-[#101318] border-t border-white/10 text-[10px] font-mono text-zinc-500">
                  <span className="truncate">{activeFile.path}</span>
                  <span className={activeFile.status === "failed" ? "text-red-300" : activeFile.draftContent !== activeFile.savedContent ? "text-amber-300" : "text-emerald-400"}>
                    {activeFile.status === "failed"
                      ? `Save failed: ${activeFile.error || "unknown error"}`
                      : activeFile.draftContent !== activeFile.savedContent
                      ? "Unsaved changes"
                      : `Saved${activeFile.lastSavedAt ? ` · ${new Date(activeFile.lastSavedAt).toLocaleTimeString()}` : ""}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {centerMode === "split" && (
            <div
              onMouseDown={() => setIsDraggingSplit(true)}
              className="w-1 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500 transition-colors h-full hidden md:block shrink-0 bg-white/5"
              title="Drag to resize editor / preview split"
            />
          )}

          {/* Preview */}
          {centerMode !== "code" && (
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0b0d10]">
              <div className="h-9 shrink-0 flex items-center gap-2 px-2.5 bg-[#101318] border-b border-white/10">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${stagePillCls}`}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stage === "ready" ? "bg-emerald-400" : isErrorStage ? "bg-red-400" : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  {STAGE_LABELS[stage]}
                </span>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="text-[11px] font-mono py-1 px-1.5 rounded bg-[#0b0d10] border border-white/10 text-zinc-200 cursor-pointer focus:outline-none"
                  title="Preview route"
                >
                  {detectedRoutes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="hidden xl:inline text-[10px] font-mono text-zinc-600 truncate">
                  {displayedDoc ? displayedDoc.buildId : "no build"}
                  {showingFallback ? " (fallback)" : ""}
                </span>
                <div className="flex-1" />
                <select
                  value={zoom}
                  onChange={(e) => setZoom(parseInt(e.target.value, 10))}
                  className="hidden sm:block text-[11px] py-1 px-1 rounded bg-[#0b0d10] border border-white/10 text-zinc-300 cursor-pointer focus:outline-none"
                  title="Preview zoom (display only — viewport width stays real)"
                >
                  {[50, 75, 100, 125, 150].map((z) => (
                    <option key={z} value={z}>
                      {z}%
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setInspectMode(!inspectMode);
                    if (!inspectMode) {
                      setRightTab("inspector");
                      setRightPanelOpen(true);
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                    inspectMode
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "border-white/10 text-zinc-300 hover:bg-white/5"
                  }`}
                  title="Inspect elements in the preview"
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Inspect</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-1.5 rounded text-zinc-300 hover:bg-white/5 cursor-pointer"
                  title="Rebuild preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  disabled={!displayedDoc}
                  className="p-1.5 rounded text-zinc-300 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                  title="Open preview in a new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {showingFallback && fallbackDoc && (
                <div className="mx-2 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/40 rounded text-amber-200 text-[11px] flex items-center justify-between gap-2 shrink-0">
                  <span className="truncate">
                    <strong className="font-semibold">Stale preview — showing last good build.</strong>{" "}
                    {previewSnap.error ? previewSnap.error.message : "The latest build failed."}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[10px] rounded flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Retry Build
                  </button>
                </div>
              )}

              {isErrorStage && !showingFallback && previewSnap.error && (
                <div className="mx-2 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/40 rounded text-red-200 text-[11px] flex items-center justify-between gap-2 shrink-0">
                  <span className="flex items-center gap-2 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                    <span className="truncate">{previewSnap.error.message}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-zinc-100 font-semibold text-[10px] rounded flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiPrompt(`Diagnose and repair failure: ${previewSnap.error?.message}`);
                        setAiMode("auto");
                        setRightTab("ai");
                        setRightPanelOpen(true);
                        if (window.innerWidth < 768) setMobileTab("assistant");
                      }}
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-[10px] rounded cursor-pointer"
                    >
                      Auto-Fix
                    </button>
                  </span>
                </div>
              )}

              {hasDirty && isRunning && (
                <div className="mx-2 mt-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-zinc-400 text-[11px] shrink-0">
                  You have unsaved changes — the preview shows saved revision {projState?.revision ?? 0}. Save to
                  rebuild it.
                </div>
              )}

              {previewWarnings.length > 0 && (
                <div className="mx-2 mt-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-zinc-400 text-[11px] shrink-0">
                  {previewWarnings.join(" ")}
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-auto bg-[#08090c] p-3 flex items-start justify-center">
                {!isRunning ? (
                  <div className="text-center p-8 space-y-3 max-w-sm m-auto">
                    <Square className="w-8 h-8 text-zinc-700 mx-auto" />
                    <div className="text-sm font-semibold text-zinc-200">Preview Stopped</div>
                    <p className="text-xs text-zinc-500">Start the live preview to run the saved project build.</p>
                    <button
                      type="button"
                      onClick={() => setIsRunning(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Preview
                    </button>
                  </div>
                ) : displayedDoc ? (
                  <div
                    className="relative shrink-0 mx-auto transition-[width] duration-150"
                    style={{
                      width: viewport === "desktop" ? "min(1440px, 100%)" : `${activeViewport.width}px`,
                      maxWidth: "100%",
                      height: "100%",
                      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                      transformOrigin: "top center",
                    }}
                  >
                    {(stage === "building" || stage === "loading") && !showingFallback && (
                      <div className="absolute inset-0 bg-[#0b0d10]/70 flex flex-col items-center justify-center z-10 space-y-2 rounded">
                        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                        <span className="text-xs font-mono text-zinc-300">
                          {stage === "building" ? "Compiling…" : "Loading preview…"}
                        </span>
                      </div>
                    )}
                    <iframe
                      key={displayedDoc.buildId + (showingFallback ? ":fallback" : ":current")}
                      ref={iframeRef}
                      srcDoc={displayedDoc.html}
                      title="Application Live Preview"
                      className="w-full h-full border border-white/10 rounded bg-slate-950 block"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-2 max-w-md m-auto">
                    <AlertTriangle className="w-8 h-8 text-red-400/70 mx-auto" />
                    <div className="text-sm font-semibold text-zinc-200">No preview available</div>
                    <p className="text-xs text-zinc-500">
                      {previewSnap.error?.message ||
                        "The project could not be built. Fix the reported problem and rebuild."}
                    </p>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-white/10 hover:bg-white/15 text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retry Build
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ---------- RIGHT: AI / Inspector / History ---------- */}
        {!isFocusPreview && rightPanelOpen && (
          <div
            onMouseDown={() => setIsResizingRight(true)}
            className="w-1 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500 transition-colors h-full hidden md:block shrink-0"
            title="Drag to resize right panel"
          />
        )}
        {!isFocusPreview && rightPanelOpen && (
          <aside
            style={{ width: `${rightPanelWidth}px` }}
            className={`shrink-0 h-full min-h-0 flex-col bg-[#101318] border-l border-white/10 ${
              mobileTab === "assistant" || mobileTab === "inspector"
                ? "flex w-full absolute inset-0 z-30 md:relative md:w-auto"
                : "hidden md:flex"
            }`}
          >
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 shrink-0">
              {(
                [
                  { id: "ai", label: "AI Assistant", Icon: MessageSquare },
                  { id: "inspector", label: "Inspector", Icon: Sliders },
                  { id: "history", label: "History", Icon: History },
                ] as Array<{ id: RightTab; label: string; Icon: any }>
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRightTab(id);
                    if (window.innerWidth < 768) {
                      setMobileTab(id === "ai" ? "assistant" : id === "inspector" ? "inspector" : "workspace");
                      if (id === "history") setMobileTab("assistant");
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                    rightTab === id ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {rightTab === "ai" && (
                <AIAssistantPanel
                  prompt={aiPrompt}
                  setPrompt={setAiPrompt}
                  mode={aiMode}
                  setMode={setAiMode}
                  isProcessing={isAiProcessing}
                  onSubmit={handlePlanAIEdit}
                  activePlan={activePlan}
                  onApplyPlan={handleApplyPlan}
                  onRejectPlan={handleRejectPlan}
                  onExecutePlanInMode={async (execMode) => {
                    if (!activePlan || !activeOperationId) return;
                    if (execMode === "auto") {
                      setIsAiProcessing(true);
                      try {
                        await executeApply(activePlan, activeOperationId);
                      } finally {
                        setIsAiProcessing(false);
                      }
                    } else {
                      setAiMode("edit");
                    }
                  }}
                  onOpenHistory={() => setRightTab("history")}
                  onToggleExpandChat={() => setRightPanelWidth((prev) => (prev > 480 ? 400 : 620))}
                  isChatExpanded={rightPanelWidth > 480}
                  conversationHistory={conversationHistory}
                  selectedFilePath={selectedFilePath}
                  activeOperationId={activeOperationId}
                  runtimeError={previewSnap.error?.message || null}
                  onNewSession={handleStartNewChatSession}
                />
              )}
              {rightTab === "inspector" && (
                <ElementInspector
                  selectedElement={selectedElement}
                  inspectMode={inspectMode}
                  setInspectMode={setInspectMode}
                  identifiedSourceFile={identified?.artifact ? identified.artifact.path : null}
                  onApplyLiveStyle={handleApplyLiveStyle}
                  onSaveStyleToSource={handleSaveStyleToSource}
                  recentChanges={inspectorChanges}
                  onUndoChange={handleUndoInspectorChange}
                  onRedoChange={handleRedoInspectorChange}
                  canUndo={inspectorChanges.length > 0}
                  canRedo={inspectorRedoStack.length > 0}
                  viewport={viewport === "small" ? "mobile" : viewport}
                />
              )}
              {rightTab === "history" && (
                <OperationHistoryView
                  entries={historyEntries}
                  onSelectEntry={() => {}}
                  onRevertEntry={handleRevertHistoryEntry}
                  onClearHistory={async () => {
                    if (selectedProjectId) {
                      await uiStudioHistoryStorage.clear(selectedProjectId);
                      setHistoryEntries([]);
                      pushNotification("info", "History Cleared", "Operation history records cleared.");
                    }
                  }}
                  onSelectFile={(path) => {
                    handleSelectFile(path);
                    setLeftSection("files");
                    if (!leftPanelOpen) setLeftPanelOpen(true);
                  }}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ======================= TEST RESULTS STRIP ======================= */}
      {showTestPanel && testReport && (
        <div className="shrink-0 border-t border-white/10 bg-[#101318] max-h-56 overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-[#101318]">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-100">
              Validation — {testReport.archetype.replace("_", " ")} · Score {testReport.score}%
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                testReport.functionalStatus === "passed"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : testReport.functionalStatus === "failed"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-white/5 text-zinc-400"
              }`}
            >
              Functional: {testReport.functionalStatus.replace("_", " ")}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowTestPanel(false)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/5 cursor-pointer"
              title="Close test results"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-3 pb-2 grid md:grid-cols-2 gap-x-4 gap-y-1">
            {testReport.checks.map((check, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] py-0.5">
                {check.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-px" />
                )}
                <span className={check.passed ? "text-zinc-300" : "text-red-200"}>
                  <strong className="font-medium">{check.name}</strong>
                  <span className="text-zinc-500"> — {check.detail}</span>
                </span>
              </div>
            ))}
          </div>
          {testReport.errors.length > 0 && (
            <div className="px-3 pb-3 space-y-1">
              {testReport.errors.map((err, i) => (
                <p key={i} className="text-[11px] text-red-300 font-mono">
                  {err.type}: {err.message}
                  {err.file ? ` (${err.file})` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <InAppNotificationBanner notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
};
