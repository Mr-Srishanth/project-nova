import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCw,
  FolderKanban,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { BuildArtifact, FilePlan } from "@/types/artifact";
import type {
  QualityAssessment,
  QualityFinding,
  TestPlan,
  TestResultState,
} from "@/types/quality";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { runStaticAnalysis } from "@/lib/quality/staticAnalysis";
import { runSecurityAnalysis } from "@/lib/quality/securityAnalysis";
import { generateFilePlanFromBlueprint } from "@/lib/build/filePlanEngine";
import { DEFAULT_EXECUTION_POLICY } from "@/lib/quality/executionPolicy";
import { aiClient } from "@/lib/ai/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FindingsList } from "@/components/quality/FindingsList";
import { TestingLab } from "@/components/quality/TestingLab";
import { generateId } from "@/lib/utils";

export const QualityEnginePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [assessment, setAssessment] = useState<QualityAssessment | null>(null);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [activeTab, setActiveTab] = useState<"findings" | "tests" | "history">("findings");

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  // Dialogs & Execution
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProposingAI, setIsProposingAI] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Projects
  useEffect(() => {
    projectStorage.list().then((list) => {
      setProjects(list);
      if (list.length > 0) {
        if (projectIdParam && list.some((p) => p.id === projectIdParam)) {
          setSelectedProjectId(projectIdParam);
        } else {
          setSelectedProjectId(list[0].id);
        }
      }
      setLoading(false);
    });
  }, [projectIdParam]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Load Project Artifacts, Assessment & Test Plans
  useEffect(() => {
    if (!selectedProjectId) {
      setArtifacts([]);
      setAssessment(null);
      setTestPlans([]);
      return;
    }

    Promise.all([
      artifactStorage.list(selectedProjectId),
      qualityStorage.getLatestAssessment(selectedProjectId),
      qualityStorage.listTestPlans(selectedProjectId),
    ]).then(([storedArtifacts, latestAssessment, storedPlans]) => {
      setArtifacts(storedArtifacts);
      setAssessment(latestAssessment);
      setTestPlans(storedPlans);
    });
  }, [selectedProjectId]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSearchParams({ project: id });
  };

  // Perform Real Deterministic Quality Assessment
  const handleRunAssessment = async () => {
    if (!selectedProject) return;
    setIsScanning(true);
    setErrorBanner(null);

    try {
      const assessmentId = generateId("qa_assess_");
      let filePlan: FilePlan | undefined = undefined;

      if (selectedProject.blueprint) {
        filePlan = generateFilePlanFromBlueprint(selectedProject, selectedProject.blueprint);
      }

      // 1. Static Analysis
      const staticFindings = runStaticAnalysis({
        projectId: selectedProject.id,
        assessmentId,
        artifacts,
        filePlan,
      });

      // 2. Security & Secret Analysis
      const securityFindings = runSecurityAnalysis({
        projectId: selectedProject.id,
        assessmentId,
        artifacts,
      });

      const allFindings: QualityFinding[] = [...staticFindings, ...securityFindings];

      // Calculate health grade & scores from real data
      const errors = allFindings.filter((f) => f.severity === "error").length;
      const warnings = allFindings.filter((f) => f.severity === "warning").length;
      const infos = allFindings.filter((f) => f.severity === "info").length;

      let grade: "A" | "B" | "C" | "D" | "F" = "A";
      if (errors > 3) grade = "F";
      else if (errors > 0) grade = "D";
      else if (warnings > 4) grade = "C";
      else if (warnings > 0) grade = "B";

      const newAssessment: QualityAssessment = {
        id: assessmentId,
        projectId: selectedProject.id,
        assessedAt: new Date().toISOString(),
        checksPerformed: [
          "deterministic_static_analysis",
          "file_plan_coverage",
          "hardcoded_secret_detection",
          "unsafe_eval_detection",
          "path_traversal_detection",
          "manifest_consistency",
        ],
        totalArtifactsChecked: artifacts.length,
        findings: allFindings,
        score: {
          healthGrade: grade,
          errorCount: errors,
          warningCount: warnings,
          infoCount: infos,
          resolvedCount: 0,
        },
      };

      await qualityStorage.saveAssessment(newAssessment);
      setAssessment(newAssessment);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Assessment execution failed.";
      setErrorBanner(`Assessment error: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleResolveFinding = async (findingId: string) => {
    if (!selectedProject) return;
    await qualityStorage.updateFindingStatus(selectedProject.id, findingId, "resolved");
    const updated = await qualityStorage.getLatestAssessment(selectedProject.id);
    setAssessment(updated);
  };

  const handleDismissFinding = async (findingId: string) => {
    if (!selectedProject) return;
    await qualityStorage.updateFindingStatus(selectedProject.id, findingId, "dismissed");
    const updated = await qualityStorage.getLatestAssessment(selectedProject.id);
    setAssessment(updated);
  };

  const handleUpdateTestCaseStatus = async (
    testCaseId: string,
    status: TestResultState,
    notes?: string
  ) => {
    if (!selectedProject) return;
    await qualityStorage.updateTestCaseStatus(selectedProject.id, testCaseId, status, notes);
    const updated = await qualityStorage.listTestPlans(selectedProject.id);
    setTestPlans(updated);
  };

  const handleProposeAITestPlan = async () => {
    if (!selectedProject) return;
    setIsProposingAI(true);
    setErrorBanner(null);

    try {
      const result = await aiClient.proposeTestPlan({
        projectName: selectedProject.name,
        blueprintContext: selectedProject.blueprint?.overview,
        existingFiles: artifacts.map((a) => a.path),
      });

      const newPlan: TestPlan = {
        id: generateId("tp_"),
        projectId: selectedProject.id,
        title: result.title || "AI Proposed Test Suite",
        description: result.description || "Synthesized test plan targeting critical project flows.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiProposed: true,
        testCases: result.testCases.map((tc) => ({
          ...tc,
          id: generateId("tc_"),
          testPlanId: "",
          projectId: selectedProject.id,
          status: "not_run", // Never marked as passed until executed
          isAiProposed: true,
        })),
      };

      await qualityStorage.saveTestPlan(newPlan);
      const updated = await qualityStorage.listTestPlans(selectedProject.id);
      setTestPlans(updated);
      setActiveTab("tests");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI test plan proposal failed.";
      setErrorBanner(
        `AI Gateway test plan proposal unavailable: ${msg}. You can still author or execute manual tests.`
      );
    } finally {
      setIsProposingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Quality Engine…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <ShieldCheck className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Quality Inspection
          </h2>
          <p className="text-sm text-foreground-muted">
            Create a project and generate code artifacts in Build Studio to run static analysis and quality assurance.
          </p>
          <Button onClick={() => navigate("/discover")} icon={<ArrowRight className="w-4 h-4" />}>
            Start Discovery
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary-soft text-primary rounded-tactile border border-primary/20">
              PHASE 6 ENGINE
            </span>
            <span className="text-xs text-foreground-muted">
              Quality Engine, Static Analysis & Testing Lab
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Quality Engine
          </h1>
          <p className="text-sm text-foreground-muted">
            Deterministic artifact static analysis, security secret audits, and verifiable test plan management.
          </p>
        </div>

        {/* Project Switcher */}
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedProjectId}
            onChange={(e) => handleSelectProject(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold bg-surface border-2 border-border rounded-tactile shadow-hard-sm text-foreground focus:outline-none focus:border-primary"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quality Scorecard Banner */}
      <Card className="bg-surface shadow-hard border-2 border-border p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-tactile border-2 border-border shadow-hard-sm flex items-center justify-center font-display font-black text-2xl ${
                assessment?.score.healthGrade === "A"
                  ? "bg-secondary-soft text-secondary"
                  : assessment?.score.healthGrade === "B"
                  ? "bg-accent-blue-soft text-accent-blue"
                  : assessment?.score.healthGrade === "C"
                  ? "bg-accent-yellow-soft text-accent-yellow"
                  : "bg-accent-red-soft text-accent-red"
              }`}
            >
              {assessment ? assessment.score.healthGrade : "—"}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">
                  Quality & Security Scorecard
                </h3>
                {assessment && (
                  <span className="text-xs font-mono text-foreground-muted">
                    Last assessed: {new Date(assessment.assessedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted">
                {artifacts.length} stored artifacts evaluated against deterministic static rules and credential checks.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric pill counter */}
            <div className="flex items-center gap-4 text-xs font-mono px-3 py-2 bg-background rounded-tactile border border-border">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-accent-red" />
                <span>Errors: <strong>{assessment?.score.errorCount ?? 0}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow" />
                <span>Warnings: <strong>{assessment?.score.warningCount ?? 0}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-accent-blue" />
                <span>Info: <strong>{assessment?.score.infoCount ?? 0}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                <span>Resolved: <strong>{assessment?.score.resolvedCount ?? 0}</strong></span>
              </div>
            </div>

            <Button
              onClick={handleRunAssessment}
              disabled={isScanning || artifacts.length === 0}
              icon={<RotateCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />}
            >
              {isScanning ? "Running Analysis…" : "Run Quality Scan"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Error banner if any */}
      {errorBanner && (
        <div className="p-3 bg-red-50 border-2 border-red-500 rounded-tactile flex items-start gap-2 shadow-hard-sm">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
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

      {/* Studio Navigation Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-border/20 pb-2">
        <button
          onClick={() => setActiveTab("findings")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "findings"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Quality Findings ({assessment?.findings.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "tests"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Testing Lab ({testPlans.reduce((acc, p) => acc + p.testCases.length, 0)} Tests)
        </button>
      </div>

      {/* Tab 1: Quality Findings & Filters */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border-2 border-border rounded-tactile">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-foreground">Category:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2 py-1 text-xs bg-background border border-border rounded text-foreground focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="static_analysis">Static Analysis</option>
                <option value="security">Security & Secrets</option>
                <option value="dependency">Dependencies</option>
                <option value="structure">Structure & Plan</option>
              </select>

              <span className="text-xs font-mono font-bold text-foreground ml-2">Severity:</span>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-2 py-1 text-xs bg-background border border-border rounded text-foreground focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="error">Errors Only</option>
                <option value="warning">Warnings Only</option>
                <option value="info">Info / Work Annotations</option>
              </select>
            </div>

            <div className="text-xs font-mono text-foreground-muted">
              Displaying {assessment?.findings.length ?? 0} total findings
            </div>
          </div>

          <FindingsList
            findings={assessment?.findings || []}
            filterCategory={filterCategory}
            filterSeverity={filterSeverity}
            onResolveFinding={handleResolveFinding}
            onDismissFinding={handleDismissFinding}
            onNavigateToFile={(path) => navigate(`/build?project=${selectedProject?.id}&file=${encodeURIComponent(path)}`)}
          />
        </div>
      )}

      {/* Tab 2: Testing Lab */}
      {activeTab === "tests" && (
        <TestingLab
          testPlans={testPlans}
          onUpdateTestCaseStatus={handleUpdateTestCaseStatus}
          onTriggerExecutionBlockedDialog={() => setShowPolicyModal(true)}
          onProposeAITestPlan={handleProposeAITestPlan}
          isProposingAI={isProposingAI}
        />
      )}

      {/* Execution Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-sm animate-fadeIn">
          <Card className="max-w-lg w-full bg-surface border-2 border-border shadow-hard p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center">
                <Lock className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Controlled Execution Sandbox Policy
                </h3>
                <span className="text-xs font-mono text-accent-red font-bold">
                  DIRECT EXECUTION CURRENTLY BLOCKED
                </span>
              </div>
            </div>

            <p className="text-xs text-foreground-muted leading-relaxed">
              {DEFAULT_EXECUTION_POLICY.reasonBlocked}
            </p>

            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-mono font-bold text-foreground">
                Mandatory Safety Requirements:
              </span>
              <ul className="text-xs space-y-1 text-foreground-muted list-disc list-inside">
                {DEFAULT_EXECUTION_POLICY.requiredConfirmations.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-foreground">
                Allowlisted Test Runners:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DEFAULT_EXECUTION_POLICY.allowlistedCommands.map((cmd, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[11px] font-mono bg-background border border-border rounded text-foreground"
                  >
                    {cmd}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setShowPolicyModal(false)}>Acknowledge & Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
