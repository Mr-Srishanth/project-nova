// ProjectNova AI — Typed Domain Models
// Primary Title: An AI-Based Personalized Project Idea Generation and Recommendation System

export type AcademicLevel = 'Undergraduate' | 'Postgraduate' | 'High School' | 'Self-Taught' | 'PhD/Researcher';

export type TimeAvailability = 'Part-Time (< 10 hrs/wk)' | 'Standard (10-20 hrs/wk)' | 'Intensive (20-40 hrs/wk)' | 'Full-Time Bootcamp';

export type BudgetConstraint = 'Zero Budget ($0 - Free Tier Only)' | 'Low (< $50 for hosting/APIs)' | 'Moderate ($50 - $200)' | 'Funded/Lab ($200+)';

export interface StudentProfile {
  id: string;
  name: string;
  academicLevel: AcademicLevel;
  major: string;
  existingSkills: string[];
  primaryInterests: string[];
  careerGoal: string;
  timeAvailability: TimeAvailability;
  targetDeadlineWeeks: number;
  budgetConstraint: BudgetConstraint;
  targetHardware?: string;
  preferredDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillGapItem {
  skill: string;
  category: 'Prerequisite' | 'Core Framework' | 'DevOps/Tooling' | 'Domain Knowledge';
  requiredLevel: 'Foundational' | 'Intermediate' | 'Advanced';
  studentHas: boolean;
  learningDifficulty: 'Low' | 'Medium' | 'High';
  estimatedLearningHours: number;
  recommendedResource: string;
}

export interface SkillGapReport {
  projectId: string;
  studentId: string;
  overlapScore: number; // 0 to 1
  matchedSkills: string[];
  missingSkills: SkillGapItem[];
  totalLearningCurveWeeks: number;
  gapSummary: string;
}

export interface ExistingProjectSource {
  id: string;
  title: string;
  description: string;
  domain: string;
  techStack: string[];
  sourceUrl?: string;
  sourceType: 'GitHub' | 'IEEE/ArXiv' | 'Kaggle' | 'Commercial Product';
  keyDifferentiator: string;
}

export interface SimilarityEvidence {
  sourceProjectId: string;
  sourceTitle: string;
  similarityScore: number; // 0 to 1
  commonPatterns: string[];
  distinguishingGaps: string[];
  sourceType: string;
}

export interface NoveltyReport {
  overallNoveltyScore: number; // 0 (Commodity) to 100 (Highly Novel)
  methodUsed: 'Gemini Semantic Embeddings' | 'TF-IDF Lexical Cosine Vectorizer';
  topSimilarProjects: SimilarityEvidence[];
  noveltyVerdict: 'Standard Template' | 'Iterative Improvement' | 'High Novelty' | 'Breakthrough Concept';
  limitations: string;
  differentiationOpportunities: string[];
}

export interface FeasibilityAssessment {
  feasibilityScore: number; // 0 to 100
  complexityLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
  estimatedHours: number;
  estimatedCostUSD: number;
  resourceRisk: 'Low' | 'Medium' | 'Critical';
  timeRisk: 'Within Bounds' | 'Tight Schedule' | 'Likely Overrun';
  technicalDependencies: string[];
  riskMitigations: { risk: string; mitigation: string }[];
  verdict: 'Highly Feasible' | 'Feasible with Scoping' | 'High Risk';
}

export interface RecommendationBreakdown {
  skillFitScore: number;        // weight: 0.25
  interestAlignmentScore: number;// weight: 0.25
  feasibilityScore: number;      // weight: 0.20
  learningValueScore: number;    // weight: 0.15
  noveltyScore: number;          // weight: 0.15
  finalWeightedScore: number;    // 0 to 100
  reasoning: string[];
  pros: string[];
  cons: string[];
}

export interface ProjectIdea {
  id: string;
  title: string;
  tagline: string;
  domain: string;
  problemStatement: string;
  measurableObjectives: string[];
  proposedSolution: string;
  suggestedStack: {
    frontend: string;
    backend: string;
    database: string;
    aiOrSpecialized: string;
  };
  complexity: 'Beginner' | 'Intermediate' | 'Advanced' | 'Industry/Research';
  estimatedWeeks: number;
  estimatedCost: string;
  prerequisites: string[];
  isEvolved?: boolean;
  evolutionSummary?: string;
  parentIdeaId?: string;
}

export interface ArchitectureModule {
  name: string;
  role: string;
  technologies: string[];
  inputs: string[];
  outputs: string[];
}

export interface DataEntity {
  name: string;
  fields: { name: string; type: string; description: string }[];
  relationships: string[];
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestPayload?: string;
  responsePayload: string;
}

export interface TestingPlanItem {
  stage: 'Unit Testing' | 'Integration' | 'Evaluation Benchmark' | 'User Testing';
  tool: string;
  objective: string;
  successMetric: string;
}

export interface ProjectBlueprint {
  id: string;
  projectIdeaId: string;
  systemArchitectureOverview: string;
  modules: ArchitectureModule[];
  dataModel: DataEntity[];
  apiContracts: ApiEndpoint[];
  recommendedTechStack: {
    layer: string;
    chosenTech: string;
    rationale: string;
  }[];
  milestones: {
    phase: string;
    deliverable: string;
    estimatedDays: number;
  }[];
  testingStrategy: TestingPlanItem[];
  ddlSchemaSql: string;
  generatedAt: string;
}

export interface RoadmapMilestone {
  id: string;
  weekNumber: number;
  title: string;
  type: 'Learning & Skill Acquisition' | 'Core Architecture' | 'Feature Implementation' | 'Evaluation & Polish';
  learningObjectives: string[];
  implementationDeliverable: string;
  resources: { name: string; url: string }[];
  verificationCriteria: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface EvaluationComparison {
  projectTitle: string;
  projectNovaScore: number;
  baselineRandomScore: number;
  baselineKeywordScore: number;
  skillAlignmentDelta: number;
  noveltyDelta: number;
  studentSatisfactionRating?: number; // 1 to 5
}
