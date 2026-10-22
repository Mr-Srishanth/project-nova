import type { ProjectMemory, MemoryRetrievalResult, AssembledMemoryContext } from "@/types/memory";

/**
 * Project-Scoped Memory Retrieval & Budget Engine
 * Deterministically ranks memories based on:
 * 1. Project boundary (strict isolation).
 * 2. Active status (superseded and archived memories excluded from context).
 * 3. Verification state (user_confirmed has higher priority than unverified/ai_proposed).
 * 4. Topic relevance to query or task keywords.
 * 5. Category weights (constraints and confirmed facts weighted above general summaries).
 * 6. Hard context-length ceiling (default 4000 characters).
 */

export interface RetrieveMemoriesOptions {
  projectId: string;
  query?: string;
  targetCategory?: string;
  maxBudgetChars?: number;
}

export function retrieveRelevantMemories(
  memories: ProjectMemory[],
  options: RetrieveMemoriesOptions
): AssembledMemoryContext {
  const { projectId, query, targetCategory, maxBudgetChars = 4000 } = options;

  // Strict project boundary isolation & exclude non-active
  const scopedActive = memories.filter(
    (m) => m.projectId === projectId && m.status === "active" && m.verificationState !== "rejected"
  );

  const queryTokens = query ? extractTokens(query) : [];

  const scored: MemoryRetrievalResult[] = scopedActive.map((mem) => {
    let score = 50; // base score
    const reasons: string[] = [];

    // Verification boost
    if (mem.verificationState === "user_confirmed") {
      score += 30;
      reasons.push("User verified fact/decision");
    } else if (mem.verificationState === "ai_proposed") {
      score += 10;
      reasons.push("AI proposal (unverified)");
    }

    // Category weighting
    if (mem.type === "constraint" || mem.type === "requirement") {
      score += 25;
      reasons.push("High-impact constraint/requirement");
    } else if (mem.type === "decision") {
      score += 20;
      reasons.push("Architectural decision");
    } else if (mem.type === "risk") {
      score += 15;
      reasons.push("Known project risk");
    }

    // Target category match
    if (targetCategory && mem.type === targetCategory) {
      score += 30;
      reasons.push(`Direct category match: ${targetCategory}`);
    }

    // Query keyword match
    if (queryTokens.length > 0) {
      const memTokens = extractTokens(mem.title + " " + mem.content + " " + (mem.tags || []).join(" "));
      const overlap = queryTokens.filter((t) => memTokens.includes(t));
      if (overlap.length > 0) {
        score += overlap.length * 15;
        reasons.push(`Matched query keywords: [${overlap.join(", ")}]`);
      }
    }

    return {
      memory: mem,
      relevanceScore: score,
      retrievalReason: reasons.join("; ") || "General active project memory",
    };
  });

  // Sort descending by relevance score
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Budget packing
  let currentChars = 0;
  const selected: MemoryRetrievalResult[] = [];
  const lines: string[] = [];

  for (const item of scored) {
    const memoryLine = `[${item.memory.type.toUpperCase()}] ${item.memory.title}: ${item.memory.content}${
      item.memory.rationale ? ` (Rationale: ${item.memory.rationale})` : ""
    }`;

    const additionalLength = memoryLine.length + 1; // newline
    if (currentChars + additionalLength <= maxBudgetChars) {
      currentChars += additionalLength;
      selected.push(item);
      lines.push(memoryLine);
    } else {
      break;
    }
  }

  const omittedCount = scored.length - selected.length;
  const isTruncated = omittedCount > 0;

  if (isTruncated) {
    lines.push(`...[Context truncated: ${omittedCount} active project memories omitted for size limit]`);
  }

  return {
    projectId,
    contextText: lines.join("\n"),
    selectedMemories: selected,
    omittedCount,
    totalAvailable: scopedActive.length,
    budgetUsedChars: currentChars,
    maxBudgetChars,
    isTruncated,
  };
}

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
