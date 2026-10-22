import { describe, it, expect } from "vitest";
import { validateIdeaUnderstanding } from "@/lib/ai/ideaValidator";
import {
  generateAdaptiveQuestionsForIdea,
  compileSpecificationFromAnalysis,
} from "@/lib/ai/adaptiveClarification";
import type { IdeaUnderstandingResult } from "@/lib/ai/ideaTypes";

describe("Idea Understanding Validator", () => {
  it("successfully parses and fills defaults for valid Gemini JSON payload", () => {
    const raw = {
      originalIdea: "Build a markdown note taking tool with peer to peer sync",
      coreIntent: "Secure, decentralized markdown editing",
      polishedSummary: "A secure markdown editor with P2P synchronization.",
      problemStatement: "Cloud-locked note taking apps risk privacy.",
      targetUsers: "Developers and privacy enthusiasts",
      mainObjective: "Deliver decentralized local-first note synchronization.",
      proposedSolution: "CRDT-based synchronization over WebRTC.",
      suggestedName: "NoteMesh",
      suggestedCategory: "Web Application",
      essentialFeatures: ["Markdown rendering", "P2P WebRTC sync", "Local SQLite storage"],
      optionalFeatures: ["Mobile app", "Custom themes"],
      recommendedMvpScope: "2 weeks MVP covering basic editor and WebRTC room sync.",
      suggestedTechnologies: ["React", "TypeScript", "Automerge", "Tailwind CSS"],
      constraintsAndRisks: ["NAT traversal might fail without TURN server"],
      assumptionsToConfirm: ["Users are willing to manually share connection tokens"],
      missingInformation: [],
      questionsForUser: [],
      improvements: [
        {
          id: "imp-1",
          title: "End-to-End Encryption",
          description: "Encrypt CRDT messages using AES-GCM before sending over WebRTC",
          benefit: "Zero-knowledge note storage and transfer",
          source: "ai_recommendation",
        },
      ],
      isVague: false,
    };

    const validated = validateIdeaUnderstanding(raw, "Build a markdown note taking tool");
    expect(validated.suggestedName).toBe("NoteMesh");
    expect(validated.suggestedCategory).toBe("Web Application");
    expect(validated.essentialFeatures).toHaveLength(3);
    expect(validated.improvements).toHaveLength(1);
    expect(validated.isVague).toBe(false);
  });

  it("handles malformed or missing fields safely and provides sensible fallbacks", () => {
    const raw = {
      suggestedName: "   ",
      suggestedCategory: "NonExistentCategory",
      improvements: "not-an-array",
    };

    const validated = validateIdeaUnderstanding(raw, "Make a food delivery app for pets");
    expect(validated.suggestedName).toBe("Project Nova Workspace");
    expect(validated.suggestedCategory).toBe("Web Application");
    expect(validated.essentialFeatures.length).toBeGreaterThan(0);
    expect(Array.isArray(validated.improvements)).toBe(true);
    expect(validated.originalIdea).toBe("Make a food delivery app for pets");
  });

  it("identifies vague ideas and ensures clarification questions and assumptions exist", () => {
    const raw = {
      originalIdea: "AI app",
      isVague: true,
      suggestedName: "AI Tool",
      questionsForUser: [],
      assumptionsToConfirm: [],
    };

    const validated = validateIdeaUnderstanding(raw, "AI app");
    expect(validated.isVague).toBe(true);
    expect(validated.questionsForUser.length).toBeGreaterThan(0);
    expect(validated.assumptionsToConfirm?.length).toBeGreaterThan(0);
  });
});

describe("Adaptive Clarification & Specification Pipeline Tests", () => {
  const sampleIdeaResult: IdeaUnderstandingResult = {
    originalIdea: "A fitness coaching application with workout plans and progress metrics",
    coreIntent: "Track workouts and deliver personalized exercise schedules",
    polishedSummary: "A tailored digital workout planner and activity tracking suite.",
    problemStatement: "Gym-goers struggle to consistently track sets, reps, and nutrition.",
    targetUsers: ["Athletes", "Personal Trainers", "Beginners"],
    proposedSolution: "Modular client interface with workout tracking and telemetry graphs.",
    suggestedName: "FitNova Engine",
    suggestedCategory: "Web Application",
    mainObjective: "Deliver an MVP enabling users to build and log workout routines.",
    essentialFeatures: ["Exercise database", "Routine builder", "Progress analytics"],
    optionalFeatures: ["Wearable integration", "Social leaderboard"],
    recommendedMvpScope: "2-week MVP covering workout logging and routine creation.",
    suggestedTechnologies: [
      { layer: "Frontend", tech: "React + TypeScript", why: "Rapid UI iteration" },
      { layer: "Storage", tech: "PostgreSQL", why: "Structured workout history" },
    ],
    constraintsAndRisks: ["Must support offline mobile access"],
    assumptions: ["Initial release targets individual athletes"],
    improvements: [],
    questionsForUser: [],
    isVague: false,
  };

  it("dynamically generates targeted questions for platform and accounts when unstated", () => {
    const questions = generateAdaptiveQuestionsForIdea(sampleIdeaResult, []);
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions.some((q) => q.category === "platform")).toBe(true);
    expect(questions.some((q) => q.category === "auth")).toBe(true);

    const platformQ = questions.find((q) => q.category === "platform");
    expect(platformQ?.recommendation).toBeDefined();
    expect(platformQ?.recommendation?.suggestedAnswer).toContain("Web Application");
  });

  it("does not repeat questions whose IDs are already answered", () => {
    const questions = generateAdaptiveQuestionsForIdea(sampleIdeaResult, ["q_platform", "q_auth"]);
    expect(questions.some((q) => q.id === "q_platform")).toBe(false);
    expect(questions.some((q) => q.id === "q_auth")).toBe(false);
  });

  it("compiles specification accurately incorporating confirmed decisions and provenance", () => {
    const confirmedDecisions = [
      {
        questionId: "q_platform",
        question: "Which platform?",
        answer: "Mobile App (iOS & Android)",
        source: "user_answered" as const,
        timestamp: new Date().toISOString(),
      },
      {
        questionId: "q_auth",
        question: "Accounts needed?",
        answer: "Standard Accounts (Google/Email)",
        source: "ai_recommendation_accepted" as const,
        timestamp: new Date().toISOString(),
      },
    ];

    const spec = compileSpecificationFromAnalysis(sampleIdeaResult, confirmedDecisions);
    expect(spec.name).toBe("FitNova Engine");
    expect(spec.authRequirements).toBe("Standard Accounts (Google/Email)");
    expect(spec.coreFeatures.some((f) => f.includes("Mobile App"))).toBe(true);
    expect(spec.confirmedDecisions).toHaveLength(2);
    expect(spec.confirmedDecisions[1].source).toBe("ai_recommendation_accepted");
  });

  it("preserves manual field edits over AI defaults when compiling specification", () => {
    const spec = compileSpecificationFromAnalysis(sampleIdeaResult, [], {
      name: "Custom Gym Tracker",
      constraints: "Budget under $100/mo",
    });

    expect(spec.name).toBe("Custom Gym Tracker");
    expect(spec.constraints).toBe("Budget under $100/mo");
    expect(spec.category).toBe("Web Application");
  });
});
