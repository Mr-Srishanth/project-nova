import { describe, it, expect, beforeEach } from "vitest";
import { brainStorage } from "./brainStorage";

describe("LocalBrowserBrainStorageAdapter - Project Isolation and CRUD", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize empty for any project", async () => {
    const list = await brainStorage.list("proj_A");
    expect(list).toEqual([]);
  });

  it("should isolate memories strictly by projectId (No leak from Project A to B)", async () => {
    // Add memory to Project A
    const memA = await brainStorage.create({
      projectId: "proj_A",
      type: "decision",
      title: "Use PostgreSQL for Project A",
      content: "Chosen for JSONB and relational support",
      source: "user",
    });

    // Add memory to Project B
    const memB = await brainStorage.create({
      projectId: "proj_B",
      type: "decision",
      title: "Use SQLite for Project B",
      content: "Chosen for zero-config embedded storage",
      source: "user",
    });

    // Verify Project A list
    const listA = await brainStorage.list("proj_A");
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe(memA.id);
    expect(listA[0].title).toBe("Use PostgreSQL for Project A");

    // Verify Project B list
    const listB = await brainStorage.list("proj_B");
    expect(listB.length).toBe(1);
    expect(listB[0].id).toBe(memB.id);
    expect(listB[0].title).toBe("Use SQLite for Project B");

    // Verify Project C list is empty
    const listC = await brainStorage.list("proj_C");
    expect(listC).toEqual([]);
  });

  it("should update and delete memory items safely", async () => {
    const mem = await brainStorage.create({
      projectId: "proj_test",
      type: "constraint",
      title: "Zero external dependencies",
      content: "Must run self-contained offline",
      source: "user",
    });

    const updated = await brainStorage.update(mem.id, {
      title: "Strict offline compliance",
      content: "No telemetry or live phone-home calls permitted",
    });

    expect(updated.title).toBe("Strict offline compliance");

    const deleted = await brainStorage.delete(mem.id);
    expect(deleted).toBe(true);

    const list = await brainStorage.list("proj_test");
    expect(list.length).toBe(0);
  });

  it("should search and filter memories by type", async () => {
    await brainStorage.create({
      projectId: "proj_search",
      type: "decision",
      title: "Adopt Tailwind CSS",
      content: "For utility tokens",
      source: "user",
    });

    await brainStorage.create({
      projectId: "proj_search",
      type: "risk",
      title: "Local storage 5MB quota limit",
      content: "Can exceed quota with huge blueprints",
      source: "ai",
    });

    const decisions = await brainStorage.search("proj_search", "", "decision");
    expect(decisions.length).toBe(1);
    expect(decisions[0].type).toBe("decision");

    const keywordSearch = await brainStorage.search("proj_search", "quota");
    expect(keywordSearch.length).toBe(1);
    expect(keywordSearch[0].title).toContain("5MB quota limit");
  });
});
