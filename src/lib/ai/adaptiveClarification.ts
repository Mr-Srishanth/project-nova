import type { ClarificationQuestion, ProjectSpecificationDraft, UserConfirmedDecision } from "@/types/discovery";
import type { IdeaUnderstandingResult } from "@/lib/ai/ideaTypes";

/**
 * Derives dynamic, high-value clarification questions tailored specifically to an analyzed idea.
 * Only questions addressing actual missing or ambiguous details are returned.
 */
export function generateAdaptiveQuestionsForIdea(
  ideaResult: IdeaUnderstandingResult,
  alreadyAnsweredIds: string[] = []
): ClarificationQuestion[] {
  const combined = `${ideaResult.originalIdea} ${ideaResult.proposedSolution} ${ideaResult.suggestedCategory} ${ideaResult.mainObjective}`.toLowerCase();
  const pool: ClarificationQuestion[] = [];

  // 1. Platform & User Interface Target
  const originalText = (ideaResult.originalIdea || "").toLowerCase();
  const mentionsExplicitPlatform =
    originalText.includes("mobile") ||
    originalText.includes("ios") ||
    originalText.includes("android") ||
    originalText.includes("desktop app") ||
    originalText.includes("cli tool") ||
    originalText.includes("terminal");

  if (!mentionsExplicitPlatform && !alreadyAnsweredIds.includes("q_platform")) {
    pool.push({
      id: "q_platform",
      round: 1,
      category: "platform",
      question: "Which primary platform should this application target?",
      plainLanguageExplanation: "Determines whether you want a web portal, an iPhone/Android app, or a desktop/CLI tool.",
      whyItMatters: "Decides the entire frontend framework, deployment pipeline, and mobile store submission needs.",
      options: [
        "Web Application (accessible via browser on desktop & mobile)",
        "Mobile App (iOS & Android native or React Native)",
        "Desktop Application (cross-platform desktop window)",
        "Command-Line Tool (CLI terminal utility)",
      ],
      recommendation: {
        suggestedAnswer: "Web Application (accessible via browser on desktop & mobile)",
        explanation: "A responsive web application has zero install friction and delivers the fastest time to feedback.",
        tradeoffs: "Cannot access native hardware APIs as deeply as compiled iOS/Android apps.",
      },
      status: "unanswered",
      isOptional: false,
    });
  }

  // 2. Accounts & Authentication
  const mentionsAuth = combined.includes("auth") || combined.includes("login") || combined.includes("account") || combined.includes("user profile") || combined.includes("sign up");
  if (!mentionsAuth && !alreadyAnsweredIds.includes("q_auth")) {
    pool.push({
      id: "q_auth",
      round: 1,
      category: "auth",
      question: "Do users need to create accounts and log in?",
      plainLanguageExplanation: "Decides whether visitors can use the tool immediately as guests, or if personal data must be secured behind passwords.",
      whyItMatters: "Adds user databases, session handling, email verification, and security compliance.",
      options: [
        "No accounts needed (instant access / anonymous tool)",
        "Standard Accounts (Email + Password & OAuth like Google/GitHub)",
        "Local Only (Private to user's device, zero centralized accounts)",
      ],
      recommendation: {
        suggestedAnswer: combined.includes("note") || combined.includes("tool")
          ? "No accounts needed (instant access / anonymous tool)"
          : "Standard Accounts (Email + Password & OAuth like Google/GitHub)",
        explanation: "Matches the core user journey without creating unnecessary sign-up friction.",
        tradeoffs: "Standard accounts require user database management and security token handling.",
      },
      status: "unanswered",
      isOptional: false,
    });
  }

  // 3. Data Storage & Multi-Device Sync
  const mentionsStorage = combined.includes("database") || combined.includes("sync") || combined.includes("cloud") || combined.includes("sqlite") || combined.includes("postgres");
  if (!mentionsStorage && !alreadyAnsweredIds.includes("q_storage")) {
    pool.push({
      id: "q_storage",
      round: 1,
      category: "storage",
      question: "How should project data be stored and synchronized?",
      plainLanguageExplanation: "Where information (records, documents, profiles) lives after someone closes their browser.",
      whyItMatters: "Directly impacts monthly server hosting costs, offline capability, and data privacy.",
      options: [
        "Cloud Database (centralized PostgreSQL / Supabase, auto-synced everywhere)",
        "Local-First / In-Browser (private SQLite/IndexedDB on user device)",
        "Stateless / Transient (no persistence required between sessions)",
      ],
      recommendation: {
        suggestedAnswer: "Cloud Database (centralized PostgreSQL / Supabase, auto-synced everywhere)",
        explanation: "Provides instant multi-device continuity and automatic backups for users.",
        tradeoffs: "Requires cloud database hosting and data security management.",
      },
      status: "unanswered",
      isOptional: false,
    });
  }

  // 4. AI Provider & Processing Model (if AI is involved)
  const isAiApp = combined.includes("ai") || combined.includes("llm") || combined.includes("chat") || combined.includes("agent") || ideaResult.suggestedCategory === "AI & Machine Learning";
  if (isAiApp && !alreadyAnsweredIds.includes("q_ai_model")) {
    pool.push({
      id: "q_ai_model",
      round: 2,
      category: "ai",
      question: "How should AI inferences be processed and funded?",
      plainLanguageExplanation: "Determines whether AI calls use cloud providers (Gemini/OpenAI) or open-source local models.",
      whyItMatters: "Affects API per-token cost, latency, GPU requirements, and user privacy.",
      options: [
        "Cloud AI Gateway (Gemini API with secure server-side keys)",
        "Bring-Your-Own-Key (Users provide their own API key in client settings)",
        "Local Open-Source (runs on device via WebLLM/Ollama, zero API fees)",
      ],
      recommendation: {
        suggestedAnswer: "Cloud AI Gateway (Gemini API with secure server-side keys)",
        explanation: "Simplest for end users with zero setup, leveraging high-speed inference.",
        tradeoffs: "Requires managing server API quotas and developer keys.",
      },
      status: "unanswered",
      isOptional: true,
    });
  }

  // 5. External Integrations / Third-Party APIs
  if (!alreadyAnsweredIds.includes("q_integrations")) {
    pool.push({
      id: "q_integrations",
      round: 2,
      category: "architecture",
      question: "Are there third-party services or APIs this system must connect with?",
      plainLanguageExplanation: "Services like payment gateways (Stripe), email senders (Resend), or external data providers.",
      whyItMatters: "Specifies external authentication credentials, webhook listeners, and third-party reliability risks.",
      options: [
        "Standalone (No external paid APIs required for MVP)",
        "Payments & Billing (Stripe / LemonSqueezy integration)",
        "Messaging & Notifications (Email / SMS / Webhooks)",
      ],
      recommendation: {
        suggestedAnswer: "Standalone (No external paid APIs required for MVP)",
        explanation: "Minimizes external points of failure for rapid launch and testing.",
        tradeoffs: "Limits monetized billing until post-MVP.",
      },
      status: "unanswered",
      isOptional: true,
    });
  }

  // Return up to 3 high-value questions for manageable rounds
  return pool.slice(0, 3);
}

/**
 * Maps the analyzed idea and user-confirmed decisions into a full ProjectSpecificationDraft.
 */
export function compileSpecificationFromAnalysis(
  ideaResult: IdeaUnderstandingResult,
  confirmedDecisions: UserConfirmedDecision[] = [],
  existingDraft?: Partial<ProjectSpecificationDraft>
): ProjectSpecificationDraft {
  const techList = ideaResult.suggestedTechnologies.map((t) => (typeof t === "string" ? t : t.tech));
  
  // Incorporate confirmed decisions into tech stack, description, or storage
  let dataStorage = "Local storage and state cache";
  let authRequirements = "No mandatory login required for initial prototype";
  const extraFeatures: string[] = [];
  const integrations: string[] = [];

  for (const decision of confirmedDecisions) {
    if (decision.questionId === "q_platform") {
      extraFeatures.push(`Platform target: ${decision.answer}`);
    } else if (decision.questionId === "q_auth") {
      authRequirements = decision.answer;
    } else if (decision.questionId === "q_storage") {
      dataStorage = decision.answer;
    } else if (decision.questionId === "q_ai_model") {
      extraFeatures.push(`AI processing: ${decision.answer}`);
    } else if (decision.questionId === "q_integrations") {
      integrations.push(decision.answer);
    }
  }

  const allFeatures = Array.from(new Set([...ideaResult.essentialFeatures, ...extraFeatures]));

  return {
    name: existingDraft?.name || ideaResult.suggestedName || "ProjectNova Workspace",
    category: existingDraft?.category || ideaResult.suggestedCategory || "Web Application",
    objective: existingDraft?.objective || ideaResult.mainObjective || ideaResult.coreIntent,
    description:
      existingDraft?.description ||
      `${ideaResult.polishedSummary}\n\nProblem Solved: ${ideaResult.problemStatement}\n\nArchitecture: ${ideaResult.proposedSolution}`,
    targetUsers: existingDraft?.targetUsers || (ideaResult.targetUsers.length > 0 ? ideaResult.targetUsers : ["End Users"]),
    coreFeatures: existingDraft?.coreFeatures || allFeatures,
    technologyStack: existingDraft?.technologyStack || techList,
    architectureOverview: existingDraft?.architectureOverview || ideaResult.proposedSolution,
    dataStorageNeeds: existingDraft?.dataStorageNeeds || dataStorage,
    authRequirements: existingDraft?.authRequirements || authRequirements,
    externalIntegrations: existingDraft?.externalIntegrations || (integrations.length > 0 ? integrations : ["None for MVP"]),
    constraints: existingDraft?.constraints || (ideaResult.constraintsAndRisks.length > 0 ? ideaResult.constraintsAndRisks.join("; ") : "2-week MVP delivery"),
    assumptions: existingDraft?.assumptions || (ideaResult.assumptions.length > 0 ? ideaResult.assumptions : ["Standard responsive web deployment"]),
    unresolvedOptionalDetails: ideaResult.optionalFeatures || [],
    confirmedDecisions,
  };
}
