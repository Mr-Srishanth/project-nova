import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileCode2,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Settings,
  Save,
  Clock,
  Brain,
  Bot,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { TaskItem } from "@/types/task";
import type { ProjectMemory } from "@/types/memory";
import { projectStorage } from "@/lib/storage/projectStorage";
import { brainStorage } from "@/lib/storage/brainStorage";
import { generateDefaultBlueprint } from "@/lib/blueprintDefaults";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { BlueprintView } from "@/components/blueprint/BlueprintView";
import { ProjectBrainPanel } from "@/components/brain/ProjectBrainPanel";
import { ProjectAIAssistant } from "@/components/assistant/ProjectAIAssistant";
import { formatDate } from "@/lib/utils";

type ActiveTab = "overview" | "blueprint" | "tasks" | "brain" | "assistant";

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>("overview");

  // Editing state for metadata
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<Project["status"]>("active");
  const [saving, setSaving] = useState(false);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    const p = await projectStorage.getById(id);
    if (!p) {
      setLoading(false);
      return;
    }
    const mems = await brainStorage.list(id);
    setProject(p);
    setMemories(mems);
    setEditName(p.name);
    setEditObjective(p.objective);
    setEditDescription(p.description);
    setEditStatus(p.status);
    setLoading(false);
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleSaveMetadata = async () => {
    if (!project) return;
    setSaving(true);
    const updated = await projectStorage.update(project.id, {
      name: editName,
      objective: editObjective,
      description: editDescription,
      status: editStatus,
    });
    setProject(updated);
    setIsEditing(false);
    setSaving(false);
  };

  const handleInitBlueprint = async () => {
    if (!project) return;
    const bp = generateDefaultBlueprint(project.id, project.name, project.technologies);
    const updated = await projectStorage.update(project.id, { blueprint: bp });
    setProject(updated);
    setTab("blueprint");
  };

  const handleToggleTask = async (milestoneId: string, taskId: string) => {
    if (!project) return;

    const updatedMilestones: Project["milestones"] = project.milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        tasks: m.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextStatus: TaskItem["status"] = t.status === "done" ? "todo" : "done";
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === "done" ? new Date().toISOString() : undefined,
          };
        }),
      };
    });

    const updated = await projectStorage.update(project.id, { milestones: updatedMilestones });
    setProject(updated);
  };

  const handleAddDefaultMilestone = async () => {
    if (!project) return;

    const newMilestoneId = `ms_${Date.now()}`;
    const newMilestone = {
      id: newMilestoneId,
      projectId: project.id,
      order: project.milestones.length + 1,
      phase: `Milestone 0${project.milestones.length + 1}: Implementation & Core Logic`,
      goal: "Implement foundational architecture nodes and core data models.",
      estimatedDuration: "1-2 weeks",
      dependencies: ["Architecture Blueprint Approval"],
      skillsOrTech: project.technologies,
      tasks: [
        {
          id: `task_${Date.now()}_1`,
          milestoneId: newMilestoneId,
          title: "Scaffold application layout and theme provider tokens",
          status: "done" as const,
        },
        {
          id: `task_${Date.now()}_2`,
          milestoneId: newMilestoneId,
          title: "Establish typed domain models and persistence adapters",
          status: "done" as const,
        },
        {
          id: `task_${Date.now()}_3`,
          milestoneId: newMilestoneId,
          title: "Construct interactive SVG architecture visualizer",
          status: "in_progress" as const,
        },
        {
          id: `task_${Date.now()}_4`,
          milestoneId: newMilestoneId,
          title: "Implement API mock server and schema validation test suite",
          status: "todo" as const,
        },
      ],
    };

    const updatedMilestones = [...project.milestones, newMilestone];
    const updated = await projectStorage.update(project.id, { milestones: updatedMilestones });
    setProject(updated);
  };

  const handleQuickAddTask = async (milestoneId: string) => {
    if (!project || !newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: `task_${Date.now()}`,
      milestoneId,
      title: newTaskTitle.trim(),
      status: "todo",
    };

    const updatedMilestones = project.milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        tasks: [...m.tasks, newTask],
      };
    });

    const updated = await projectStorage.update(project.id, { milestones: updatedMilestones });
    setProject(updated);
    setNewTaskTitle("");
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const confirm = window.confirm(
      `Delete "${project.name}" permanently from your workspace? This cannot be undone.`
    );
    if (!confirm) return;

    await projectStorage.delete(project.id);
    navigate("/projects");
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading project workspace…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-xl font-display font-bold text-foreground">Project Not Found</h2>
          <p className="text-xs text-foreground-muted">
            The requested project ID does not exist in local storage.
          </p>
          <Button onClick={() => navigate("/projects")}>Back to Projects</Button>
        </div>
      </Card>
    );
  }

  // Calculate task progress
  const allTasks = project.milestones.flatMap((m) => m.tasks);
  const completedTasks = allTasks.filter((t) => t.status === "done");
  const progressPercent = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/projects")}
            className="p-1.5 border-2 border-border rounded-tactile-sm bg-surface hover:bg-[#FAF7ED] shadow-hard-sm"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-display font-bold text-foreground">
                {project.name}
              </h1>
              <Badge variant={project.status === "completed" ? "primary" : "yellow"}>
                {project.status.toUpperCase()}
              </Badge>
            </div>
            <span className="text-xs font-mono text-foreground-muted">
              {project.category} // Updated {formatDate(project.updatedAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            icon={<Settings className="w-3.5 h-3.5" />}
          >
            {isEditing ? "Close Editor" : "Edit Details"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={handleDeleteProject}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Editing Drawer / Box */}
      {isEditing && (
        <Card className="bg-[#FAF7ED] border-2 border-border shadow-hard space-y-4">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <h3 className="font-display font-bold text-sm text-foreground">Edit Project Metadata</h3>
            <span className="text-xs font-mono text-foreground-muted">Updates persist in local storage</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Project Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as Project["status"])}
                className="w-full bg-surface border-2 border-border rounded-tactile px-3 py-2 text-sm text-foreground"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <Textarea
            label="Objective"
            value={editObjective}
            onChange={(e) => setEditObjective(e.target.value)}
            rows={2}
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMetadata}
              disabled={saving}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </Card>
      )}

      {/* Progress & Quick Stats Card */}
      <Card className="bg-surface shadow-hard">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="space-y-1">
            <span className="text-xs font-mono font-semibold uppercase text-foreground-muted">Objective</span>
            <p className="text-xs font-sans text-foreground leading-relaxed">{project.objective}</p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-r border-border/20 md:px-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-foreground-muted">Milestone Tasks</span>
              <span className="font-bold text-foreground">
                {completedTasks.length} / {allTasks.length} Done ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-[#FAF7ED] h-3 rounded-full border border-border overflow-hidden p-0.5">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-start md:justify-end gap-2 flex-wrap">
            {project.technologies.map((t, i) => (
              <Badge key={i} variant="blue">{t}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-border pb-px">
        <button
          onClick={() => setTab("overview")}
          className={`px-4 py-2 font-display font-semibold text-xs rounded-t-tactile border-2 border-b-0 transition-all ${
            tab === "overview"
              ? "bg-surface border-border text-foreground shadow-[2px_-2px_0_var(--border)]"
              : "bg-transparent border-transparent text-foreground-muted hover:text-foreground"
          }`}
        >
          Workspace Overview
        </button>
        <button
          onClick={() => setTab("blueprint")}
          className={`flex items-center gap-1.5 px-4 py-2 font-display font-semibold text-xs rounded-t-tactile border-2 border-b-0 transition-all ${
            tab === "blueprint"
              ? "bg-surface border-border text-foreground shadow-[2px_-2px_0_var(--border)]"
              : "bg-transparent border-transparent text-foreground-muted hover:text-foreground"
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Blueprint Spec</span>
          {project.blueprint && <span className="w-2 h-2 rounded-full bg-primary" />}
        </button>
        <button
          onClick={() => setTab("tasks")}
          className={`flex items-center gap-1.5 px-4 py-2 font-display font-semibold text-xs rounded-t-tactile border-2 border-b-0 transition-all ${
            tab === "tasks"
              ? "bg-surface border-border text-foreground shadow-[2px_-2px_0_var(--border)]"
              : "bg-transparent border-transparent text-foreground-muted hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Milestones & Tasks ({allTasks.length})</span>
        </button>
        <button
          onClick={() => setTab("brain")}
          className={`flex items-center gap-1.5 px-4 py-2 font-display font-semibold text-xs rounded-t-tactile border-2 border-b-0 transition-all ${
            tab === "brain"
              ? "bg-surface border-border text-foreground shadow-[2px_-2px_0_var(--border)]"
              : "bg-transparent border-transparent text-foreground-muted hover:text-foreground"
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Project Brain</span>
          <span className="text-[10px] font-mono px-1.5 rounded-full bg-accent-blue/20 text-foreground border border-border">
            {memories.length}
          </span>
        </button>
        <button
          onClick={() => setTab("assistant")}
          className={`flex items-center gap-1.5 px-4 py-2 font-display font-semibold text-xs rounded-t-tactile border-2 border-b-0 transition-all ${
            tab === "assistant"
              ? "bg-surface border-border text-foreground shadow-[2px_-2px_0_var(--border)]"
              : "bg-transparent border-transparent text-foreground-muted hover:text-foreground"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Project AI Assistant</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-surface shadow-hard space-y-3">
              <h3 className="font-display font-bold text-base text-foreground">
                Description & Scope
              </h3>
              <p className="text-xs font-sans text-foreground leading-relaxed">
                {project.description || "No full problem description registered yet."}
              </p>
              {project.constraints && (
                <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile mt-2">
                  <span className="text-[11px] font-mono font-semibold uppercase text-foreground-muted block">
                    Constraints
                  </span>
                  <p className="text-xs font-sans text-foreground mt-0.5">{project.constraints}</p>
                </div>
              )}
            </Card>

            <Card className="bg-surface shadow-hard space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-foreground">
                  Architecture Status
                </h3>
                {project.blueprint ? (
                  <Badge variant="primary">Spec Synced</Badge>
                ) : (
                  <Badge variant="yellow">Awaiting Blueprint</Badge>
                )}
              </div>
              <p className="text-xs font-sans text-foreground-muted">
                {project.blueprint
                  ? `Topology includes ${project.blueprint.architecture.nodes.length} nodes and ${project.blueprint.database.entities.length} database entities.`
                  : "No architecture blueprint spec has been defined for this project yet."}
              </p>
              <div className="pt-2">
                {project.blueprint ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setTab("blueprint")}
                    icon={<FileCode2 className="w-3.5 h-3.5" />}
                  >
                    View System Blueprint
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleInitBlueprint}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Generate Blueprint Spec
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Blueprint Studio */}
      {tab === "blueprint" && (
        <BlueprintView
          blueprint={project.blueprint}
          projectName={project.name}
          projectObjective={project.objective}
          contextText={project.description}
          onCreateBlankBlueprint={handleInitBlueprint}
          onUpdateBlueprint={async (updatedBp) => {
            const updated = await projectStorage.update(project.id, { blueprint: updatedBp });
            setProject(updated);
          }}
        />
      )}

      {/* Tab 3: Milestones & Tasks */}
      {tab === "tasks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">Milestones & Action Items</h2>
              <p className="text-xs font-sans text-foreground-muted">
                Check off items as you build. Changes immediately persist locally.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleAddDefaultMilestone}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Milestone Phase
            </Button>
          </div>

          {project.milestones.length === 0 ? (
            <Card className="text-center py-12 bg-surface shadow-hard">
              <div className="max-w-md mx-auto space-y-3">
                <p className="text-sm font-sans text-foreground-muted">
                  No execution milestones configured yet.
                </p>
                <Button size="sm" onClick={handleAddDefaultMilestone}>
                  Populate Core Milestone
                </Button>
              </div>
            </Card>
          ) : (
            project.milestones.map((m) => (
              <Card key={m.id} className="bg-surface shadow-hard space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/10 gap-2">
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground">
                      {m.phase}
                    </h3>
                    <p className="text-xs font-sans text-foreground-muted mt-0.5">{m.goal}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-foreground-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {m.estimatedDuration}
                    </span>
                  </div>
                </div>

                {/* Task Checklist */}
                <div className="space-y-2">
                  {m.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(m.id, task.id)}
                      className={`flex items-start gap-3 p-3 rounded-tactile border transition-all cursor-pointer ${
                        task.status === "done"
                          ? "bg-[#FAF7ED] border-border/40 text-foreground-muted"
                          : "bg-surface border-border hover:bg-[#FAF7ED] text-foreground shadow-hard-sm"
                      }`}
                    >
                      <button className="mt-0.5 shrink-0">
                        {task.status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Circle className="w-4 h-4 text-foreground-muted" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-xs font-sans font-medium block ${
                            task.status === "done" ? "line-through text-foreground-muted" : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.completedAt && (
                          <span className="text-[10px] font-mono text-foreground-muted/70 block mt-0.5">
                            Done on {formatDate(task.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Quick Task to Milestone */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/10">
                  <input
                    type="text"
                    placeholder="Add task to this milestone…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuickAddTask(m.id);
                    }}
                    className="flex-1 bg-[#FAF7ED] border border-border rounded-tactile px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleQuickAddTask(m.id)}
                  >
                    Add
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Project Brain */}
      {tab === "brain" && (
        <ProjectBrainPanel
          projectId={project.id}
          projectName={project.name}
        />
      )}

      {/* Tab 5: Project AI Assistant */}
      {tab === "assistant" && (
        <ProjectAIAssistant
          project={project}
          memories={memories}
        />
      )}
    </div>
  );
};
