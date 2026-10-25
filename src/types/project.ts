import type { Blueprint } from "./blueprint";
import type { Milestone } from "./task";
import type { StageState, RoadmapMilestone } from "./roadmap";

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export type ProjectCategory =
  | "Web Application"
  | "AI & Machine Learning"
  | "Mobile App"
  | "Cloud & Infrastructure"
  | "Data Engineering"
  | "Developer Tool"
  | "Other";

export type DiscoveryMode =
  | "custom"
  | "tech"
  | "goal"
  | "gap"
  | "ai";

export interface Project {
  id: string;
  name: string;
  description: string;
  objective: string;
  category: ProjectCategory;
  technologies: string[];
  status: ProjectStatus;
  discoveryMode: DiscoveryMode;
  targetDeadline?: string;
  constraints?: string;
  createdAt: string;
  updatedAt: string;
  blueprint?: Blueprint;
  milestones: Milestone[];
  // Phase 4 Extensions (backward compatible)
  stageStates?: StageState[];
  roadmapMilestones?: RoadmapMilestone[];
  // Single-Prompt Project Creation Handoff
  initialPrompt?: string;
  generationStatus?: "not_generated" | "generating" | "generated" | "failed";
}

export interface CreateProjectInput {
  name: string;
  description: string;
  objective: string;
  category: ProjectCategory;
  technologies: string[];
  discoveryMode?: DiscoveryMode;
  targetDeadline?: string;
  constraints?: string;
  initialPrompt?: string;
  generationStatus?: "not_generated" | "generating" | "generated" | "failed";
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  objective?: string;
  category?: ProjectCategory;
  technologies?: string[];
  status?: ProjectStatus;
  targetDeadline?: string;
  constraints?: string;
  blueprint?: Blueprint;
  milestones?: Milestone[];
  stageStates?: StageState[];
  roadmapMilestones?: RoadmapMilestone[];
  initialPrompt?: string;
  generationStatus?: "not_generated" | "generating" | "generated" | "failed";
}
