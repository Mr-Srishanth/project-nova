import type { ProjectCategory } from "@/types/project";

export type QuestionDecisionStatus = "unanswered" | "answered" | "recommended" | "confirmed";

export interface ClarificationQuestion {
  id: string;
  round: number;
  question: string;
  category: "platform" | "architecture" | "storage" | "auth" | "ai" | "scope" | "constraints";
  plainLanguageExplanation: string;
  whyItMatters: string;
  options: string[];
  selectedOption?: string;
  customAnswer?: string;
  status: QuestionDecisionStatus;
  recommendation?: {
    suggestedAnswer: string;
    explanation: string;
    tradeoffs?: string;
  };
  isOptional?: boolean;
}

export interface UserConfirmedDecision {
  questionId: string;
  question: string;
  answer: string;
  source: "user_stated" | "user_answered" | "ai_recommendation_accepted";
  timestamp: string;
}

export interface ProjectSpecificationDraft {
  name: string;
  category: ProjectCategory;
  objective: string;
  description: string;
  targetUsers: string[];
  coreFeatures: string[];
  technologyStack: string[];
  architectureOverview: string;
  dataStorageNeeds: string;
  authRequirements: string;
  externalIntegrations: string[];
  constraints: string;
  assumptions: string[];
  unresolvedOptionalDetails: string[];
  confirmedDecisions: UserConfirmedDecision[];
}

export interface DiscoverySessionState {
  originalIdea: string;
  currentRound: number;
  questions: ClarificationQuestion[];
  specification: ProjectSpecificationDraft;
  manualEdits: Partial<ProjectSpecificationDraft>;
  isConfirmed: boolean;
  lastAnalyzedAt?: string;
}
