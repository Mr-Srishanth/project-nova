import React, { useState, useEffect } from "react";
import {
  TestTube2,
  Play,
  RotateCw,
  Shield,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  CheckSquare,
  History,
  Activity,
  Maximize2
} from "lucide-react";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { testStorage } from "@/lib/storage/testStorage";
import { reviewStorage } from "@/lib/storage/reviewStorage";
import { generateDefaultTestPlan } from "@/lib/testing/testPlanEngine";
import { testExecutionEngine } from "@/lib/testing/testExecutionEngine";
import type { BuildArtifact } from "@/types/artifact";
import type { TestPlan, TestCase, TestExecutionRecord } from "@/types/testing";
import type { RepairProposal } from "@/types/review";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

export const TestAutomationPage: React.FC = () => {
  const { activeProject: selectedProject, projects } = useActiveProject();
  const selectedProjectId = selectedProject?.id || "";
  
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [proposals, setProposals] = useState<RepairProposal[]>([]);
  
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null);
  const [executionRecords, setExecutionRecords] = useState<TestExecutionRecord[]>([]);
  
  const [activeTab, setActiveTab] = useState<"suites" | "cases" | "runs" | "regression" | "gate">("suites");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load project data and test plan for active project
  useEffect(() => {
    if (!selectedProjectId || !selectedProject) {
      setTestPlan(null);
      setExecutionRecords([]);
      return;
    }

    let isMounted = true;

    async function loadProjectData() {
      try {
        setLoadError(null);

        // Load artifacts & repair proposals safely
        let arts: BuildArtifact[] = [];
        try {
          arts = await artifactStorage.list(selectedProjectId);
        } catch (e) {
          console.warn("[TestAutomationPage] Error listing artifacts:", e);
        }
        if (!isMounted) return;
        setArtifacts(arts);

        let props: RepairProposal[] = [];
        try {
          const session = await reviewStorage.getLatestSession(selectedProjectId);
          props = session?.proposals || [];
        } catch (e) {
          console.warn("[TestAutomationPage] Error loading review session:", e);
        }
        if (!isMounted) return;
        setProposals(props);

        // Load or initialize test plans safely
        try {
          const plans = testStorage.listPlans(selectedProjectId);
          if (plans && plans.length > 0) {
            setTestPlan(plans[0]);
          } else {
            // Auto-generate clean draft plan
            const newPlan = generateDefaultTestPlan({
              projectId: selectedProjectId,
              projectName: selectedProject?.name || "Project",
              blueprint: selectedProject?.blueprint || null,
              proposals: props,
              artifacts: arts
            });
            testStorage.savePlan(newPlan);
            setTestPlan(newPlan);
          }
        } catch (e) {
          console.warn("[TestAutomationPage] Error loading/generating test plan:", e);
        }

        // Load historical runs safely
        try {
          const runs = testStorage.listRuns(selectedProjectId);
          if (isMounted) setExecutionRecords(runs || []);
        } catch (e) {
          console.warn("[TestAutomationPage] Error loading test runs:", e);
        }
      } catch (err: any) {
        console.error("[TestAutomationPage] Unexpected load error:", err);
        if (isMounted) setLoadError(err?.message || "Failed to load project verification data");
      }
    }

    loadProjectData();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, selectedProject]);

  const handleGeneratePlan = () => {
    if (!selectedProject) return;
    const newPlan = generateDefaultTestPlan({
      projectId: selectedProjectId,
      projectName: selectedProject.name,
      blueprint: selectedProject.blueprint || null,
      proposals,
      artifacts,
      existingPlan: testPlan
    });
    testStorage.savePlan(newPlan);
    setTestPlan(newPlan);
  };

  const handleRunAll = async () => {
    if (!testPlan || isRunning) return;
    setIsRunning(true);
    try {
      const updated = await testExecutionEngine.executePlan(testPlan, {
        projectId: selectedProjectId,
        planId: testPlan.id,
        artifacts,
        blueprint: selectedProject?.blueprint || null,
        executedBy: "engineer_console",
        onProgress: (current, total, tc) => {
          setExecutionProgress({ current, total, name: tc.name });
        }
      });
      setTestPlan(updated);
      setExecutionRecords(testStorage.listRuns(selectedProjectId));
    } finally {
      setIsRunning(false);
      setExecutionProgress(null);
    }
  };

  const handleRunSingle = async (testCase: TestCase) => {
    if (!testPlan || isRunning) return;
    setIsRunning(true);
    try {
      const updated = await testExecutionEngine.executePlan(testPlan, {
        projectId: selectedProjectId,
        planId: testPlan.id,
        testCaseIds: [testCase.id],
        artifacts,
        blueprint: selectedProject?.blueprint || null,
        executedBy: "engineer_console"
      });
      setTestPlan(updated);
      setExecutionRecords(testStorage.listRuns(selectedProjectId));
      const freshlyUpdated = updated.testCases.find(c => c.id === testCase.id);
      if (freshlyUpdated) setSelectedCase(freshlyUpdated);
    } finally {
      setIsRunning(false);
    }
  };

  // Filter test cases
  const filteredCases = (testPlan?.testCases || []).filter(tc => {
    if (filterCategory !== "all" && tc.category !== filterCategory) return false;
    if (filterStatus !== "all" && tc.status !== filterStatus) return false;
    return true;
  });

  // Compute safe test statistics ensuring no undefined access under any condition
  const planSummary = testPlan?.summary || {
    total: testPlan?.testCases?.length || 0,
    passed: (testPlan?.testCases || []).filter(c => c?.status === "passed").length,
    failed: (testPlan?.testCases || []).filter(c => c?.status === "failed").length,
    blocked: (testPlan?.testCases || []).filter(c => c?.status === "blocked").length,
    skipped: (testPlan?.testCases || []).filter(c => c?.status === "skipped").length,
    unknown: (testPlan?.testCases || []).filter(c => !c || !["passed", "failed", "blocked", "skipped"].includes(c.status)).length,
  };

  const gateResult = testExecutionEngine.evaluateVerificationGate(testPlan);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F4F1DF] p-6 rounded-xl border border-[#153A52]/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#153A52] text-white">
              <TestTube2 className="w-6 h-6 text-[#70C84B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#153A52]">Test Automation & Verification Engine</h1>
              <p className="text-sm text-[#153A52]/70">
                Phase 15 · Deterministic internal verification, regression gates, and release qualification.
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <CompactProjectIndicator />

          <button
            onClick={handleGeneratePlan}
            disabled={isRunning || !selectedProject}
            className="px-3 py-2 bg-white hover:bg-[#F4F1DF] text-[#153A52] border border-[#153A52]/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Re-generate test plan from Blueprint & Artifacts"
          >
            <RotateCw className="w-4 h-4 text-[#153A52]/70" />
            <span>Generate Plan</span>
          </button>

          <button
            onClick={handleRunAll}
            disabled={isRunning || !testPlan || testPlan.testCases.length === 0}
            className="px-4 py-2 bg-[#153A52] hover:bg-[#153A52]/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${isRunning ? "animate-spin text-amber-300" : "text-[#70C84B]"}`} />
            <span>{isRunning ? "Executing Gates..." : "Execute All Tests"}</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between text-rose-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <p className="font-medium text-sm">Failed to load project verification state</p>
              <p className="text-xs text-rose-700">{loadError}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* No Project Selected / No Projects in Storage Fallback */}
      {projects.length === 0 && (
        <div className="bg-white border-2 border-dashed border-border rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-foreground-muted">
            <TestTube2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No Projects Found</h3>
            <p className="text-xs text-foreground-muted max-w-md mx-auto">
              Create or discover a project first to generate automated test suites, verify API contracts, and run deterministic verification gates.
            </p>
          </div>
          <a
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono font-bold text-xs rounded-tactile border-2 border-border shadow-hard-sm"
          >
            Create New Project
          </a>
        </div>
      )}

      {/* Progress Notification Banner */}
      {executionProgress && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between text-amber-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-amber-600 animate-spin" />
            <div>
              <p className="font-medium text-sm">
                Running Verification Step ({executionProgress.current || 0}/{executionProgress.total || 0}): {executionProgress.name || "Test Case"}
              </p>
              <p className="text-xs text-amber-700">Strictly isolated local deterministic runner</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 rounded-full">
            {executionProgress.total ? Math.round(((executionProgress.current || 0) / executionProgress.total) * 100) : 0}%
          </span>
        </div>
      )}

      {/* Verification Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-sm">
          <span className="text-xs text-[#153A52]/60 uppercase tracking-wider font-semibold">Total Test Cases</span>
          <div className="text-2xl font-bold text-[#153A52] mt-1">{planSummary.total}</div>
          <span className="text-[11px] text-gray-500">In Active Plan</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">Passed</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{planSummary.passed}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Machine-Verified</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
          <span className="text-xs text-rose-700 uppercase tracking-wider font-semibold">Failed</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">{planSummary.failed}</div>
          <span className="text-[11px] text-rose-600 font-medium">Assertion Breaks</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Blocked</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">{planSummary.blocked}</div>
          <span className="text-[11px] text-amber-600 font-medium">Missing Artifacts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Unverified</span>
          <div className="text-2xl font-bold text-gray-700 mt-1">{planSummary.unknown}</div>
          <span className="text-[11px] text-gray-500">Pending Execution</span>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm ${gateResult.passed ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#153A52]/70">Gate Status</span>
          <div className={`text-xl font-bold mt-1 ${gateResult.passed ? 'text-emerald-700' : 'text-amber-800'}`}>
            {gateResult.passed ? "QUALIFIED" : "BLOCKED"}
          </div>
          <span className="text-[11px] text-[#153A52]/70">
            {gateResult.metrics.criticalPassingRate}% Critical Rate
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#153A52]/10 gap-2">
        <button
          onClick={() => setActiveTab("suites")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "suites"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Test Suites ({testPlan?.suites?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("cases")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "cases"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <TestTube2 className="w-4 h-4" />
          <span>Test Cases ({testPlan?.testCases?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("regression")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "regression"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Regression & Repair Gates ({proposals.length})</span>
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
          <span>Run History ({executionRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("gate")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "gate"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Release Gate Audit</span>
        </button>
      </div>

      {/* TAB CONTENT: TEST SUITES */}
      {activeTab === "suites" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(testPlan?.suites || []).map((suite) => {
            const suiteCases = (testPlan?.testCases || []).filter(c => suite.testCaseIds.includes(c.id));
            const passed = suiteCases.filter(c => c.status === "passed").length;
            const failed = suiteCases.filter(c => c.status === "failed").length;

            return (
              <div key={suite.id} className="bg-white rounded-xl border border-[#153A52]/10 p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-[#153A52]/5 text-[#153A52]">
                      {suite.category}
                    </span>
                    <h3 className="font-bold text-[#153A52] text-base mt-2">{suite.name}</h3>
                    <p className="text-xs text-[#153A52]/70 mt-1">{suite.description}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
                    {suite.testCaseIds.length} Cases
                  </span>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>Execution Pass Rate</span>
                    <span>{suiteCases.length > 0 ? Math.round((passed / suiteCases.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(passed / (suiteCases.length || 1)) * 100}%` }} />
                    <div className="bg-rose-500 h-full" style={{ width: `${(failed / (suiteCases.length || 1)) * 100}%` }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {passed} passed · {failed} failed · {suiteCases.length - passed - failed} unverified
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab("cases");
                      setFilterCategory(suite.category);
                    }}
                    className="text-xs text-[#153A52] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>View Cases</span>
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT: TEST CASES */}
      {activeTab === "cases" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#153A52]/10">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700"
                >
                  <option value="all">All Categories</option>
                  <option value="static_analysis">Static Analysis</option>
                  <option value="security">Security Hygiene</option>
                  <option value="dependency_dag">Dependency DAG</option>
                  <option value="drift_verification">Drift Verification</option>
                  <option value="artifact_syntax">Artifact Syntax</option>
                  <option value="regression">Regression</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                  <option value="configured">Configured</option>
                </select>
              </div>

              <span className="text-xs text-gray-500">Showing {filteredCases.length} tests</span>
            </div>

            {/* List */}
            <div className="space-y-2">
              {filteredCases.map((tc) => {
                let badgeClass = "bg-gray-100 text-gray-700";
                if (tc.status === "passed") badgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-300";
                if (tc.status === "failed") badgeClass = "bg-rose-100 text-rose-800 border border-rose-300";
                if (tc.status === "blocked") badgeClass = "bg-amber-100 text-amber-800 border border-amber-300";

                return (
                  <div
                    key={tc.id}
                    onClick={() => setSelectedCase(tc)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCase?.id === tc.id
                        ? "bg-[#F4F1DF]/40 border-[#153A52] ring-1 ring-[#153A52]"
                        : "bg-white border-[#153A52]/10 hover:border-[#153A52]/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badgeClass}`}>
                            {tc.status}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            {tc.category}
                          </span>
                          {tc.priority === "critical" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-[#153A52]">{tc.name}</h4>
                        <p className="text-xs text-gray-600 line-clamp-1">{tc.description}</p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunSingle(tc);
                        }}
                        disabled={isRunning}
                        className="px-2.5 py-1 text-xs bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-[#70C84B]" />
                        <span>Run</span>
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-4">
                      <span>Capability: {tc.capabilityId}</span>
                      {tc.durationMs !== undefined && <span>Duration: {tc.durationMs}ms</span>}
                      {tc.lastExecutedAt && <span>Executed: {new Date(tc.lastExecutedAt).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Pane */}
          <div className="bg-white rounded-xl border border-[#153A52]/10 p-5 shadow-sm space-y-4">
            {selectedCase ? (
              <>
                <div className="border-b pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#153A52]/60">
                    Test Case Details
                  </span>
                  <h3 className="text-base font-bold text-[#153A52] mt-1">{selectedCase.name}</h3>
                  <p className="text-xs text-gray-600 mt-1">{selectedCase.description}</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-700">Target Files:</span>
                    <ul className="list-disc pl-4 mt-1 text-gray-600 space-y-0.5">
                      {selectedCase.targetPaths.map((tp, idx) => (
                        <li key={idx} className="font-mono text-[11px]">{tp}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="font-semibold text-gray-700">Capability:</span>
                    <p className="font-mono text-[11px] text-gray-600 mt-0.5">{selectedCase.capabilityId}</p>
                  </div>

                  {selectedCase.failureMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                      <span className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Failure Cause
                      </span>
                      <p className="mt-1 text-[11px] font-mono">{selectedCase.failureMessage}</p>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold text-gray-700">Assertions ({selectedCase.assertions?.length || 0}):</span>
                    {selectedCase.assertions?.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {selectedCase.assertions.map((a) => (
                          <div key={a.id} className="p-2 bg-gray-50 border rounded text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-800">{a.description}</span>
                              <span className={`font-bold ${a.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {a.passed ? "PASS" : "FAIL"}
                              </span>
                            </div>
                            {a.actual !== undefined && (
                              <div className="text-[10px] text-gray-500">
                                Expected: <span className="font-mono">{String(a.expected)}</span> | Actual: <span className="font-mono">{String(a.actual)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-[11px] mt-1">No assertions recorded yet. Run test to verify.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Select a test case to view assertions, targets, and execution history.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REGRESSION & REPAIR GATES */}
      {activeTab === "regression" && (
        <div className="space-y-4">
          <div className="bg-[#F4F1DF]/30 p-4 rounded-xl border border-[#153A52]/10">
            <h3 className="text-sm font-bold text-[#153A52]">Phase 14 Repair Proposals Verification Gate</h3>
            <p className="text-xs text-[#153A52]/70 mt-1">
              Verifies that repaired source files satisfy regression checks, pass static AST metrics, and have not drifted since repair proposals were authored.
            </p>
          </div>

          {proposals.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border text-center text-gray-500 text-xs">
              No Repair Proposals generated in Phase 14 Code Review for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((prop) => {
                const regressionCase = (testPlan?.testCases || []).find(tc => tc.relatedProposalId === prop.id);
                return (
                  <div key={prop.id} className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#153A52]">{prop.targetFilePath}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          regressionCase?.status === 'passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {regressionCase?.status || 'unverified'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-mono">Target: {prop.targetFilePath}</p>
                      <p className="text-xs text-gray-500">{prop.rationale}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {regressionCase && (
                        <button
                          onClick={() => handleRunSingle(regressionCase)}
                          disabled={isRunning}
                          className="px-3 py-1.5 text-xs bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg flex items-center gap-1.5 font-medium disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 text-[#70C84B]" />
                          <span>Verify Proposal</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RUN HISTORY */}
      {activeTab === "runs" && (
        <div className="bg-white rounded-xl border border-[#153A52]/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-sm text-[#153A52]">Historical Verification Runs</h3>
            <button
              onClick={() => {
                testStorage.clearRuns(selectedProjectId);
                setExecutionRecords([]);
              }}
              className="text-xs text-rose-600 hover:underline"
            >
              Clear Records
            </button>
          </div>

          {executionRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No test executions recorded yet. Run a suite to generate audit logs.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {executionRecords.map((run) => (
                <div key={run.id} className="p-4 hover:bg-gray-50 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        run.status === 'passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {run.status}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">{run.capabilityId}</span>
                      <span className="text-[10px] text-gray-400">({run.executionType})</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(run.startedAt).toLocaleString()} · {run.durationMs}ms
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded border">
                    {run.outputSanitized}
                  </div>

                  {run.evidence && run.evidence.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {run.evidence.map((ev) => (
                        <span key={ev.id} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-medium">
                          {ev.title}: {ev.detail}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RELEASE GATE AUDIT */}
      {activeTab === "gate" && (
        <div className="bg-white rounded-xl border border-[#153A52]/10 p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-bold text-[#153A52]">Release Readiness Verification Gate</h3>
              <p className="text-xs text-gray-600 mt-1">
                Deterministic verification gate evaluated before Phase 7 Release Center deployments.
              </p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider ${
              gateResult.passed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {gateResult.passed ? "Release Gate Passed" : "Release Gate Blocked"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Gate Requirements</h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between border">
                  <span>Zero Failed Test Cases</span>
                  <span className={`font-bold ${gateResult.metrics.failed === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {gateResult.metrics.failed === 0 ? "PASSED" : `${gateResult.metrics.failed} FAILED`}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between border">
                  <span>100% Critical Verification Gates Passing</span>
                  <span className={`font-bold ${gateResult.metrics.criticalPassingRate === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {gateResult.metrics.criticalPassingRate}%
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between border">
                  <span>No Blocked Verification Capabilities</span>
                  <span className={`font-bold ${gateResult.metrics.blocked === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {gateResult.metrics.blocked === 0 ? "PASSED" : `${gateResult.metrics.blocked} BLOCKED`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Gate Blockers & Warnings</h4>
              {gateResult.blockers.length === 0 && gateResult.warnings.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All release verification prerequisites satisfied cleanly.</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {gateResult.blockers.map((b, i) => (
                    <div key={i} className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                  {gateResult.warnings.map((w, i) => (
                    <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
