/**
 * Tests for plain-language Ask answers.
 * Regression: a live student test (2026-10-26, "Rosy Test Simple") asked
 * "explain in very simple words what this app does" and got the canned
 * technical line about artifacts and a Vite React target. Simple answers
 * must never contain that vocabulary.
 */
import { describe, expect, it } from "vitest";
import {
  needsSimpleAnswer,
  isSimpleLanguageRequest,
  isAppExplanationRequest,
  buildSimpleAppAdvisory,
  SIMPLE_ANSWER_FORBIDDEN_WORDS,
} from "./simpleAppDescription";

const FLOWER_OBJECTIVE =
  "Create a simple, colourful website that shows a short list of flowers with names and prices.";

describe("needsSimpleAnswer", () => {
  it("detects the exact live student question", () => {
    expect(
      needsSimpleAnswer(
        "Hi, I am a student. Can you please explain in very simple words what this app does?",
      ),
    ).toBe(true);
  });

  it("detects ELI5 / plain-language requests", () => {
    expect(isSimpleLanguageRequest("explain like i'm 5 what this does")).toBe(true);
    expect(isSimpleLanguageRequest("in plain language please")).toBe(true);
  });

  it("detects what-does-this-app-do without a simple marker", () => {
    expect(isAppExplanationRequest("what does this app do?")).toBe(true);
    expect(isAppExplanationRequest("explain this website")).toBe(true);
  });

  it("does not flag technical questions as simple", () => {
    expect(needsSimpleAnswer("How does the routing work in this app?")).toBe(false);
    expect(needsSimpleAnswer("Add a high-score leaderboard")).toBe(false);
  });
});

describe("buildSimpleAppAdvisory", () => {
  it("restates the flower objective in simple words, with no tech vocabulary", () => {
    const advisory = buildSimpleAppAdvisory(
      "Rosy Test Simple",
      FLOWER_OBJECTIVE,
      undefined,
      undefined,
    );
    expect(advisory).toContain("flowers");
    expect(advisory).toContain("names and prices");
    for (const word of SIMPLE_ANSWER_FORBIDDEN_WORDS) {
      expect(advisory!.toLowerCase()).not.toContain(word);
    }
  });

  it("falls back to visible words from the app's own code", () => {
    const advisory = buildSimpleAppAdvisory(
      "Rosy Test Simple",
      undefined,
      undefined,
      `export const App = () => <div><h1>Rosy Bloom</h1><p>Brighten Your Day</p></div>;`,
    );
    expect(advisory).toContain("Rosy Bloom");
    for (const word of SIMPLE_ANSWER_FORBIDDEN_WORDS) {
      expect(advisory!.toLowerCase()).not.toContain(word);
    }
  });

  it("returns null when there is nothing grounded to explain from", () => {
    expect(buildSimpleAppAdvisory("Empty", undefined, undefined, undefined)).toBeNull();
    expect(buildSimpleAppAdvisory("Empty", undefined, undefined, "")).toBeNull();
  });
});
