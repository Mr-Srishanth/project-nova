import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  FolderKanban,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  FileCode2,
  Play,
  AlertTriangle,
  Search,
  Check,
  Kanban,
  Hammer,
  ShieldCheck,
  Rocket,
} from "lucide-react";
import type { Project } from "@/types/project";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { deploymentStorage } from "@/lib/storage/deploymentStorage";
import { calculateStageStatuses, LIFECYCLE_STAGES } from "@/lib/roadmap/stageEngine";
import { assembleProjectStateSnapshot } from "@/lib/orchestrator/stateAssembler";
import { evaluateNextBestActions } from "@/lib/orchestrator/recommendationEngine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    activeProjectId,
    loading: contextLoading,
    error: contextError,
    setActiveProjectId,
  } = useActiveProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [recommendedAction, setRecommendedAction] = useState<any | null>(null);
  const [projectStats, setProjectStats] = useState<{
    artifactsCount: number;
    openIssues: number;
    deploymentsCount: number;
    currentStageName: string;
    stageProgress: number;
  }>({
    artifactsCount: 0,
    openIssues: 0,
    deploymentsCount: 0,
    currentStageName: "Discovery",
    stageProgress: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Load project-specific metrics and recommended actions whenever the active project changes
  useEffect(() => {
    if (!activeProject) {
      setRecommendedAction(null);
      setProjectStats({
        artifactsCount: 0,
        openIssues: 0,
        deploymentsCount: 0,
        currentStageName: "Discovery",
        stageProgress: 0,
      });
      return;
    }

    let isMounted = true;
    setStatsLoading(true);

    async function loadStatsForActive(project: Project) {
      try {
        const artifacts = await artifactStorage.list(project.id);
        if (!isMounted) return;

        const assessment = await qualityStorage.getLatestAssessment(project.id);
        if (!isMounted) return;

        const deployments = deploymentStorage.listRecords(project.id);
        if (!isMounted) return;

        // Calculate authoritative lifecycle stage
        const stageStatusMap = calculateStageStatuses(project);
        let activeStageName = "Discovery";
        let activeStagePercent = 0;

        for (const def of LIFECYCLE_STAGES) {
          const st = stageStatusMap[def.id];
          if (st && st.status !== "completed") {
            activeStageName = def.name.replace(/^\d+\.\s*/, "");
            activeStagePercent = st.percent;
            break;
          } else if (st && st.status === "completed") {
            activeStageName = def.name.replace(/^\d+\.\s*/, "");
            activeStagePercent = 100;
          }
        }

        // Generate next best action from orchestrator
        const snapshot = assembleProjectStateSnapshot({
          project,
          artifacts,
          assessment,
        });
        const actions = evaluateNextBestActions(snapshot);
        if (actions && actions.length > 0 && isMounted) {
          setRecommendedAction(actions[0]);
        } else if (isMounted) {
          setRecommendedAction(null);
        }

        const openCount = assessment?.findings
          ? assessment.findings.filter((f: { status: string }) => f.status === "open").length
          : 0;

        if (isMounted) {
          setProjectStats({
            artifactsCount: artifacts.length,
            openIssues: openCount,
            deploymentsCount: deployments.length,
            currentStageName: activeStageName,
            stageProgress: activeStagePercent,
          });
        }
      } catch (e) {
        console.warn("Could not load stats for active project", e);
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    }

    loadStatsForActive(activeProject);

    return () => {
      isMounted = false;
    };
  }, [activeProject]);

  // Filtered projects for search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.technologies.some((t) => t.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  const totalCount = projects.length;
  const activeCount = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Welcome Banner */}
      <div className="bg-surface border-2 border-border rounded-tactile p-6 md:p-8 shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-tactile-sm bg-accent-yellow-soft border border-border text-[11px] font-mono font-semibold text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-foreground" />
            <span>AI PROJECT OS // GLOBAL CONTROL PLANE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            Welcome to ProjectNova AI
          </h1>
          <p className="text-sm md:text-base font-sans text-foreground-muted leading-relaxed">
            Formulate natural-language ideas into full-stack software, manage blueprints, inspect live previews, run automated tests with AI repairs, and deploy to production.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Button
            size="lg"
            onClick={() => navigate("/discover")}
            icon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate("/projects")}
            icon={<FolderKanban className="w-4 h-4" />}
          >
            All Projects
          </Button>
        </div>
      </div>

      {contextError && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-tactile text-rose-800 text-xs flex items-center justify-between shadow-hard-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{contextError}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-mono font-bold underline hover:text-rose-950"
          >
            Reload
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. PROMINENT ACTIVE PROJECT SELECTOR & COMMAND CENTER */}
      {/* ============================================================== */}
      <div className="bg-surface border-2 border-border rounded-tactile shadow-hard p-5 sm:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-tactile border border-emerald-300">
                Global Active Project
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground mt-1.5">
              {activeProject ? activeProject.name : "No Project Selected"}
            </h2>
            <p className="text-xs text-foreground-muted line-clamp-1 max-w-2xl mt-0.5">
              {activeProject?.description || activeProject?.objective || "Select a project below to activate across all studios and tools."}
            </p>
          </div>

          {/* Quick Actions for Active Project */}
          {activeProject && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="primary"
                onClick={() => navigate(`/ui-studio?project=${activeProject.id}`)}
                icon={<Play className="w-4 h-4 fill-current" />}
              >
                UI Studio
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(`/projects/${activeProject.id}`)}
                icon={<FolderKanban className="w-4 h-4" />}
              >
                Workspace
              </Button>
            </div>
          )}
        </div>

        {/* Active Project Details & Quick Metrics */}
        {activeProject ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-stone-50 border border-border/40 rounded-tactile">
                <span className="text-[10px] font-mono text-foreground-muted uppercase block">Lifecycle Stage</span>
                <div className="text-sm font-display font-bold text-foreground mt-0.5 flex items-center justify-between">
                  <span>{projectStats.currentStageName}</span>
                  <span className="text-xs text-emerald-600 font-mono">{projectStats.stageProgress}%</span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-border/40 rounded-tactile">
                <span className="text-[10px] font-mono text-foreground-muted uppercase block">Source Artifacts</span>
                <div className="text-sm font-display font-bold text-foreground mt-0.5">
                  {statsLoading ? "…" : `${projectStats.artifactsCount} files`}
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-border/40 rounded-tactile">
                <span className="text-[10px] font-mono text-foreground-muted uppercase block">Test & Quality</span>
                <div className="text-sm font-display font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                  {projectStats.openIssues === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">All Passing</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-amber-700">{projectStats.openIssues} Issues</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-border/40 rounded-tactile">
                <span className="text-[10px] font-mono text-foreground-muted uppercase block">Deployments</span>
                <div className="text-sm font-display font-bold text-foreground mt-0.5">
                  {projectStats.deploymentsCount > 0 ? `${projectStats.deploymentsCount} releases` : "Ready"}
                </div>
              </div>
            </div>

            {/* Studio Navigation Shortcuts */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20">
              <span className="text-xs font-mono font-bold text-foreground-muted mr-1">Switch Studio:</span>
              <Link
                to={`/blueprint?project=${activeProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-tactile text-xs font-display font-bold text-foreground hover:bg-muted transition-colors shadow-hard-xs"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Blueprint</span>
              </Link>
              <Link
                to={`/flow?project=${activeProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-tactile text-xs font-display font-bold text-foreground hover:bg-muted transition-colors shadow-hard-xs"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Project Flow</span>
              </Link>
              <Link
                to={`/build?project=${activeProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-tactile text-xs font-display font-bold text-foreground hover:bg-muted transition-colors shadow-hard-xs"
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Build Studio</span>
              </Link>
              <Link
                to={`/testing?project=${activeProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-tactile text-xs font-display font-bold text-foreground hover:bg-muted transition-colors shadow-hard-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Test & Fix</span>
              </Link>
              <Link
                to={`/deployments?project=${activeProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-tactile text-xs font-display font-bold text-foreground hover:bg-muted transition-colors shadow-hard-xs"
              >
                <Rocket className="w-3.5 h-3.5 text-[#70C84B]" />
                <span>Deploy & Monitor</span>
              </Link>
            </div>

            {/* AI Recommended Next Action */}
            {recommendedAction && (
              <div className="p-3.5 bg-accent-yellow-soft/50 border border-border rounded-tactile flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-display font-bold text-foreground">
                      AI Recommended Next Action: {recommendedAction.title}
                    </div>
                    <p className="text-[11px] font-sans text-foreground-muted leading-tight mt-0.5">
                      {recommendedAction.description}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`${recommendedAction.targetRoute}?project=${activeProject.id}`)}
                  className="shrink-0 text-xs"
                >
                  Execute Action
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-xs font-sans text-foreground-muted">
              You haven't activated a project yet. Select an existing project from the registry below or create a new one.
            </p>
            <Button onClick={() => navigate("/discover")} icon={<Plus className="w-4 h-4" />}>
              Create New Project
            </Button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. SEARCHABLE PROJECT SELECTOR & REGISTRY */}
      {/* ============================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Project Registry & Switcher</h2>
            <p className="text-xs font-sans text-foreground-muted">
              Click any project to set it as the global active project across ProjectNova
            </p>
          </div>

          {/* Search box when multiple projects exist */}
          {projects.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface border-2 border-border rounded-tactile text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-foreground shadow-hard-xs"
              />
            </div>
          )}
        </div>

        {contextLoading ? (
          <div className="p-12 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
            <p className="text-sm font-mono text-foreground-muted">Loading project registry…</p>
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12 bg-surface shadow-hard">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
                <Layers className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground">No Projects in Workspace</h3>
              <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
                Your Project OS is ready. Formulate a natural language concept through Discovery or create a blank architecture project.
              </p>
              <div>
                <Button
                  onClick={() => navigate("/discover")}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Create Your First Project
                </Button>
              </div>
            </div>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-border rounded-tactile bg-surface space-y-3">
            <p className="text-xs text-foreground-muted">No projects found matching "{searchQuery}".</p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  onClick={() => setActiveProjectId(proj.id, true)}
                  className={`p-4 rounded-tactile border-2 cursor-pointer transition-all space-y-3 ${
                    isActive
                      ? "bg-accent-yellow-soft/30 border-foreground ring-2 ring-foreground shadow-hard"
                      : "bg-surface border-border hover:border-foreground/60 shadow-hard-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                        <h3 className="font-display font-bold text-base text-foreground truncate max-w-[180px]">
                          {proj.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-foreground-muted block">
                        Updated {formatDate(proj.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded-tactile-sm border border-emerald-300">
                          <Check className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-foreground-muted hover:text-foreground">
                          Click to Activate
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-sans text-foreground-muted line-clamp-2 leading-relaxed">
                    {proj.description || proj.objective || "No detailed description provided."}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/10 text-xs font-mono">
                    <span className="text-[10px] uppercase font-bold text-foreground-muted">
                      {proj.category || "General"}
                    </span>
                    <div className="flex items-center gap-1 text-foreground">
                      <FileCode2 className="w-3 h-3 text-accent-blue-strong" />
                      <span className="text-[11px]">{proj.blueprint ? "Blueprint Ready" : "No Blueprint"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 bg-surface">
          <div className="w-12 h-12 rounded-tactile bg-accent-blue/30 border-2 border-border flex items-center justify-center font-display font-bold text-lg text-foreground shadow-hard-sm">
            <FolderKanban className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <span className="text-xs font-mono font-semibold text-foreground-muted uppercase tracking-wider block">
              Total Projects
            </span>
            <span className="text-2xl font-display font-bold text-foreground">
              {contextLoading ? "…" : totalCount}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-surface">
          <div className="w-12 h-12 rounded-tactile bg-primary/40 border-2 border-border flex items-center justify-center font-display font-bold text-lg text-foreground shadow-hard-sm">
            <Clock className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <span className="text-xs font-mono font-semibold text-foreground-muted uppercase tracking-wider block">
              Active Builds
            </span>
            <span className="text-2xl font-display font-bold text-foreground">
              {contextLoading ? "…" : activeCount}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-surface">
          <div className="w-12 h-12 rounded-tactile bg-accent-yellow/40 border-2 border-border flex items-center justify-center font-display font-bold text-lg text-foreground shadow-hard-sm">
            <CheckCircle2 className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <span className="text-xs font-mono font-semibold text-foreground-muted uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-display font-bold text-foreground">
              {contextLoading ? "…" : completedCount}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};
