import React, { useState, useEffect } from "react";
import {
  Code2,
  Play,
  Download,
  MonitorPlay,
  Save,
  CheckCircle2,
  PanelBottom,
  PanelRight,
} from "lucide-react";
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

  // Bottom Panel State
  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>("terminal");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);

  // AI Assistant Panel
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  // Diagnostics & Tests
  const [problems, setProblems] = useState<DiagnosticProblem[]>([]);
  const [targetDiagnosticLine, setTargetDiagnosticLine] = useState<number | undefined>(undefined);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number; running: boolean } | null>(null);

  // Git Status
  const [gitStatus, setGitStatus] = useState<ServerGitStatus | null>(null);

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
    }

    if (res.error) {
      setTerminalLogs((prev) => [...prev, `Error: ${res.error}`]);
    } else {
      setTerminalLogs((prev) => [
        ...prev,
        `[Process exited with code ${res.exitCode !== null ? res.exitCode : 0}]`,
      ]);
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

  return (
    <div className="flex flex-col h-[780px] bg-[#1e1e1e] border-2 border-border rounded-tactile overflow-hidden shadow-hard text-[#cccccc]">
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
            <div className="h-60 shrink-0">
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
              />
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
    </div>
  );
};
