import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Code2,
  Play,
  Download,
  MonitorPlay,
  Save,
  CheckCircle2,
  PanelBottom,
  PanelRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildArtifact } from "@/types/artifact";
import { IDEActivityBar, type ActivityBarTab } from "@/components/build/IDEActivityBar";
import { IDEFileExplorer } from "@/components/build/IDEFileExplorer";
import { IDEEditorTabs, type EditorTabItem } from "@/components/build/IDEEditorTabs";
import { MonacoCodeEditor, inferMonacoLanguage } from "@/components/build/MonacoCodeEditor";
import { IDEBottomPanel, type BottomPanelTab, type DiagnosticProblem } from "@/components/build/IDEBottomPanel";
import { IDEStatusBar } from "@/components/build/IDEStatusBar";
import { IDEAIAssistant } from "@/components/build/IDEAIAssistant";
import { workspaceApiClient } from "@/lib/workspace/workspaceApiClient";
import { deploymentApiClient, type ServerGitStatus } from "@/lib/deployment/deploymentApiClient";
import { testStorage } from "@/lib/storage/testStorage";
import { parseCompilerDiagnostics } from "@/lib/build/diagnosticParser";
import {
  AIContinueCodeDiffModal,
  type AIContinuationProposal,
} from "@/components/build/AIContinueCodeDiffModal";
import { AICodeExplainerPanel } from "@/components/build/AICodeExplainerPanel";
import type { CodeExplanationResult, CodeExplainerMode } from "@/types/codeExplainer";
import { sanitizeString } from "@/lib/observability/sanitizer";
import { aiClient } from "@/lib/ai/client";
import { Sparkles, BookOpen } from "lucide-react";

interface VSCodeIDEWorkspaceProps {
  projectId: string;
  projectName: string;
  artifacts: BuildArtifact[];
  plannedPaths: string[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onSaveContent: (path: string, newContent: string) => Promise<void>;
  onCreateFile: (path: string) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
  onRegenerateFile?: (path: string) => Promise<void>;
  onApproveArtifact?: (path: string) => Promise<void>;
  onOpenZipModal: () => void;
  onOpenUIStudio?: () => void;
  onOpenLivePreview?: () => void;
  isGenerating?: boolean;
}

export const VSCodeIDEWorkspace: React.FC<VSCodeIDEWorkspaceProps> = ({
  projectId,
  projectName,
  artifacts,
  plannedPaths,
  selectedPath,
  onSelectPath,
  onSaveContent,
  onCreateFile,
  onDeleteFile,
  onOpenZipModal,
  onOpenUIStudio,
  onOpenLivePreview,
}) => {
  // Activity Bar Tab
  const [activityTab, setActivityTab] = useState<ActivityBarTab>("explorer");

  // Open Editor Tabs
  const [openTabs, setOpenTabs] = useState<EditorTabItem[]>([]);
  const [editorContents, setEditorContents] = useState<Record<string, string>>({});
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());

  // Bottom Panel State (persisted per session)
  const [bottomOpen, setBottomOpen] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem("nova_ide_bottom_open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem("nova_ide_bottom_height");
      return saved !== null ? Math.min(550, Math.max(120, JSON.parse(saved))) : 240;
    } catch {
      return 240;
    }
  });
  const [isBottomMaximized, setIsBottomMaximized] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const [bottomTab, setBottomTab] = useState<BottomPanelTab>("terminal");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);

  // Sync bottom panel open state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("nova_ide_bottom_open", JSON.stringify(bottomOpen));
    } catch {}
  }, [bottomOpen]);

  // Sync bottom panel height to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("nova_ide_bottom_height", JSON.stringify(bottomHeight));
    } catch {}
  }, [bottomHeight]);

  // Panel resize drag handler
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = bottomHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartYRef.current - moveEvent.clientY;
      const newHeight = Math.min(550, Math.max(120, dragStartHeightRef.current + delta));
      setBottomHeight(newHeight);
      setIsBottomMaximized(false);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // AI Assistant Panel
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  // AI Code Explainer State
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [explainerMode, setExplainerMode] = useState<CodeExplainerMode>("eli5");
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationResult, setExplanationResult] = useState<CodeExplanationResult | null>(null);
  const [explainerError, setExplainerError] = useState<string | null>(null);
  const [explainerSelection, setExplainerSelection] = useState<{
    text: string;
    range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null;
  } | null>(null);
  const [highlightLineRange, setHighlightLineRange] = useState<{ startLineNumber: number; endLineNumber?: number } | null>(null);

  // AI Continue Code State
  const [continuationProposal, setContinuationProposal] = useState<AIContinuationProposal | null>(null);
  const [isGeneratingContinuation, setIsGeneratingContinuation] = useState(false);
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const monacoEditorInstanceRef = useRef<any>(null);

  // Diagnostics & Tests
  const [problems, setProblems] = useState<DiagnosticProblem[]>([]);
  const [targetDiagnosticLine, setTargetDiagnosticLine] = useState<number | undefined>(undefined);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number; running: boolean } | null>(null);

  // Git Status
  const [gitStatus, setGitStatus] = useState<ServerGitStatus | null>(null);

  // Full-Screen IDE Mode State & Refs
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootContainerRef = useRef<HTMLDivElement>(null);

  // Broadcast fullscreen state changes to parent layout (AppShell, BuildStudioPage)
  const notifyFullscreenChange = useCallback((active: boolean) => {
    setIsFullscreen(active);
    window.dispatchEvent(
      new CustomEvent("nova-ide-fullscreen-change", {
        detail: { isFullscreen: active },
      })
    );
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreen) {
      notifyFullscreenChange(true);
      // Attempt browser Fullscreen API if supported and enabled
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        try {
          if (rootContainerRef.current) {
            await rootContainerRef.current.requestFullscreen();
          } else if (document.documentElement) {
            await document.documentElement.requestFullscreen();
          }
        } catch {
          // Graceful fallback to CSS viewport fullscreen
        }
      }
    } else {
      notifyFullscreenChange(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore exit failures
        }
      }
    }
  }, [isFullscreen, notifyFullscreenChange]);

  // Handle native browser fullscreen change events (e.g. user pressed Esc in browser)
  useEffect(() => {
    const handleNativeFullscreenChange = () => {
      const isNative = Boolean(document.fullscreenElement);
      if (!isNative && isFullscreen) {
        notifyFullscreenChange(false);
      }
    };

    document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleNativeFullscreenChange);
    };
  }, [isFullscreen, notifyFullscreenChange]);

  // Handle keyboard shortcuts: Escape key to exit fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        notifyFullscreenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, notifyFullscreenChange]);

  // Clean up fullscreen state on unmount
  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("nova-ide-fullscreen-change", {
          detail: { isFullscreen: false },
        })
      );
    };
  }, []);

  // Initialize tabs when selectedPath changes
  useEffect(() => {
    if (!selectedPath) return;

    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === selectedPath)) return prev;
      return [...prev, { path: selectedPath, isDirty: false }];
    });

    const art = artifacts.find((a) => a.path === selectedPath);
    if (art && editorContents[selectedPath] === undefined) {
      setEditorContents((prev) => ({ ...prev, [selectedPath]: art.content }));
    }
  }, [selectedPath, artifacts]);

  // Load project tests & git status on mount or project change
  useEffect(() => {
    async function loadDiagnostics() {
      // Load real tests from testStorage
      try {
        const plans = testStorage.listPlans(projectId);
        if (plans.length > 0) {
          const plan = plans[0];
          const cases = plan.testCases || [];
          const total = cases.length;
          const passed = cases.filter((c) => c.status === "passed").length;
          const failed = cases.filter((c) => c.status === "failed").length;
          setTestSummary({ total, passed, failed, running: false });

          // Map failed tests to Problems tab
          const failedProblems: DiagnosticProblem[] = cases
            .filter((c) => c.status === "failed")
            .map((c, i) => ({
              id: `prob_test_${i}`,
              severity: "error",
              file: (c as any).targetArtifactPath || "tests",
              line: 1,
              column: 1,
              message: `Test Failure: ${c.name} — ${c.description}`,
              source: "Test Engine (Phase 15)",
            }));
          setProblems(failedProblems);
        }
      } catch (err) {
        console.warn("[IDE] Error loading tests:", err);
      }

      // Load real Git Status
      try {
        const git = await deploymentApiClient.getGitStatus();
        setGitStatus(git);
      } catch (err) {
        console.warn("[IDE] Error loading git status:", err);
      }
    }

    loadDiagnostics();
  }, [projectId]);

  // Active artifact & content
  const activeArtifact = selectedPath ? artifacts.find((a) => a.path === selectedPath) || null : null;
  const currentContent = selectedPath
    ? editorContents[selectedPath] !== undefined
      ? editorContents[selectedPath]
      : activeArtifact?.content || ""
    : "";
  const isCurrentDirty = selectedPath ? dirtyTabs.has(selectedPath) : false;

  const handleEditorChange = (newVal: string) => {
    if (!selectedPath) return;
    setEditorContents((prev) => ({ ...prev, [selectedPath]: newVal }));
    const orig = activeArtifact?.content || "";
    if (newVal !== orig) {
      setDirtyTabs((prev) => new Set(prev).add(selectedPath));
    } else {
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete(selectedPath);
        return next;
      });
    }
  };

  const handleSaveActive = async () => {
    if (!selectedPath) return;
    const contentToSave = editorContents[selectedPath] ?? activeArtifact?.content ?? "";
    await onSaveContent(selectedPath, contentToSave);

    // Also sync to server-side workspace disk
    await workspaceApiClient.writeFile(projectId, selectedPath, contentToSave);

    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(selectedPath);
      return next;
    });

    setTerminalLogs((prev) => [...prev, `[File Saved] ${selectedPath} synchronized to workspace.`]);
  };

  const handleCloseTab = (path: string) => {
    if (dirtyTabs.has(path)) {
      const confirm = window.confirm(`File "${path}" has unsaved changes. Close anyway?`);
      if (!confirm) return;
    }

    const nextTabs = openTabs.filter((t) => t.path !== path);
    setOpenTabs(nextTabs);
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });

    if (selectedPath === path) {
      if (nextTabs.length > 0) {
        onSelectPath(nextTabs[nextTabs.length - 1].path);
      } else {
        onSelectPath("");
      }
    }
  };

  const handleExecuteTerminalCommand = async (command: string) => {
    setIsRunningCommand(true);
    setTerminalLogs((prev) => [...prev, `$ ${command}`]);

    // Ensure all artifacts are synced to disk before building or running commands
    const filePayload = artifacts.map((a) => ({
      path: a.path,
      content: editorContents[a.path] !== undefined ? editorContents[a.path] : a.content,
    }));
    await workspaceApiClient.syncArtifactsToWorkspace(projectId, filePayload);

    const res = await workspaceApiClient.executeCommand(projectId, command);
    setActiveProcessId(res.processId);

    if (res.logs && res.logs.length > 0) {
      setTerminalLogs((prev) => [...prev, ...res.logs]);

      // If command was a TypeScript check or build, parse diagnostics
      if (command.includes("tsc") || command.includes("build")) {
        const parsed = parseCompilerDiagnostics(res.logs);
        if (parsed.length > 0) {
          setProblems(parsed);
        } else if (res.exitCode === 0) {
          setProblems([]);
        }
      }
    }

    if (res.error) {
      setTerminalLogs((prev) => [...prev, `Error: ${res.error}`]);
    } else {
      setTerminalLogs((prev) => [
        ...prev,
        `[Process exited with code ${res.exitCode !== null ? res.exitCode : 0}]`,
      ]);
    }

    // Refresh git status if it was a git command or save
    if (command.startsWith("git")) {
      try {
        const git = await deploymentApiClient.getGitStatus(projectId);
        setGitStatus(git);
      } catch {}
    }

    setIsRunningCommand(false);
  };

  const handleKillTerminalProcess = async () => {
    if (!activeProcessId) return;
    await workspaceApiClient.killProcess(activeProcessId);
    setTerminalLogs((prev) => [...prev, `[Process ${activeProcessId} terminated by user]`]);
    setIsRunningCommand(false);
  };

  const handleSelectProblem = (prob: DiagnosticProblem) => {
    if (prob.file && prob.file !== "tests") {
      onSelectPath(prob.file);
      setTargetDiagnosticLine(prob.line);
    }
  };

  // AI Continue Code Handler
  const handleTriggerContinueCode = async (explicitContext?: {
    prefix: string;
    suffix: string;
    selectedText: string;
    position: { lineNumber: number; column: number };
    selectionRange: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }) => {
    if (!selectedPath || isGeneratingContinuation) return;

    let prefix = "";
    let suffix = "";
    let selectedText = "";
    let range: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null = null;

    if (explicitContext) {
      prefix = explicitContext.prefix;
      suffix = explicitContext.suffix;
      selectedText = explicitContext.selectedText;
      range = explicitContext.selectionRange;
    } else if (monacoEditorInstanceRef.current) {
      const editor = monacoEditorInstanceRef.current;
      const model = editor.getModel();
      if (model) {
        const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
        const sel = editor.getSelection();
        const hasSel =
          sel &&
          (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn);

        const full = model.getValue();
        const cursorOffset = model.getOffsetAt(pos);

        selectedText = hasSel ? model.getValueInRange(sel) : "";
        prefix = hasSel
          ? full.slice(0, model.getOffsetAt(sel.getStartPosition()))
          : full.slice(0, cursorOffset);
        suffix = hasSel
          ? full.slice(model.getOffsetAt(sel.getEndPosition()))
          : full.slice(cursorOffset);

        if (hasSel) {
          range = {
            startLineNumber: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLineNumber: sel.endLineNumber,
            endColumn: sel.endColumn,
          };
        }
      }
    } else {
      // Fallback: cursor at end of document
      prefix = currentContent;
      suffix = "";
    }

    setIsGeneratingContinuation(true);
    setContinuationError(null);

    // Provide relevant context files (up to 3 other files in project)
    const contextFiles = artifacts
      .filter((a) => a.path !== selectedPath && (a.path.endsWith(".ts") || a.path.endsWith(".tsx")))
      .slice(0, 3)
      .map((a) => ({
        path: a.path,
        content: editorContents[a.path] || a.content || "",
      }));

    try {
      const res = await aiClient.continueCode({
        projectName,
        filePath: selectedPath,
        language: inferMonacoLanguage(selectedPath),
        prefixContent: prefix,
        suffixContent: suffix,
        selectedCode: selectedText,
        contextFiles,
      });

      const continuation = res.continuation || "";
      const proposedFullContent = prefix + continuation + suffix;

      setContinuationProposal({
        filePath: selectedPath,
        originalText: currentContent,
        proposedText: proposedFullContent,
        continuationSnippet: continuation,
        summary: res.summary || "AI continuation generated",
        intent: res.intent || "continuation",
        insertionRange: range,
      });
    } catch (err: any) {
      setContinuationError(err.message || "Failed to generate code continuation");
      // Still show modal if proposal was open or create empty proposal with error
      setContinuationProposal({
        filePath: selectedPath,
        originalText: currentContent,
        proposedText: currentContent,
        continuationSnippet: "",
        summary: "Continuation generation failed",
        intent: "continuation",
        insertionRange: range,
      });
    } finally {
      setIsGeneratingContinuation(false);
    }
  };

  const handleAcceptContinuation = () => {
    if (!continuationProposal || !selectedPath) return;

    handleEditorChange(continuationProposal.proposedText);
    setContinuationProposal(null);
    setContinuationError(null);

    setTerminalLogs((prev) => [
      ...prev,
      `[AI Continue Code] Applied: ${continuationProposal.summary} (${continuationProposal.filePath})`,
    ]);
  };

  const handleRejectContinuation = () => {
    setContinuationProposal(null);
    setContinuationError(null);
  };

  // AI Code Explainer Trigger Handler
  const handleTriggerExplainCode = async (explicitContext?: {
    filePath: string;
    selectedText: string;
    selectionRange: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }, overrideMode?: CodeExplainerMode) => {
    const targetPath = explicitContext?.filePath || selectedPath;
    if (!targetPath) return;

    const targetMode = overrideMode || explainerMode;
    const currentCode = editorContents[targetPath] || (targetPath === selectedPath ? currentContent : "");
    if (!currentCode.trim()) return;

    // Check editor selection if explicitContext wasn't given
    let selectedText = explicitContext ? explicitContext.selectedText : "";
    let selectionRange = explicitContext ? explicitContext.selectionRange : null;

    if (!explicitContext && monacoEditorInstanceRef.current && targetPath === selectedPath) {
      const editor = monacoEditorInstanceRef.current;
      const model = editor.getModel();
      const sel = editor.getSelection();
      if (model && sel && (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn)) {
        selectedText = model.getValueInRange(sel);
        selectionRange = {
          startLineNumber: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLineNumber: sel.endLineNumber,
          endColumn: sel.endColumn,
        };
      }
    }

    setExplainerSelection(selectedText ? { text: selectedText, range: selectionRange } : null);
    setExplainerOpen(true);
    setIsExplaining(true);
    setExplainerError(null);
    setHighlightLineRange(null);

    // Sanitize any potential API secrets before sending to AI
    const sanitizedContent = sanitizeString(currentCode);
    const sanitizedSelectedCode = selectedText ? sanitizeString(selectedText) : undefined;

    // Gather project context files
    const contextFiles = artifacts
      .filter((a) => a.path !== targetPath && (a.path.endsWith(".ts") || a.path.endsWith(".tsx")))
      .slice(0, 3)
      .map((a) => ({
        path: a.path,
        content: sanitizeString(editorContents[a.path] || a.content || ""),
      }));

    try {
      const res = await aiClient.explainCode({
        projectName,
        filePath: targetPath,
        language: inferMonacoLanguage(targetPath),
        fileContent: sanitizedContent,
        selectedCode: sanitizedSelectedCode,
        mode: targetMode,
        selectionRange: selectionRange || undefined,
        contextFiles,
      });

      setExplanationResult(res);
    } catch (err: any) {
      console.error("[Explain Code Error]:", err);
      setExplainerError(err.message || "Failed to generate AI code explanation.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleExplainerModeSwitch = (newMode: CodeExplainerMode) => {
    setExplainerMode(newMode);
    handleTriggerExplainCode(
      explainerSelection
        ? {
            filePath: selectedPath || "",
            selectedText: explainerSelection.text,
            selectionRange: explainerSelection.range,
          }
        : undefined,
      newMode
    );
  };

  return (
    <div
      ref={rootContainerRef}
      className={cn(
        "flex flex-col bg-[#1e1e1e] text-[#cccccc] transition-all duration-150",
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen h-[100dvh] max-h-screen rounded-none border-0 overflow-hidden shadow-none"
          : "h-[780px] border-2 border-border rounded-tactile overflow-hidden shadow-hard"
      )}
    >
      {/* Top IDE Application Bar */}
      <div className="h-10 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-3 text-xs select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white tracking-wide">ProjectNova Studio IDE</span>
          <span className="text-[10px] text-gray-400 border border-gray-600 px-1.5 py-0.2 rounded font-mono">
            {projectName}
          </span>
        </div>

        {/* Global Toolbar Shortcuts */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSaveActive}
            disabled={!selectedPath || !isCurrentDirty}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#007acc] hover:bg-[#0062a3] text-white rounded font-bold text-xs disabled:opacity-40 transition-colors"
            title="Save Active File (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          {/* AI Continue Code Toolbar Button */}
          <button
            onClick={() => handleTriggerContinueCode()}
            disabled={!selectedPath || isGeneratingContinuation}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-xs disabled:opacity-40 transition-colors shadow-sm"
            title="AI: Continue Code from cursor or complete current section (Ctrl+K)"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-200 ${isGeneratingContinuation ? "animate-spin" : ""}`} />
            <span>{isGeneratingContinuation ? "Generating…" : "Continue Code"}</span>
          </button>

          {/* AI Explain Code Toolbar Button */}
          <button
            onClick={() => handleTriggerExplainCode()}
            disabled={!selectedPath || isExplaining}
            className={`flex items-center gap-1 px-2.5 py-1 text-white rounded font-bold text-xs disabled:opacity-40 transition-colors shadow-sm ${
              explainerOpen
                ? "bg-amber-600 hover:bg-amber-500"
                : "bg-[#3c3c3c] hover:bg-[#4a4a4a]"
            }`}
            title="AI: Explain Code (ELI5 & Normal modes)"
          >
            <BookOpen className={`w-3.5 h-3.5 text-amber-300 ${isExplaining ? "animate-spin" : ""}`} />
            <span>{isExplaining ? "Explaining…" : "Explain Code"}</span>
          </button>

          <button
            onClick={() => handleExecuteTerminalCommand("bun run build")}
            disabled={isRunningCommand}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold text-xs transition-colors"
            title="Run build verification in workspace sandbox"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Build</span>
          </button>

          <button
            onClick={() => handleExecuteTerminalCommand("bun run test")}
            disabled={isRunningCommand}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold text-xs transition-colors"
            title="Execute test suite in workspace sandbox"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Test</span>
          </button>

          <button
            onClick={onOpenLivePreview || onOpenUIStudio}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold text-xs transition-colors"
            title="Open In-App Live Preview"
          >
            <MonitorPlay className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Preview</span>
          </button>

          <button
            onClick={onOpenZipModal}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold text-xs transition-colors"
            title="Download Workspace as ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ZIP</span>
          </button>

          <div className="w-[1px] h-4 bg-gray-600 mx-1" />

          <button
            onClick={() => setBottomOpen(!bottomOpen)}
            className={`p-1.5 rounded transition-colors ${bottomOpen ? "bg-[#007acc] text-white" : "text-gray-400 hover:text-white"}`}
            title="Toggle Bottom Terminal / Problems Panel"
          >
            <PanelBottom className="w-4 h-4" />
          </button>

          <button
            onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
            className={`p-1.5 rounded transition-colors ${aiAssistantOpen ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-emerald-400"}`}
            title="Toggle AI Assistant"
          >
            <PanelRight className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={cn(
              "p-1.5 rounded transition-colors ml-0.5",
              isFullscreen
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
            )}
            title={isFullscreen ? "Restore Viewport (Esc)" : "Expand Full-Screen IDE Mode"}
            aria-label={isFullscreen ? "Restore Viewport" : "Expand Full-Screen IDE Mode"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Workbench Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Bar */}
        <IDEActivityBar
          activeTab={activityTab}
          onSelectTab={(tab) => {
            if (tab === "ai") {
              setAiAssistantOpen(true);
            } else if (tab === "explorer" && activityTab === "explorer") {
              // Clicking the active explorer icon collapses/toggles the explorer side bar
              setActivityTab("" as any);
            } else {
              setActivityTab(tab);
            }
          }}
          problemCount={problems.length}
          changedFileCount={gitStatus?.changedFiles?.length || 0}
        />

        {/* Primary Side Bar: File Explorer */}
        {activityTab === "explorer" && (
          <div className="w-64 shrink-0 h-full">
            <IDEFileExplorer
              files={artifacts}
              plannedPaths={plannedPaths}
              selectedPath={selectedPath}
              onSelectFile={onSelectPath}
              onCreateFile={onCreateFile}
              onDeleteFile={onDeleteFile}
              onRefresh={() => {}}
            />
          </div>
        )}

        {/* Center: Editor & Bottom Panel */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Editor Tabs Bar */}
          <IDEEditorTabs
            openTabs={openTabs.map((t) => ({ ...t, isDirty: dirtyTabs.has(t.path) }))}
            activePath={selectedPath}
            onSelectTab={onSelectPath}
            onCloseTab={handleCloseTab}
          />

          {/* Monaco Code Editor Area */}
          <div className="flex-1 relative overflow-hidden">
            {selectedPath ? (
              <MonacoCodeEditor
                filePath={selectedPath}
                value={currentContent}
                language={inferMonacoLanguage(selectedPath)}
                onChange={handleEditorChange}
                onSave={handleSaveActive}
                diagnosticLine={targetDiagnosticLine}
                highlightLineRange={highlightLineRange}
                onContinueCode={handleTriggerContinueCode}
                onExplainCode={(ctx) => handleTriggerExplainCode(ctx)}
                onMountEditor={(editor) => {
                  monacoEditorInstanceRef.current = editor;
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 select-none">
                <Code2 className="w-12 h-12 text-gray-600" />
                <p className="text-sm font-semibold">No file selected in editor</p>
                <p className="text-xs text-gray-500">Select a file from the Explorer on the left to begin coding.</p>
              </div>
            )}
          </div>

          {/* Bottom Panel: Terminal, Problems, Output, Tests, Git */}
          {bottomOpen && (
            <div
              style={{ height: isBottomMaximized ? "75%" : `${bottomHeight}px` }}
              className="shrink-0 flex flex-col relative transition-all duration-75"
            >
              {/* Top Resizer Handle */}
              <div
                onMouseDown={handleStartResize}
                className="h-1.5 w-full bg-[#2d2d2d] hover:bg-[#007acc] cursor-row-resize shrink-0 transition-colors"
                title="Drag to resize panel"
              />
              <div className="flex-1 overflow-hidden">
                <IDEBottomPanel
                  activeTab={bottomTab}
                  onSelectTab={setBottomTab}
                  terminalLogs={terminalLogs}
                  isRunningCommand={isRunningCommand}
                  onExecuteCommand={handleExecuteTerminalCommand}
                  onClearTerminal={() => setTerminalLogs([])}
                  onKillProcess={handleKillTerminalProcess}
                  problems={problems}
                  onSelectProblem={handleSelectProblem}
                  testSummary={testSummary}
                  onRunTests={() => handleExecuteTerminalCommand("bun run test")}
                  gitStatus={gitStatus}
                  onCommitChanges={async (msg) => {
                    await handleExecuteTerminalCommand(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
                  }}
                  onClose={() => setBottomOpen(false)}
                  onToggleMaximize={() => setIsBottomMaximized(!isBottomMaximized)}
                  isMaximized={isBottomMaximized}
                />
              </div>
            </div>
          )}
        </div>

        {/* Optional Right AI Assistant Panel */}
        {aiAssistantOpen && (
          <div className="w-80 shrink-0 h-full">
            <IDEAIAssistant
              projectId={projectId}
              projectName={projectName}
              selectedFile={activeArtifact}
              onApplyCodeSnippet={(code) => handleEditorChange(code)}
              onClose={() => setAiAssistantOpen(false)}
            />
          </div>
        )}

        {/* AI Code Explainer Drawer/Panel */}
        {explainerOpen && selectedPath && (
          <div className="w-96 shrink-0 h-full border-l border-white/10 z-20">
            <AICodeExplainerPanel
              explanation={explanationResult}
              mode={explainerMode}
              isLoading={isExplaining}
              errorMessage={explainerError}
              filePath={selectedPath}
              isSelectionActive={Boolean(explainerSelection)}
              onModeChange={handleExplainerModeSwitch}
              onReexplain={() =>
                handleTriggerExplainCode(
                  explainerSelection
                    ? {
                        filePath: selectedPath,
                        selectedText: explainerSelection.text,
                        selectionRange: explainerSelection.range,
                      }
                    : undefined
                )
              }
              onNavigateToLine={(start, end) => setHighlightLineRange({ startLineNumber: start, endLineNumber: end })}
              onClose={() => {
                setExplainerOpen(false);
                setHighlightLineRange(null);
              }}
            />
          </div>
        )}
      </div>

      {/* VS Code Style Status Bar */}
      <IDEStatusBar
        projectName={projectName}
        currentFilePath={selectedPath}
        language={selectedPath ? inferMonacoLanguage(selectedPath) : "Plain Text"}
        isDirty={isCurrentDirty}
        problemCount={problems.length}
        branch={gitStatus?.currentBranch || "main"}
        onOpenProblems={() => {
          setBottomOpen(true);
          setBottomTab("problems");
        }}
        onOpenGit={() => {
          setBottomOpen(true);
          setBottomTab("gitDiff");
        }}
      />

      {/* AI Continue Code Diff & Approval Modal */}
      {continuationProposal && (
        <AIContinueCodeDiffModal
          proposal={continuationProposal}
          isGenerating={isGeneratingContinuation}
          errorMessage={continuationError}
          onAccept={handleAcceptContinuation}
          onReject={handleRejectContinuation}
          onRegenerate={() => handleTriggerContinueCode()}
        />
      )}
    </div>
  );
};
