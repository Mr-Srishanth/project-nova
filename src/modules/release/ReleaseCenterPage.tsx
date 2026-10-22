import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderKanban,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type {
  ReleaseRecord,
  ReadinessCheckResult,
  EnvVariableSpec,
  DeploymentPrerequisite,
} from "@/types/release";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { releaseStorage } from "@/lib/storage/releaseStorage";
import { evaluateReleaseReadiness } from "@/lib/release/readinessEngine";
import { getDefaultProjectEnvSpecs } from "@/lib/release/envConfigManager";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReadinessChecklist } from "@/components/release/ReadinessChecklist";
import { EnvConfigTab } from "@/components/release/EnvConfigTab";
import { ReleaseNotesTab } from "@/components/release/ReleaseNotesTab";
import { DeploymentGuideTab } from "@/components/release/DeploymentGuideTab";
import { generateId } from "@/lib/utils";

export const ReleaseCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [assessment, setAssessment] = useState<QualityAssessment | null>(null);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"readiness" | "env" | "notes" | "deploy">("readiness");
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

  // Load Project Data & Sync / Initialize Release Record
  useEffect(() => {
    if (!selectedProjectId) {
      setArtifacts([]);
      setAssessment(null);
      setTestPlans([]);
      setRelease(null);
      return;
    }

    Promise.all([
      artifactStorage.list(selectedProjectId),
      qualityStorage.getLatestAssessment(selectedProjectId),
      qualityStorage.listTestPlans(selectedProjectId),
      releaseStorage.getLatest(selectedProjectId),
    ]).then(([storedArtifacts, latestAssessment, storedTestPlans, existingRelease]) => {
      setArtifacts(storedArtifacts);
      setAssessment(latestAssessment);
      setTestPlans(storedTestPlans);

      if (existingRelease) {
        setRelease(existingRelease);
      } else if (selectedProject) {
        // Initialize default release record for this project
        const hasDb = Boolean(selectedProject.blueprint?.database?.sql);
        const hasApi = Boolean(selectedProject.blueprint?.api && selectedProject.blueprint.api.length > 0);
        const defaultEnv = getDefaultProjectEnvSpecs(hasDb, hasApi);

        const initialPrereq: DeploymentPrerequisite = {
          target: "Docker Container (Linux x86_64)",
          buildCommands: ["npm run build", "docker build -t app:latest ."],
          environmentVariables: defaultEnv.map((e) => e.name),
          databaseMigrationStep: hasDb ? "npm run db:migrate" : undefined,
          postDeploymentSmokeChecks: [
            "Verify GET /health returns 200 OK",
            "Verify database connection pool initializes without timeout",
            "Verify SSL certificates and HTTPS redirect headers",
          ],
          rollbackPlan: "Redeploy prior Docker image tag or trigger container roll-back",
        };

        const newRelease: ReleaseRecord = {
          id: generateId("rel_"),
          projectId: selectedProjectId,
          version: "v1.0.0",
          title: `${selectedProject.name} Initial Production Release`,
          summary: `Formal release bundle for ${selectedProject.name}.`,
          status: "draft",
          notableChanges: [
            "Architecture blueprint baseline established",
            "Core source artifacts synthesized and formatted",
            "Quality Engine static and security verification completed",
          ],
          knownLimitations: [
            "Manual user confirmation required for external third-party webhook keys",
          ],
          deploymentPrerequisites: initialPrereq,
          checklist: [
            { id: "c1", label: "Architecture blueprint reviewed", completed: true, required: true },
            { id: "c2", label: "Source files approved in Build Studio", completed: false, required: true },
            { id: "c3", label: "Static & security analysis passed with 0 errors", completed: false, required: true },
            { id: "c4", label: "Verification tests executed and recorded", completed: false, required: true },
            { id: "c5", label: "Production environment parameters documented", completed: true, required: true },
          ],
          envVariables: defaultEnv,
          readinessSummary: {
            passed: 0,
            failed: 0,
            warnings: 0,
            notVerified: 0,
            isReady: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        releaseStorage.save(newRelease).then((saved) => setRelease(saved));
      }
    });
  }, [selectedProjectId, selectedProject]);

  // Compute live readiness checks from real data
  const readinessChecks: ReadinessCheckResult[] = useMemo(() => {
    if (!selectedProject || !release) return [];
    return evaluateReleaseReadiness({
      project: selectedProject,
      artifacts,
      assessment,
      testPlans,
      envVariables: release.envVariables,
    });
  }, [selectedProject, artifacts, assessment, testPlans, release]);

  const passedCount = readinessChecks.filter((c) => c.state === "pass").length;
  const failedCount = readinessChecks.filter((c) => c.state === "fail").length;
  const warningCount = readinessChecks.filter((c) => c.state === "warning").length;
  const notVerifiedCount = readinessChecks.filter((c) => c.state === "not_verified").length;
  const isReadyForApproval = failedCount === 0 && notVerifiedCount === 0;

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSearchParams({ project: id });
  };

  const handleUpdateRelease = async (updatedFields: Partial<ReleaseRecord>) => {
    if (!release) return;
    const updated: ReleaseRecord = {
      ...release,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    };
    const saved = await releaseStorage.save(updated);
    setRelease(saved);
  };

  const handleApproveRelease = async () => {
    if (!release || !selectedProject) return;
    const updated = await releaseStorage.updateStatus(
      selectedProject.id,
      release.id,
      "approved",
      "Authorized QA Lead"
    );
    if (updated) setRelease({ ...updated });
  };

  const handleMarkReleased = async () => {
    if (!release || !selectedProject) return;
    const updated = await releaseStorage.updateStatus(selectedProject.id, release.id, "released");
    if (updated) setRelease({ ...updated });
  };

  const handleAddEnvVariable = async (v: EnvVariableSpec) => {
    if (!release) return;
    const updatedVars = [...release.envVariables, v];
    await handleUpdateRelease({ envVariables: updatedVars });
  };

  const handleUpdatePrerequisites = async (prereq: DeploymentPrerequisite) => {
    await handleUpdateRelease({ deploymentPrerequisites: prereq });
  };

  const handleNavigateToSource = (sourceRef: string) => {
    if (sourceRef.includes("Blueprint")) {
      navigate(`/blueprint?project=${selectedProjectId}`);
    } else if (sourceRef.includes("Build")) {
      navigate(`/build?project=${selectedProjectId}`);
    } else if (sourceRef.includes("Quality")) {
      navigate(`/quality?project=${selectedProjectId}`);
    } else if (sourceRef.includes("Environment")) {
      setActiveTab("env");
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Release Center…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <Rocket className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Release
          </h2>
          <p className="text-sm text-foreground-muted">
            Create and blueprint a project first to manage release readiness and environment configuration.
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
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary-soft text-primary rounded-tactile border border-primary/20">
              PHASE 7 ENGINE
            </span>
            <span className="text-xs text-foreground-muted">Deployment & Release Center</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Release Center
          </h1>
          <p className="text-sm text-foreground-muted">
            Audit release readiness, validate environment parameters, export release notes, and enforce approval gates.
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

      {/* Release Overview Scorecard */}
      <Card className="p-5 bg-surface border-2 border-border shadow-hard">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-tactile border-2 border-border shadow-hard-sm flex items-center justify-center font-display font-black text-xl ${
                isReadyForApproval
                  ? "bg-secondary-soft text-secondary"
                  : failedCount > 0
                  ? "bg-red-50 text-accent-red"
                  : "bg-accent-yellow-soft text-accent-yellow"
              }`}
            >
              {isReadyForApproval ? "READY" : failedCount > 0 ? "BLOCK" : "WARN"}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">
                  Release Gate: {release ? release.version : "Draft"}
                </h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                    release?.status === "approved"
                      ? "bg-secondary-soft text-secondary border-secondary/20"
                      : release?.status === "released"
                      ? "bg-primary-soft text-primary border-primary/20"
                      : "bg-surface-subtle text-foreground-muted border-border"
                  }`}
                >
                  {release ? release.status.toUpperCase() : "DRAFT"}
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                {readinessChecks.length} verifiable checks evaluated across blueprint, artifacts, Quality Engine, and environment.
              </p>
            </div>
          </div>

          {/* Counts */}
          <div className="flex items-center gap-4 text-xs font-mono px-3 py-2 bg-background rounded-tactile border border-border">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
              <span>Passed: <strong>{passedCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-accent-red" />
              <span>Blockers: <strong>{failedCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow" />
              <span>Warnings: <strong>{warningCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-accent-blue" />
              <span>Unverified: <strong>{notVerifiedCount}</strong></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-border/20 pb-2">
        <button
          onClick={() => setActiveTab("readiness")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "readiness"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Readiness Checks ({readinessChecks.length})
        </button>
        <button
          onClick={() => setActiveTab("env")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "env"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Environment Validation ({release?.envVariables.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "notes"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Release Notes & Sign-Off
        </button>
        <button
          onClick={() => setActiveTab("deploy")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "deploy"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Deployment Guide & Runbook
        </button>
      </div>

      {/* Tab 1: Readiness Checks */}
      {activeTab === "readiness" && (
        <ReadinessChecklist
          checks={readinessChecks}
          onNavigateToSource={handleNavigateToSource}
        />
      )}

      {/* Tab 2: Environment Configuration */}
      {activeTab === "env" && release && (
        <EnvConfigTab
          envVariables={release.envVariables}
          onAddVariable={handleAddEnvVariable}
        />
      )}

      {/* Tab 3: Release Notes & Sign-Off */}
      {activeTab === "notes" && release && (
        <ReleaseNotesTab
          release={release}
          readinessChecks={readinessChecks}
          onUpdateRelease={handleUpdateRelease}
          onApproveRelease={handleApproveRelease}
          onMarkReleased={handleMarkReleased}
          isReadyForApproval={isReadyForApproval}
        />
      )}

      {/* Tab 4: Deployment Guide & Runbook */}
      {activeTab === "deploy" && release && (
        <DeploymentGuideTab
          prerequisites={release.deploymentPrerequisites}
          onUpdatePrerequisites={handleUpdatePrerequisites}
        />
      )}
    </div>
  );
};
