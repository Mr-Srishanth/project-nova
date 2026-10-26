/**
 * Integration test: Ask mode + simple student question must NOT return
 * the canned technical line. Regression for the live 2026-10-26 test in
 * "Rosy Test Simple" (student asked for simple words, got artifacts /
 * Vite React target verbatim).
 */
import { describe, expect, it } from "vitest";
import { planAIEdits } from "./aiEditEngine";
import type { BuildArtifact } from "@/types/artifact";
import { SIMPLE_ANSWER_FORBIDDEN_WORDS } from "./simpleAppDescription";

const artifacts: BuildArtifact[] = [
  {
    id: "art_1",
    projectId: "proj_flower",
    path: "src/app/App.tsx",
    type: "frontend",
    purpose: "Flower shop app",
    status: "generated",
    content: `<div><h1>Rosy Bloom</h1></div>`,
    language: "typescript",
    dependencies: [],
    versions: [],
  },
];

describe("planAIEdits ask mode, simple student question", () => {
  it("explains the flower app in simple words, modifies nothing", async () => {
    const plan = await planAIEdits({
      projectId: "proj_flower",
      projectName: "Rosy Test Simple",
      projectObjective:
        "Create a simple, colourful website that shows a short list of flowers with names and prices.",
      userPrompt:
        "Hi, I am a student. Can you please explain in very simple words what this app does?",
      mode: "ask",
      artifacts,
    });

    expect(plan.mode).toBe("ask");
    expect(plan.items.length).toBe(0);
    expect(plan.advisoryText).toContain("flowers");
    for (const word of SIMPLE_ANSWER_FORBIDDEN_WORDS) {
      expect(plan.advisoryText!.toLowerCase()).not.toContain(word);
    }
  });

  it("technical ask questions still get the technical advisory", async () => {
    const plan = await planAIEdits({
      projectId: "proj_flower",
      projectName: "Rosy Test Simple",
      userPrompt: "How does the routing work in this app?",
      mode: "ask",
      artifacts,
    });
    expect(plan.advisoryText).toContain("router.tsx");
  });
});
