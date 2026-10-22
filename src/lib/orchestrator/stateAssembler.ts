import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type { ReleaseRecord } from "@/types/release";
import type { ProjectDocument } from "@/types/document";
import type { ProjectMemory } from "@/types/memory";
import type { ProjectStateSnapshot } from "@/types/orchestrator";

export interface StateAssemblyInput {
  project: Project;
  artifacts: BuildArtifact[];
  assessment?: QualityAssessment | null;
  testPlans?: TestPlan[];
  release?: ReleaseRecord | null;
  documents?: ProjectDocument[];
  brainMemories?: ProjectMemory[];
}

export function assembleProjectStateSnapshot(input: StateAssemblyInput): ProjectStateSnapshot {
  const {
    project,
    artifacts,
    assessment,
    testPlans = [],
    release,
    documents = [],
    brainMemories = [],
  } = input;

  const blueprint = project.blueprint;
  const milestones = project.milestones || [];
  const allTasks = milestones.flatMap((m) => m.tasks || []);
  const completedMilestones = allTasks.filter((t) => t.status === "done").length;

  const approvedArtifacts = artifacts.filter((a) => a.status === "approved").length;
  const unapprovedArtifacts = artifacts.filter((a) => a.status !== "approved").length;
  const plannedArtifacts = artifacts.filter((a) => a.status === "planned").length;

  const allTestCases = testPlans.flatMap((tp) => tp.testCases);
  const unrunTests = allTestCases.filter((tc) => tc.status === "not_run").length;
  const failedTests = allTestCases.filter((tc) => tc.status === "failed").length;
  const passedTests = allTestCases.filter((tc) => tc.status === "passed").length;

  const openErrors = assessment
    ? assessment.findings.filter((f) => f.severity === "error" && f.status === "open").length
    : 0;
  const openWarnings = assessment
    ? assessment.findings.filter((f) => f.severity === "warning" && f.status === "open").length
    : 0;

  const openDrift = documents.reduce(
    (acc, doc) => acc + (doc.driftFindings?.filter((d) => d.status === "open").length || 0),
    0
  );

  const risks = brainMemories.filter((m) => m.type === "risk").length;
  const decisions = brainMemories.filter((m) => m.type === "decision").length;
  const constraints = brainMemories.filter((m) => m.type === "constraint").length;

  return {
    projectId: project.id,
    projectName: project.name,
    capturedAt: new Date().toISOString(),
    blueprint: {
      defined: Boolean(blueprint && blueprint.title),
      title: blueprint?.title,
      endpointCount: blueprint?.api?.length || 0,
      entityCount: blueprint?.database?.entities?.length || 0,
    },
    roadmap: {
      totalMilestones: milestones.length,
      completedMilestones,
      currentStage: project.stageStates?.find((s) => s.status === "in_progress")?.id || "discovery",
      blockedTasksCount: project.roadmapMilestones?.flatMap((m) => m.tasks || []).filter((t) => t.status === "blocked").length || 0,
    },
    artifacts: {
      total: artifacts.length,
      approved: approvedArtifacts,
      unapproved: unapprovedArtifacts,
      planned: plannedArtifacts,
    },
    quality: {
      assessed: Boolean(assessment),
      healthGrade: assessment?.score?.healthGrade,
      openErrors,
      openWarnings,
      unrunTests,
      failedTests,
      passedTests,
    },
    release: {
      status: release?.status,
      readinessPassCount: release?.readinessSummary?.passed || 0,
      blockersCount: release?.readinessSummary?.failed || 0,
      unverifiedCount: release?.readinessSummary?.notVerified || 0,
      isReady: release?.status === "approved" || release?.status === "released",
    },
    docs: {
      totalDocs: documents.length,
      openDriftFindings: openDrift,
    },
    brain: {
      risksCount: risks,
      decisionsCount: decisions,
      constraintsCount: constraints,
    },
  };
}
