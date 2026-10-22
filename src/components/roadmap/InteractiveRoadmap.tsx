import React, { useState } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  AlertOctagon,
} from "lucide-react";
import type { RoadmapMilestone, WorkflowTask, TaskPriority, TaskWorkflowStatus } from "@/types/roadmap";
import type { ProjectMemory } from "@/types/memory";
import { validateDependency, isTaskBlocked, removeDependency } from "@/lib/roadmap/dependencyGraph";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface InteractiveRoadmapProps {
  milestones: RoadmapMilestone[];
  memories: ProjectMemory[];
  onUpdateMilestones: (updated: RoadmapMilestone[]) => Promise<void> | void;
}

const PRIORITY_BADGES: Record<TaskPriority, "danger" | "yellow" | "blue" | "muted"> = {
  critical: "danger",
  high: "yellow",
  medium: "blue",
  low: "muted",
};

export const InteractiveRoadmap: React.FC<InteractiveRoadmapProps> = ({
  milestones,
  memories,
  onUpdateMilestones,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingTaskMilestoneId, setAddingTaskMilestoneId] = useState<string | null>(null);
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newEstimatedHours, setNewEstimatedHours] = useState<number>(4);
  const [newDueDate, setNewDueDate] = useState<string>("");

  const allTasks = milestones.flatMap((m) => m.tasks);

  // Unassigned risks from Project Brain that have no associated tasks
  const associatedMemoryIds = new Set(allTasks.flatMap((t) => t.associatedMemoryIds || []));
  const unassignedRisks = memories.filter(
    (m) => m.type === "risk" && !associatedMemoryIds.has(m.id)
  );

  const handleToggleTaskStatus = async (milestoneId: string, taskId: string) => {
    const updated = milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        tasks: m.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextStatus: TaskWorkflowStatus = t.status === "done" ? "todo" : "done";
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === "done" ? new Date().toISOString() : undefined,
          };
        }),
      };
    });
    await onUpdateMilestones(updated);
  };

  const handleCreateTask = async (milestoneId: string) => {
    if (!newTitle.trim()) return;

    const newTask: WorkflowTask = {
      id: `task_${Date.now()}`,
      milestoneId,
      title: newTitle.trim(),
      status: "todo",
      priority: newPriority,
      estimatedHours: newEstimatedHours,
      dueDate: newDueDate || undefined,
      dependencies: [],
      associatedMemoryIds: [],
    };

    const updated = milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        tasks: [...m.tasks, newTask],
      };
    });

    await onUpdateMilestones(updated);
    setNewTitle("");
    setAddingTaskMilestoneId(null);
  };

  const handleDeleteTask = async (milestoneId: string, taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirm = window.confirm("Are you sure you want to delete this task?");
    if (!confirm) return;

    const updated = milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        tasks: m.tasks
          .filter((t) => t.id !== taskId)
          .map((t) => removeDependency(t, taskId)), // Clean up any predecessor references
      };
    });

    await onUpdateMilestones(updated);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  const handleAddDependency = async (targetTaskId: string, dependsOnTaskId: string) => {
    setDependencyError(null);
    const validation = validateDependency(targetTaskId, dependsOnTaskId, allTasks);

    if (!validation.isValid) {
      setDependencyError(validation.error || "Invalid dependency relationship.");
      return;
    }

    const updated = milestones.map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => {
        if (t.id !== targetTaskId) return t;
        return {
          ...t,
          dependencies: [...t.dependencies, dependsOnTaskId],
        };
      }),
    }));

    await onUpdateMilestones(updated);
    setLinkingTaskId(null);
  };

  const handleRemoveDependency = async (targetTaskId: string, depId: string) => {
    const updated = milestones.map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => {
        if (t.id !== targetTaskId) return t;
        return removeDependency(t, depId);
      }),
    }));
    await onUpdateMilestones(updated);
  };

  const handleToggleMemoryAssociation = async (taskId: string, memoryId: string) => {
    const updated = milestones.map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const currentMems = t.associatedMemoryIds || [];
        const exists = currentMems.includes(memoryId);
        const nextMems = exists ? currentMems.filter((id) => id !== memoryId) : [...currentMems, memoryId];
        return {
          ...t,
          associatedMemoryIds: nextMems,
        };
      }),
    }));
    await onUpdateMilestones(updated);
  };

  return (
    <div className="space-y-6">
      {/* Unassigned Risks Banner if any exist */}
      {unassignedRisks.length > 0 && (
        <Card className="bg-accent-yellow-soft border-2 border-border p-4 shadow-hard-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-foreground">
                Project Brain: Unassigned Technical Risks ({unassignedRisks.length})
              </h4>
              <p className="text-xs font-sans text-foreground-muted leading-relaxed">
                The following identified risks have not been associated with any roadmap task yet. Review and associate them with a milestone task to ensure mitigation.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {unassignedRisks.map((r) => (
                  <Badge key={r.id} variant="yellow">
                    ⚠️ {r.title}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Dependency Linker Modal / Error Bar */}
      {dependencyError && (
        <div className="p-3 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-semibold flex items-center justify-between">
          <span>{dependencyError}</span>
          <button onClick={() => setDependencyError(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Milestones and Task Lists */}
      <div className="space-y-4">
        {milestones.length === 0 ? (
          <Card className="text-center py-12 bg-surface shadow-hard">
            <div className="max-w-md mx-auto space-y-3">
              <Clock className="w-8 h-8 text-foreground-muted mx-auto" />
              <h4 className="font-display font-bold text-base text-foreground">No Roadmap Milestones</h4>
              <p className="text-xs font-sans text-foreground-muted">
                Initial milestones will appear here as you define project stages and tasks.
              </p>
            </div>
          </Card>
        ) : (
          milestones.map((m) => {
            const completedCount = m.tasks.filter((t) => t.status === "done").length;
            const progress = m.tasks.length > 0 ? Math.round((completedCount / m.tasks.length) * 100) : 0;

            return (
              <Card key={m.id} className="bg-surface border-2 border-border shadow-hard space-y-3 p-5">
                {/* Milestone Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-border/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground uppercase">
                        {m.phase}
                      </span>
                      <Badge variant={progress === 100 ? "primary" : "blue"}>
                        {completedCount}/{m.tasks.length} Done ({progress}%)
                      </Badge>
                    </div>
                    <p className="text-xs font-sans text-foreground-muted">{m.goal}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingTaskMilestoneId(addingTaskMilestoneId === m.id ? null : m.id)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Task
                    </Button>
                  </div>
                </div>

                {/* Add Task Box */}
                {addingTaskMilestoneId === m.id && (
                  <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile space-y-3">
                    <span className="text-xs font-mono font-bold text-foreground block">
                      New Task in {m.phase}
                    </span>
                    <Input
                      placeholder="Task title, e.g. Configure JWT authentication middleware"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-mono text-foreground-muted uppercase block mb-1">
                          Priority
                        </label>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                          className="w-full bg-surface border border-border rounded-tactile px-2 py-1 text-xs"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-foreground-muted uppercase block mb-1">
                          Est. Hours
                        </label>
                        <input
                          type="number"
                          value={newEstimatedHours}
                          onChange={(e) => setNewEstimatedHours(Number(e.target.value))}
                          className="w-full bg-surface border border-border rounded-tactile px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-foreground-muted uppercase block mb-1">
                          Target Due Date
                        </label>
                        <input
                          type="date"
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                          className="w-full bg-surface border border-border rounded-tactile px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setAddingTaskMilestoneId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleCreateTask(m.id)}>
                        Create Task
                      </Button>
                    </div>
                  </div>
                )}

                {/* Task List */}
                <div className="space-y-2">
                  {m.tasks.map((task) => {
                    const blockInfo = isTaskBlocked(task, allTasks);
                    const isSelected = selectedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                        className={`p-3 rounded-tactile border-2 transition-all cursor-pointer ${
                          task.status === "done"
                            ? "bg-[#FAF7ED] border-border/30 opacity-75"
                            : blockInfo.blocked
                            ? "bg-danger/5 border-danger/40 shadow-hard-sm"
                            : isSelected
                            ? "bg-surface border-foreground shadow-hard-lg"
                            : "bg-surface border-border hover:bg-[#FAF7ED] shadow-hard-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTaskStatus(m.id, task.id);
                              }}
                              className="mt-0.5 shrink-0"
                            >
                              {task.status === "done" ? (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              ) : blockInfo.blocked ? (
                                <AlertOctagon className="w-4 h-4 text-danger" />
                              ) : (
                                <Circle className="w-4 h-4 text-foreground-muted" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs font-display font-bold ${
                                    task.status === "done" ? "line-through text-foreground-muted" : "text-foreground"
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <Badge variant={PRIORITY_BADGES[task.priority]}>
                                  {task.priority.toUpperCase()}
                                </Badge>
                                {blockInfo.blocked && (
                                  <Badge variant="danger">
                                    BLOCKED by {blockInfo.blockingTaskTitles.length} Predecessor(s)
                                  </Badge>
                                )}
                              </div>

                              {/* Dependencies tags */}
                              {task.dependencies && task.dependencies.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-foreground-muted flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-accent-blue" />
                                    Depends on:
                                  </span>
                                  {task.dependencies.map((depId) => {
                                    const dep = allTasks.find((t) => t.id === depId);
                                    return (
                                      <span
                                        key={depId}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#FAF7ED] border border-border"
                                      >
                                        <span>{dep?.title || "Task"}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveDependency(task.id, depId);
                                          }}
                                          title="Remove dependency"
                                          className="text-foreground-muted hover:text-danger ml-0.5"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.dueDate && (
                              <span className="text-[10px] font-mono text-foreground-muted flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTask(m.id, task.id, e)}
                              className="p-1 text-foreground-muted hover:text-danger rounded transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Detailed expansion card for selected task */}
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 pt-3 border-t border-border/20 space-y-3 cursor-default"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-foreground">
                                Task Details & Project Brain Associations
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setLinkingTaskId(linkingTaskId === task.id ? null : task.id)}
                                icon={<Link2 className="w-3.5 h-3.5" />}
                              >
                                Link Predecessor Dependency
                              </Button>
                            </div>

                            {/* Predecessor Linker Drawer */}
                            {linkingTaskId === task.id && (
                              <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile space-y-2">
                                <span className="text-[11px] font-mono font-bold text-foreground block">
                                  Select Predecessor Task:
                                </span>
                                <div className="space-y-1 max-h-36 overflow-y-auto">
                                  {allTasks
                                    .filter((t) => t.id !== task.id && !task.dependencies.includes(t.id))
                                    .map((candidate) => (
                                      <div
                                        key={candidate.id}
                                        onClick={() => handleAddDependency(task.id, candidate.id)}
                                        className="p-1.5 text-xs font-mono bg-surface hover:bg-primary/20 border border-border rounded cursor-pointer flex items-center justify-between"
                                      >
                                        <span className="truncate">{candidate.title}</span>
                                        <span className="text-[10px] text-foreground-muted">
                                          ({candidate.status})
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Associate Brain Memories */}
                            <div>
                              <span className="text-[11px] font-mono text-foreground-muted block mb-1.5">
                                Associated Brain Knowledge (Decisions, Constraints & Risks):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {memories.map((mem) => {
                                  const isAssoc = (task.associatedMemoryIds || []).includes(mem.id);
                                  return (
                                    <button
                                      key={mem.id}
                                      type="button"
                                      onClick={() => handleToggleMemoryAssociation(task.id, mem.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-tactile-sm text-[10px] font-mono border transition-all ${
                                        isAssoc
                                          ? "bg-accent-blue/30 border-foreground text-foreground font-bold shadow-hard-sm"
                                          : "bg-surface border-border/50 text-foreground-muted hover:border-border"
                                      }`}
                                    >
                                      <span>{mem.type === "risk" ? "⚠️" : "💡"}</span>
                                      <span>{mem.title}</span>
                                      <span>{isAssoc ? "✓" : "+"}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
