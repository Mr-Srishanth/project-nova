import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  GitMerge,
  Play,
  Save,
  CheckCircle2,
  AlertTriangle,
  Layers,
  History,
  Sparkles
} from "lucide-react";
import { projectStorage } from "@/lib/storage/projectStorage";
import { workflowStorage } from "@/lib/storage/workflowStorage";
import { workflowGraphValidator } from "@/lib/workflow/workflowGraphValidator";
import { workflowExecutionEngine } from "@/lib/workflow/workflowExecutionEngine";
import {
  createPreReleasePipelineTemplate,
  createDeploymentReadinessTemplate,
  createIncidentInvestigationTemplate
} from "@/lib/workflow/workflowTemplates";
import { WORKFLOW_OPERATIONS } from "@/lib/workflow/workflowOperationRegistry";
import type { Project } from "@/types/project";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowExecutionRecord,
  WorkflowValidationReport,
  SupportedWorkflowOperation
} from "@/types/workflow";

export const VisualWorkflowBuilderPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [validationReport, setValidationReport] = useState<WorkflowValidationReport | null>(null);

  const [activeTab, setActiveTab] = useState<"builder" | "runs" | "templates">("builder");
  const [runs, setRuns] = useState<WorkflowExecutionRecord[]>([]);
  const [activeRun, setActiveRun] = useState<WorkflowExecutionRecord | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load project list
  useEffect(() => {
    async function loadProjects() {
      const projs = await projectStorage.list();
      setProjects(projs);
      const urlProj = searchParams.get("projectId");
      if (urlProj && projs.some(p => p.id === urlProj)) {
        setSelectedProjectId(urlProj);
      } else if (projs.length > 0) {
        setSelectedProjectId(projs[0].id);
      }
    }
    loadProjects();
  }, []);

  // Update selected project and populate initial workflow if empty
  useEffect(() => {
    if (!selectedProjectId) return;
    setSearchParams({ projectId: selectedProjectId });

    const list = workflowStorage.listWorkflows(selectedProjectId);
    if (list.length > 0) {
      setWorkflows(list);
      setActiveWorkflow(list[0]);
    } else {
      // Seed default Pre-Release Pipeline template
      const defaultWf = createPreReleasePipelineTemplate(selectedProjectId);
      workflowStorage.saveWorkflow(defaultWf);
      setWorkflows([defaultWf]);
      setActiveWorkflow(defaultWf);
    }

    setRuns(workflowStorage.listRuns(selectedProjectId));
  }, [selectedProjectId]);

  // Validate active workflow whenever nodes/edges change
  useEffect(() => {
    if (activeWorkflow) {
      const report = workflowGraphValidator.validate(activeWorkflow);
      setValidationReport(report);
    } else {
      setValidationReport(null);
    }
  }, [activeWorkflow]);

  const handleSaveWorkflow = () => {
    if (!activeWorkflow) return;
    const updated = {
      ...activeWorkflow,
      updatedAt: new Date().toISOString()
    };
    workflowStorage.saveWorkflow(updated);
    setNotice(`Saved workflow '${updated.name}'.`);
  };

  const handleExecuteWorkflow = async () => {
    if (!activeWorkflow || isExecuting) return;
    setIsExecuting(true);
    setNotice(null);
    try {
      const run = await workflowExecutionEngine.executeWorkflow(activeWorkflow);
      setRuns(workflowStorage.listRuns(selectedProjectId));
      setActiveRun(run);
      if (run.status === 'succeeded') {
        setNotice(`Workflow completed successfully in ${run.durationMs}ms.`);
      } else if (run.status === 'awaiting_approval') {
        setNotice(`Workflow paused at approval step '${run.activeNodeId}'.`);
      } else {
        setNotice(`Workflow run failed: ${run.errorMessage || 'Step failed'}`);
      }
      setActiveTab("runs");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApproveCheckpoint = async (nodeId: string) => {
    if (!activeWorkflow || !activeRun) return;
    setIsExecuting(true);
    try {
      const resumed = await workflowExecutionEngine.executeWorkflow(activeWorkflow, {
        resumeExecutionId: activeRun.id,
        approvedNodeId: nodeId
      });
      setRuns(workflowStorage.listRuns(selectedProjectId));
      setActiveRun(resumed);
      setNotice(`Approved and resumed step '${nodeId}'. Status: ${resumed.status}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLoadTemplate = (templateFactory: (projId: string) => WorkflowDefinition) => {
    const newWf = templateFactory(selectedProjectId);
    workflowStorage.saveWorkflow(newWf);
    const updated = workflowStorage.listWorkflows(selectedProjectId);
    setWorkflows(updated);
    setActiveWorkflow(newWf);
    setActiveTab("builder");
    setNotice(`Loaded template '${newWf.name}'.`);
  };

  const handleAddNode = (opId: SupportedWorkflowOperation) => {
    if (!activeWorkflow) return;
    const op = WORKFLOW_OPERATIONS[opId];
    if (!op) return;

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      category: op.category,
      operationId: opId,
      label: op.name,
      position: { x: 100 + activeWorkflow.nodes.length * 60, y: 150 },
      config: {}
    };

    const updated = {
      ...activeWorkflow,
      nodes: [...activeWorkflow.nodes, newNode],
      updatedAt: new Date().toISOString()
    };
    workflowStorage.saveWorkflow(updated);
    setActiveWorkflow(updated);
    setSelectedNode(newNode);
    setNotice(`Added node '${newNode.label}'. Connect edges in editor.`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F4F1DF] p-6 rounded-xl border border-[#153A52]/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#153A52] text-white">
              <GitMerge className="w-6 h-6 text-[#70C84B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#153A52]">Visual Workflow Builder</h1>
              <p className="text-sm text-[#153A52]/70">
                Phase 18 · Reusable automation pipelines, deterministic DAG validation, and approval checkpoints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 bg-white border border-[#153A52]/20 rounded-lg text-sm text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSaveWorkflow}
            disabled={!activeWorkflow}
            className="px-3 py-2 bg-white hover:bg-gray-50 border border-[#153A52]/20 rounded-lg text-sm font-semibold text-[#153A52] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#153A52]/70" />
            <span>Save</span>
          </button>

          <button
            onClick={handleExecuteWorkflow}
            disabled={isExecuting || !validationReport?.isValid}
            className="px-4 py-2 bg-[#153A52] hover:bg-[#153A52]/90 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 text-[#70C84B] ${isExecuting ? "animate-spin" : ""}`} />
            <span>{isExecuting ? "Executing..." : "Execute Pipeline"}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between shadow-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-indigo-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#153A52]/10 gap-2">
        <button
          onClick={() => setActiveTab("builder")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "builder"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Visual Editor</span>
        </button>

        <button
          onClick={() => setActiveTab("runs")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "runs"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Execution Runs ({runs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "templates"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Pipeline Templates</span>
        </button>
      </div>

      {/* TAB 1: VISUAL BUILDER */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Palette & Workflows List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
              <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Select Workflow</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    onClick={() => setActiveWorkflow(wf)}
                    className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${
                      activeWorkflow?.id === wf.id
                        ? "bg-[#F4F1DF] border-[#153A52] font-bold text-[#153A52]"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="truncate">{wf.name}</div>
                    <span className="text-[10px] text-gray-400 font-mono">{wf.nodes.length} nodes · v{wf.version}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operation Palette */}
            <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
              <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Node Palette</span>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Actions</span>
                  <div className="space-y-1 mt-1">
                    <button
                      onClick={() => handleAddNode('action_inspect_artifacts')}
                      className="w-full text-left p-1.5 bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 font-medium"
                    >
                      + Inspect Artifacts
                    </button>
                    <button
                      onClick={() => handleAddNode('action_run_static_analysis')}
                      className="w-full text-left p-1.5 bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 font-medium"
                    >
                      + Static & Security
                    </button>
                    <button
                      onClick={() => handleAddNode('action_run_test_suite')}
                      className="w-full text-left p-1.5 bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 font-medium"
                    >
                      + Execute Tests
                    </button>
                    <button
                      onClick={() => handleAddNode('action_audit_release_gate')}
                      className="w-full text-left p-1.5 bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 font-medium"
                    >
                      + Release Gate
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Checkpoints</span>
                  <div className="space-y-1 mt-1">
                    <button
                      onClick={() => handleAddNode('approval_human_gate')}
                      className="w-full text-left p-1.5 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 text-purple-800 font-medium"
                    >
                      + Human Signoff Gate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Canvas View */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-[#153A52]/10 p-5 shadow-sm min-h-[460px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#153A52]">{activeWorkflow?.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{activeWorkflow?.description}</p>
                  </div>

                  {validationReport && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      validationReport.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {validationReport.isValid ? "DAG Validated" : "Validation Blocked"}
                    </span>
                  )}
                </div>

                {/* Nodes Linear DAG Flow View */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Topological Pipeline Sequence</span>
                  <div className="space-y-2">
                    {activeWorkflow?.nodes.map((node, idx) => (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                          selectedNode?.id === node.id
                            ? "bg-[#F4F1DF] border-[#153A52] ring-1 ring-[#153A52]"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-[#153A52] text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-gray-800">{node.label}</span>
                            <span className="text-[10px] text-gray-400 block font-mono">[{node.operationId}]</span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          node.category === 'trigger' ? 'bg-blue-100 text-blue-800' :
                          node.category === 'approval' ? 'bg-purple-100 text-purple-800' :
                          node.category === 'terminal' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {node.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Validation Summary */}
              {validationReport && validationReport.diagnostics.length > 0 && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Validation Diagnostics:
                  </span>
                  {validationReport.diagnostics.map((d, i) => (
                    <p key={i} className="text-rose-700 text-[11px] font-mono">• {d.message}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Node Properties */}
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-4">
            <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Node Configuration</span>
            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-gray-700">Node Label</span>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) => {
                      const updatedNode = { ...selectedNode, label: e.target.value };
                      setSelectedNode(updatedNode);
                      if (activeWorkflow) {
                        const updatedWf = {
                          ...activeWorkflow,
                          nodes: activeWorkflow.nodes.map(n => n.id === updatedNode.id ? updatedNode : n)
                        };
                        setActiveWorkflow(updatedWf);
                      }
                    }}
                    className="w-full mt-1 p-2 border rounded text-xs text-gray-800"
                  />
                </div>

                <div>
                  <span className="font-bold text-gray-700">Category:</span>
                  <span className="font-mono text-gray-600 block mt-0.5">{selectedNode.category}</span>
                </div>

                <div>
                  <span className="font-bold text-gray-700">Operation:</span>
                  <span className="font-mono text-gray-600 block mt-0.5">{selectedNode.operationId}</span>
                </div>

                {selectedNode.category === 'approval' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
                    <span className="font-bold block">Approval Checkpoint</span>
                    <p className="text-[11px] mt-1">This node halts workflow execution until explicitly authorized by an engineer.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs">
                Select a node to inspect and configure parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RUNS */}
      {activeTab === "runs" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            <h3 className="font-bold text-sm text-[#153A52]">Execution Records</h3>
            {runs.length === 0 ? (
              <div className="p-6 bg-white rounded-xl border text-center text-gray-400 text-xs">No runs recorded.</div>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setActiveRun(r)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    activeRun?.id === r.id
                      ? "bg-[#F4F1DF]/40 border-[#153A52] ring-1 ring-[#153A52]"
                      : "bg-white border-[#153A52]/10 hover:border-[#153A52]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      r.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' :
                      r.status === 'awaiting_approval' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {r.status}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{new Date(r.startedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-mono mt-2">Trigger: {r.triggerSource}</p>
                  {r.durationMs !== undefined && <span className="text-[10px] text-gray-400">Duration: {r.durationMs}ms</span>}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#153A52]/10 shadow-sm space-y-4">
            {activeRun ? (
              <>
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#153A52]">Execution Detail · {activeRun.id}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Status: {activeRun.status.toUpperCase()}</p>
                  </div>

                  {activeRun.status === 'awaiting_approval' && activeRun.activeNodeId && (
                    <button
                      onClick={() => handleApproveCheckpoint(activeRun.activeNodeId!)}
                      disabled={isExecuting}
                      className="px-3.5 py-1.5 bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#70C84B]" />
                      <span>Approve & Resume Step</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">Node Execution Steps</h4>
                  <div className="space-y-2">
                    {Object.values(activeRun.nodeExecutions).map((n) => (
                      <div key={n.nodeId} className="p-3 bg-gray-50 rounded-lg border text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-800">{n.nodeId}</span>
                          <span className="text-[10px] text-gray-400 block font-mono">{n.operationId}</span>
                          {n.errorMessage && <p className="text-rose-600 mt-1 font-mono text-[11px]">{n.errorMessage}</p>}
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            n.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' :
                            n.status === 'awaiting_approval' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {n.status}
                          </span>
                          {n.durationMs !== undefined && <span className="text-[10px] text-gray-400 block mt-0.5">{n.durationMs}ms</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs">Select an execution run to inspect node status.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATES */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
            <h3 className="font-bold text-base text-[#153A52]">Pre-Release Verification</h3>
            <p className="text-xs text-gray-600">
              Inspects artifacts, runs static security analysis, executes tests, and verifies release readiness.
            </p>
            <button
              onClick={() => handleLoadTemplate(createPreReleasePipelineTemplate)}
              className="w-full mt-2 py-2 bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg text-xs font-bold"
            >
              Load Pipeline Template
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
            <h3 className="font-bold text-base text-[#153A52]">Deployment Readiness</h3>
            <p className="text-xs text-gray-600">
              Validates architecture blueprint, evaluates deployment preflight, and halts for human signoff.
            </p>
            <button
              onClick={() => handleLoadTemplate(createDeploymentReadinessTemplate)}
              className="w-full mt-2 py-2 bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg text-xs font-bold"
            >
              Load Pipeline Template
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
            <h3 className="font-bold text-base text-[#153A52]">Incident Investigation</h3>
            <p className="text-xs text-gray-600">
              Polls public health targets and queries active Project Brain architectural decisions.
            </p>
            <button
              onClick={() => handleLoadTemplate(createIncidentInvestigationTemplate)}
              className="w-full mt-2 py-2 bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg text-xs font-bold"
            >
              Load Pipeline Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
