import { describe, expect, it } from "vitest";
import {
  DEMO_LIVE_URL,
  DEMO_PROJECTS,
  DEMO_TEST_CASES,
  demoCartCount,
  demoCartTotal,
} from "@/lib/demo/demoData";

describe("Demo Mode predefined data", () => {
  it("includes Forkful, BistroFlow and one flower site", () => {
    expect(DEMO_PROJECTS.map((p) => p.name)).toEqual([
      "Forkful",
      "BistroFlow",
      "Rosy Bloom",
    ]);
    expect(DEMO_PROJECTS.filter((p) => p.kind === "flowers")).toHaveLength(1);
    for (const project of DEMO_PROJECTS) {
      expect(project.menu.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("computes cart count and total from local quantities only", () => {
    const forkful = DEMO_PROJECTS[0];
    const quantities = { "Truffle Mushroom Risotto": 2, Tiramisu: 1 };
    expect(demoCartCount(quantities)).toBe(3);
    expect(demoCartTotal(forkful, quantities)).toBeCloseTo(68);
  });

  it("covers all five required fail explanations", () => {
    const fails = DEMO_TEST_CASES.filter((c) => c.firstRun === "fail");
    expect(fails).toHaveLength(5);
    for (const c of fails) {
      expect(c.whyItFailed.length).toBeGreaterThan(10);
      expect(c.whatToDoNext.length).toBeGreaterThan(10);
    }
    const joined = fails.map((c) => c.whyItFailed).join(" ");
    expect(joined).toMatch(/cart/i);
    expect(joined).toMatch(/project is not defined/i);
    expect(joined).toMatch(/preview/i);
    expect(joined).toMatch(/gateway/i);
    expect(joined).toMatch(/sync/i);
  });

  it("points deploy status at the real live URL without changing it", () => {
    expect(DEMO_LIVE_URL).toBe("https://projectnova-ai.vercel.app/");
  });
});
