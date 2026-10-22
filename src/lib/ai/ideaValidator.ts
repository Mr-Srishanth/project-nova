import type { IdeaUnderstandingResult } from "./ideaTypes";
import { VALID_PROJECT_CATEGORIES } from "./ideaTypes";

/**
 * Validates and sanitizes raw JSON returned by the AI Gateway
 * ensuring high fidelity, proper types, and resilient fallback attributes.
 */
export function validateIdeaUnderstanding(
  raw: any,
  originalUserInput: string
): IdeaUnderstandingResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid response format: expected a structured JSON object.");
  }

  // Ensure suggested category is valid
  let suggestedCategory = raw.suggestedCategory;
  if (!VALID_PROJECT_CATEGORIES.includes(suggestedCategory)) {
    suggestedCategory = "Web Application";
  }

  const isVague = Boolean(raw.isVague);

  // Parse questions
  let questionsForUser = Array.isArray(raw.questionsForUser)
    ? raw.questionsForUser
        .map((q: any, i: number) => ({
          id: q.id || `q_${i}`,
          question: String(q.question || ""),
          whyItMatters: String(q.whyItMatters || ""),
          suggestedAnswers: Array.isArray(q.suggestedAnswers) ? q.suggestedAnswers : undefined,
        }))
        .filter((q: any) => q.question.trim().length > 0)
    : [];

  // Parse assumptions
  let assumptions = Array.isArray(raw.assumptions)
    ? raw.assumptions.map(String)
    : Array.isArray(raw.assumptionsToConfirm)
    ? raw.assumptionsToConfirm.map(String)
    : [];

  // If idea is marked vague or lacks details, supply focused questions and assumptions
  if (isVague) {
    if (questionsForUser.length === 0) {
      questionsForUser = [
        {
          id: "q_primary_user",
          question: "Who is the primary intended user or customer for this application?",
          whyItMatters: "Helps tailor the user experience and feature complexity.",
        },
        {
          id: "q_primary_platform",
          question: "Is this intended as a web application, mobile app, or command-line developer tool?",
          whyItMatters: "Directs technology stack choices and deployment strategy.",
        },
      ];
    }
    if (assumptions.length === 0) {
      assumptions = [
        "Initial release focuses on a streamlined single-user MVP before adding multi-tenant collaboration.",
        "Standard modern web technologies provide the fastest path to proof-of-concept.",
      ];
    }
  }

  // Parse essential features
  const essentialFeatures = Array.isArray(raw.essentialFeatures)
    ? raw.essentialFeatures.map(String)
    : Array.isArray(raw.keyFeatures)
    ? raw.keyFeatures.map(String)
    : ["Core prototype functionality and user workflow"];

  // Parse improvements
  const improvements = Array.isArray(raw.improvements)
    ? raw.improvements.map((imp: any, i: number) => ({
        id: imp.id || `imp_${i}`,
        title: String(imp.title || "Architectural Recommendation"),
        rationale: String(imp.rationale || imp.description || imp.benefit || "Improves modularity and maintainability"),
        source: ["user_intent", "ai_recommendation", "assumption"].includes(imp.source)
          ? imp.source
          : "ai_recommendation",
        category: ["architecture", "ux", "scope", "security"].includes(imp.category)
          ? imp.category
          : "architecture",
      }))
    : [];

  const result: IdeaUnderstandingResult = {
    originalIdea:
      typeof raw.originalIdea === "string" && raw.originalIdea.trim()
        ? raw.originalIdea
        : originalUserInput,
    coreIntent:
      typeof raw.coreIntent === "string" && raw.coreIntent.trim()
        ? raw.coreIntent
        : `Build a software application based on: ${originalUserInput}`,
    polishedSummary:
      typeof raw.polishedSummary === "string" && raw.polishedSummary.trim()
        ? raw.polishedSummary
        : typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary
        : originalUserInput,
    problemStatement:
      typeof raw.problemStatement === "string" && raw.problemStatement.trim()
        ? raw.problemStatement
        : "Address targeted user requirements effectively.",
    targetUsers: Array.isArray(raw.targetUsers) && raw.targetUsers.length > 0
      ? raw.targetUsers.filter((u: any) => typeof u === "string")
      : ["Target Audience / End Users"],
    proposedSolution:
      typeof raw.proposedSolution === "string" && raw.proposedSolution.trim()
        ? raw.proposedSolution
        : "A modern responsive software system.",

    suggestedName:
      typeof raw.suggestedName === "string" && raw.suggestedName.trim()
        ? raw.suggestedName.trim()
        : typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : "Project Nova Workspace",
    suggestedCategory,
    mainObjective:
      typeof raw.mainObjective === "string" && raw.mainObjective.trim()
        ? raw.mainObjective.trim()
        : `Build and deploy an MVP for ${raw.name || "the project"}.`,

    essentialFeatures,
    optionalFeatures: Array.isArray(raw.optionalFeatures) ? raw.optionalFeatures.map(String) : [],
    recommendedMvpScope:
      typeof raw.recommendedMvpScope === "string" && raw.recommendedMvpScope.trim()
        ? raw.recommendedMvpScope
        : "Core functional prototype with essential features.",

    suggestedTechnologies: Array.isArray(raw.suggestedTechnologies)
      ? raw.suggestedTechnologies.map((t: any) => ({
          layer: String(t.layer || "Application"),
          tech: String(t.tech || "TypeScript"),
          why: String(t.why || "Standard robust technology"),
        }))
      : [
          { layer: "Frontend", tech: "React / TypeScript", why: "Rapid interactive UI development" },
          { layer: "Backend", tech: "Node.js / Express", why: "Lightweight API integration" },
        ],

    constraintsAndRisks: Array.isArray(raw.constraintsAndRisks)
      ? raw.constraintsAndRisks.map(String)
      : Array.isArray(raw.risksAndAssumptions)
      ? raw.risksAndAssumptions.map(String)
      : [],
    assumptions,
    assumptionsToConfirm: assumptions,

    improvements,
    questionsForUser,
    isVague,
  };

  return result as IdeaUnderstandingResult & { assumptionsToConfirm: string[] };
}

// Alias for backwards compatibility
export const validateIdeaUnderstandingResponse = validateIdeaUnderstanding;
