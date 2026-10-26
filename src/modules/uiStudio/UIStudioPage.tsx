import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Monitor,
  Tablet,
  Smartphone,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Eye,
  MessageSquare,
  Sliders,
  MousePointerClick,
  X,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type {
  AIEditPlan,
  AIConversationMessage,
  UIStudioNotification,
  PreviewBuildResult,
} from "@/types/uiStudio";
import type { OperationHistoryEntry } from "@/types/uiStudioHistory";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { uiStudioHistoryStorage } from "@/lib/storage/uiStudioHistoryStorage";
import { uiChatSessionStorage, type UIChatSession } from "@/lib/storage/uiChatSessionStorage";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";
import { planAIEdits } from "@/lib/uiStudio/aiEditEngine";
import { ElementInspector } from "./ElementInspector";
import { AIAssistantPanel } from "./AIAssistantPanel";
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
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

type StudioViewport = "desktop" | "tablet" | "mobile" | "small";
type RightTab = "ai" | "inspector";
type MobileTab = "workspace" | "assistant" | "inspector";

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

  // --- File context (the AI assistant's active file; editing lives in Build Studio) ---
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const tabsByProjectRef = useRef<Record<string, { open: string[]; active: string | null }>>({});

  // --- Layout -----------------------------------------------------------------
  const [rightTab, setRightTab] = useState<RightTab>("ai");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("workspace");

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
  // One automatic rebuild per project+revision when a preview times out
  // (cold CDN load). This is what users previously had to do by hand with
  // Retry Build on first open; the retry is capped so it can never loop.
  const timeoutRetryKeyRef = useRef<string>("");

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

  // --- History / notifications ---------------------------------------------------
  // Operation history is still recorded to storage by the AI/inspector pipelines
  // (status + verification updates); the History panel itself was removed from
  // the layout, so only the setter is kept here.
  const [historyEntries, setHistoryEntries] = useState<OperationHistoryEntry[]>([]);
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

  // Auto-retry once on a preview timeout (cold CDN load on first open).
  useEffect(() => {
    if (previewSnap.stage !== "load_timeout" && previewSnap.stage !== "mount_timeout") return;
    if (!selectedProjectId || !projState) return;
    const key = `${selectedProjectId}|${projState.revision}`;
    if (timeoutRetryKeyRef.current === key) return;
    timeoutRetryKeyRef.current = key;
    const timer = setTimeout(() => {
      lastBuildKeyRef.current = "";
      startBuild();
    }, 800);
    return () => clearTimeout(timer);
  }, [previewSnap, selectedProjectId, projState, startBuild]);

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
      if (type === "PREVIEW_NAVIGATE" && typeof e.data.route === "string") {
        setSelectedRoute(e.data.route);
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

  const identified = useMemo(() => {
    if (!selectedElement || savedArtifacts.length === 0) return null;
    return resolveSourceArtifactForElement(selectedElement, savedArtifacts);
  }, [selectedElement, savedArtifacts]);

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

  const handleRetryFailed = async () => {
    if (!selectedProjectId) return;
    for (const f of failedFiles) {
      await manager.retrySave(selectedProjectId, f.path);
    }
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
        // Mark project as successfully generated
        if (selectedProject.generationStatus !== "generated") {
          await projectStorage.update(selectedProject.id, { generationStatus: "generated" });
          setProjects((prev) =>
            prev.map((p) => (p.id === selectedProject.id ? { ...p, generationStatus: "generated" } : p))
          );
        }
      }
    } catch (err: any) {
      pushNotification("error", "AI Operation Failed", err.message || "Failed to formulate edit plan");
      if (selectedProject.generationStatus === "generating") {
        await projectStorage.update(selectedProject.id, { generationStatus: "failed" });
        setProjects((prev) =>
          prev.map((p) => (p.id === selectedProject.id ? { ...p, generationStatus: "failed" } : p))
        );
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Dedicated single-prompt initial project generation handler
  const handleGenerateInitialProject = async () => {
    if (!selectedProject || !selectedProjectId || isAiProcessing) return;
    const initialPrompt = selectedProject.initialPrompt || selectedProject.objective || selectedProject.description;
    if (!initialPrompt) return;

    // Synchronous in-flight guard
    setIsAiProcessing(true);
    await projectStorage.update(selectedProject.id, { generationStatus: "generating" });
    setProjects((prev) =>
      prev.map((p) => (p.id === selectedProject.id ? { ...p, generationStatus: "generating" } : p))
    );

    const operationId = `op_init_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveOperationId(operationId);

    const userMsg: AIConversationMessage = {
      id: `msg_user_${Date.now()}`,
      operationId,
      role: "user",
      mode: "auto",
      content: initialPrompt,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...conversationHistory, userMsg];
    setConversationHistory(nextHistory);
    persistChatMessages(nextHistory);

    try {
      const plan = await planAIEdits({
        operationId,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        userPrompt: initialPrompt,
        mode: "auto",
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
        userPrompt: initialPrompt,
        mode: "auto",
        affectedFiles: plan.items.map((i) => i.filePath),
        summary: plan.summary,
        diffExplanation: plan.items[0]?.diffExplanation,
        status: "applied",
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
        mode: "auto",
        content: plan.advisoryText || plan.summary,
        timestamp: new Date().toISOString(),
        plan,
      };
      const finalHistory = [...nextHistory, assistantMsg];
      setConversationHistory(finalHistory);
      persistChatMessages(finalHistory);

      if (plan.items.length > 0) {
        await executeApply(plan, operationId);
        await projectStorage.update(selectedProject.id, { generationStatus: "generated" });
        setProjects((prev) =>
          prev.map((p) => (p.id === selectedProject.id ? { ...p, generationStatus: "generated" } : p))
        );
      }
    } catch (err: any) {
      pushNotification("error", "Initial Generation Failed", err.message || "Failed to formulate initial code");
      await projectStorage.update(selectedProject.id, { generationStatus: "failed" });
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? { ...p, generationStatus: "failed" } : p))
      );
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

  const activeViewport = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];
  const hasDirty = selectedProjectId ? manager.isDirty(selectedProjectId) : false;
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

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0b0d10] text-zinc-200">
      {/* ======================= TOP BAR ======================= */}
      <div className="h-11 shrink-0 flex items-center gap-2 px-2 border-b border-white/10 bg-[#101318] z-20">
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

        <div className="flex-1" />
      </div>

      {/* ======================= MOBILE TAB BAR ======================= */}
      <div className="md:hidden h-10 border-b border-white/10 bg-[#101318] flex items-center px-1 shrink-0 text-xs font-medium">
        {(
          [
            { id: "workspace", label: "Preview", Icon: Eye },
            { id: "assistant", label: "Assistant", Icon: MessageSquare },
            { id: "inspector", label: "Inspector", Icon: Sliders },
          ] as Array<{ id: MobileTab; label: string; Icon: any }>
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMobileTab(id);
              // Reopening matters: the panel can be closed with the X in
              // its header, and without this the mobile tabs would switch
              // state while the panel stayed closed (invisible no-op).
              setRightPanelOpen(true);
              if (id === "assistant") setRightTab("ai");
              if (id === "inspector") setRightTab("inspector");
            }}
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
        {/* ---------- CENTER: Live Preview ---------- */}
        <main
          className={`flex-1 min-w-0 h-full min-h-0 ${mobileTab === "workspace" ? "flex" : "hidden md:flex"}`}
        >
          {/* Preview */}
          <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0b0d10]">
              <div className="h-9 shrink-0 flex items-center gap-2 px-2.5 bg-[#101318] border-b border-white/10">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Live Preview</span>
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
                {/* Viewport controls — set the REAL iframe width; content reflows */}
                <div className="hidden md:flex items-center bg-[#0b0d10] border border-white/10 rounded p-0.5">
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
                      // On phones the inspector lives behind the mobile
                      // tab bar: without this, Inspect only turned green
                      // and showed nothing (same pattern as Auto-Fix and
                      // element-selected messages below, which do switch).
                      if (window.innerWidth < 768) setMobileTab("inspector");
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
                {!rightPanelOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setRightPanelOpen(true);
                      setRightTab("ai");
                      if (window.innerWidth < 768) setMobileTab("assistant");
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-white/10 text-zinc-300 hover:bg-white/5 cursor-pointer"
                    title="Open AI assistant panel"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Assistant</span>
                  </button>
                )}
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
                <div className="mx-2 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/40 rounded text-red-200 text-[11px] flex items-start justify-between gap-2 shrink-0">
                  <span className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
                    {/* <pre>, not a truncated span: preview runtime errors are
                        now multi-line (entry file, export resolution, the
                        exact reason) and truncating them to one line hid
                        exactly the detail the jury needs to see. */}
                    <pre className="whitespace-pre-wrap break-words max-h-40 overflow-auto flex-1 text-left font-sans">
                      {previewSnap.error.message}
                    </pre>
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

              <div className="flex-1 min-h-0 overflow-auto overscroll-contain bg-[#08090c] p-3 flex items-start justify-center">
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
                  <div className="text-center p-8 space-y-2 max-w-lg m-auto">
                    <AlertTriangle className="w-8 h-8 text-red-400/70 mx-auto" />
                    <div className="text-sm font-semibold text-zinc-200">No preview available</div>
                    {/* <pre>, not <p>: enriched transpilation diagnostics are
                        multi-line (file + source snippet with a caret), and
                        a <p> collapses newlines, hiding the snippet. */}
                    <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-words text-left max-h-72 overflow-auto rounded bg-white/5 border border-white/10 p-3">
                      {previewSnap.error?.message ||
                        "The project could not be built. Fix the reported problem and rebuild."}
                    </pre>
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
        </main>

        {/* ---------- RIGHT: AI Assistant / Inspector ---------- */}
        {rightPanelOpen && (
          <div
            onMouseDown={() => setIsResizingRight(true)}
            className="w-1 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500 transition-colors h-full hidden md:block shrink-0"
            title="Drag to resize right panel"
          />
        )}
        {rightPanelOpen && (
          <aside
            style={{ width: `${rightPanelWidth}px` }}
            className={`shrink-0 h-full min-h-0 flex-col bg-[#101318] border-l border-white/10 max-w-full ${
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
                ] as Array<{ id: RightTab; label: string; Icon: any }>
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRightTab(id);
                    if (window.innerWidth < 768) {
                      setMobileTab(id === "ai" ? "assistant" : "inspector");
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
              {/* Previously there was no way to close this panel at all
                  (no setRightPanelOpen(false) anywhere), so the preview
                  could never go full-width. Reopen: mobile tab bar, or
                  the Assistant button in the preview header. */}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setRightPanelOpen(false)}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/5 cursor-pointer"
                title="Close assistant / inspector panel"
                aria-label="Close assistant / inspector panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
                  onToggleExpandChat={() => setRightPanelWidth((prev) => (prev > 480 ? 400 : 620))}
                  isChatExpanded={rightPanelWidth > 480}
                  conversationHistory={conversationHistory}
                  selectedFilePath={selectedFilePath}
                  activeOperationId={activeOperationId}
                  runtimeError={previewSnap.error?.message || null}
                  onNewSession={handleStartNewChatSession}
                  pendingCreationPrompt={
                    selectedProject?.generationStatus === "not_generated" ||
                    selectedProject?.generationStatus === "failed" ||
                    (Boolean(selectedProject?.initialPrompt) && (!historyEntries.length || selectedProject?.generationStatus !== "generated"))
                      ? selectedProject?.initialPrompt || null
                      : null
                  }
                  onGenerateInitialProject={handleGenerateInitialProject}
                />
              )}
              {rightTab === "inspector" && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
                </div>
              )}
            </div>
          </aside>
        )}
      </div>


      <InAppNotificationBanner notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
};
