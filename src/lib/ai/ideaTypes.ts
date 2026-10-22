import type { ProjectCategory } from "@/types/project";

export interface IdeaClarificationQuestion {
  id: string;
  question: string;
  whyItMatters: string;
  suggestedAnswers?: string[];
}

export interface ProposedImprovement {
  id: string;
  title: string;
  rationale: string;
  source: "user_intent" | "ai_recommendation" | "assumption";
  category: "architecture" | "ux" | "scope" | "security";
}

export interface IdeaUnderstandingResult {
  // 1. Core Intent & Clarity
  originalIdea: string;
  coreIntent: string;
  polishedSummary: string;
  problemStatement: string;
  targetUsers: string[];
  proposedSolution: string;

  // 2. Project Seed Attributes
  suggestedName: string;
  suggestedCategory: ProjectCategory;
  mainObjective: string;

  // 3. Feature Breakdown
  essentialFeatures: string[];
  optionalFeatures: string[];
  recommendedMvpScope: string;

  // 4. Technology & Feasibility
  suggestedTechnologies: { layer: string; tech: string; why: string }[];
  constraintsAndRisks: string[];
  assumptions: string[];
  assumptionsToConfirm?: string[];

  // 5. Intelligent Proposals & Questions
  improvements: ProposedImprovement[];
  questionsForUser: IdeaClarificationQuestion[];
  isVague: boolean;
}

export const VALID_PROJECT_CATEGORIES: ProjectCategory[] = [
  "Web Application",
  "AI & Machine Learning",
  "Mobile App",
  "Cloud & Infrastructure",
  "Data Engineering",
  "Developer Tool",
  "Other",
];
