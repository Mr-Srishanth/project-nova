export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskItem {
  id: string;
  milestoneId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  estimatedHours?: number;
  completedAt?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  order: number;
  phase: string;
  goal: string;
  estimatedDuration: string;
  dependencies: string[];
  skillsOrTech: string[];
  tasks: TaskItem[];
}
