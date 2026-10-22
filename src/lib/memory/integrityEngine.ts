import type { ProjectMemory, MemoryIntegrityFinding } from "@/types/memory";
import { generateId } from "@/lib/utils";

/**
 * Knowledge Integrity Engine
 * Deterministically analyzes a project's memory ledger to detect:
 * 1. Conflicting active decisions on the same subject.
 * 2. Directly contradictory constraints/requirements.
 * 3. Stale references to non-existent or deleted artifacts.
 * 4. Open questions already addressed by verified facts or decisions.
 * 5. Near-duplicate memory candidates.
 */

export function detectMemoryIntegrityFindings(
  memories: ProjectMemory[],
  options?: {
    knownArtifactPaths?: string[];
  }
): MemoryIntegrityFinding[] {
  const findings: MemoryIntegrityFinding[] = [];
  const now = new Date().toISOString();

  // Filter only active memories for conflict detection
  const activeMemories = memories.filter((m) => m.status === "active");

  // 1. Detect conflicting decisions
  const activeDecisions = activeMemories.filter((m) => m.type === "decision");
  for (let i = 0; i < activeDecisions.length; i++) {
    for (let j = i + 1; j < activeDecisions.length; j++) {
      const d1 = activeDecisions[i];
      const d2 = activeDecisions[j];

      // Extract significant tokens from titles
      const tokens1 = extractKeywords(d1.title);
      const tokens2 = extractKeywords(d2.title);
      const overlap = tokens1.filter((t) => tokens2.includes(t));

      if (overlap.length >= 2 || (overlap.length >= 1 && tokens1.length <= 2 && tokens2.length <= 2)) {
        // High semantic topic overlap between two active decisions
        if (d1.content.toLowerCase().trim() !== d2.content.toLowerCase().trim()) {
          findings.push({
            id: generateId("find"),
            projectId: d1.projectId,
            findingType: "conflicting_decision",
            severity: "high",
            title: `Conflicting Active Decisions: "${d1.title}" vs "${d2.title}"`,
            explanation: `Multiple active decisions share topic keywords [${overlap.join(", ")}]. Having concurrent conflicting decisions creates architectural ambiguity.`,
            affectedMemoryIds: [d1.id, d2.id],
            suggestedAction: `Review both decisions and supersede or archive the outdated one.`,
            detectedAt: now,
          });
        }
      }
    }
  }

  // 2. Detect conflicting constraints or requirements
  const constraintsAndReqs = activeMemories.filter(
    (m) => m.type === "constraint" || m.type === "requirement"
  );
  for (let i = 0; i < constraintsAndReqs.length; i++) {
    for (let j = i + 1; j < constraintsAndReqs.length; j++) {
      const c1 = constraintsAndReqs[i];
      const c2 = constraintsAndReqs[j];

      const tokens1 = extractKeywords(c1.title);
      const tokens2 = extractKeywords(c2.title);
      const overlap = tokens1.filter((t) => tokens2.includes(t));

      // Opposing assertions
      const hasNegationConflict =
        (c1.content.toLowerCase().includes("no ") || c1.content.toLowerCase().includes("never ") || c1.content.toLowerCase().includes("disallow")) &&
        (c2.content.toLowerCase().includes("must ") || c2.content.toLowerCase().includes("always ") || c2.content.toLowerCase().includes("allow"));

      if (overlap.length >= 2 && hasNegationConflict) {
        findings.push({
          id: generateId("find"),
          projectId: c1.projectId,
          findingType: "conflicting_constraint",
          severity: "high",
          title: `Contradictory Constraints: "${c1.title}" vs "${c2.title}"`,
          explanation: `Contradictory requirements identified on overlapping topic [${overlap.join(", ")}].`,
          affectedMemoryIds: [c1.id, c2.id],
          suggestedAction: `Clarify with stakeholder and update or resolve the conflicting constraint.`,
          detectedAt: now,
        });
      }
    }
  }

  // 3. Stale references to artifacts
  if (options?.knownArtifactPaths) {
    const knownSet = new Set(options.knownArtifactPaths.map((p) => p.toLowerCase()));
    for (const mem of activeMemories) {
      if (mem.relatedEntityRef?.entityType === "artifact") {
        const refName = (mem.relatedEntityRef.name || mem.relatedEntityRef.entityId).toLowerCase();
        if (!knownSet.has(refName)) {
          findings.push({
            id: generateId("find"),
            projectId: mem.projectId,
            findingType: "stale_reference",
            severity: "medium",
            title: `Stale Artifact Reference in "${mem.title}"`,
            explanation: `Memory references artifact "${refName}" which is not present in the current project build artifacts.`,
            affectedMemoryIds: [mem.id],
            suggestedAction: `Update or remove the entity reference if the artifact was renamed or deleted.`,
            detectedAt: now,
          });
        }
      }
    }
  }

  // 4. Open questions already answered by verified facts
  const openQuestions = activeMemories.filter((m) => m.type === "open_question");
  const factsAndDecisions = activeMemories.filter(
    (m) => (m.type === "fact" || m.type === "decision") && m.verificationState === "user_confirmed"
  );

  for (const q of openQuestions) {
    const qTokens = extractKeywords(q.title + " " + q.content);
    for (const fd of factsAndDecisions) {
      const fdTokens = extractKeywords(fd.title + " " + fd.content);
      const overlap = qTokens.filter((t) => fdTokens.includes(t));
      if (overlap.length >= 3) {
        findings.push({
          id: generateId("find"),
          projectId: q.projectId,
          findingType: "answered_question",
          severity: "low",
          title: `Open Question Likely Resolved: "${q.title}"`,
          explanation: `Question shares significant context [${overlap.join(", ")}] with verified ${fd.type} "${fd.title}".`,
          affectedMemoryIds: [q.id, fd.id],
          suggestedAction: `Mark question as resolved if "${fd.title}" provides the definitive answer.`,
          detectedAt: now,
        });
      }
    }
  }

  // 5. Near-duplicate memory candidates
  for (let i = 0; i < activeMemories.length; i++) {
    for (let j = i + 1; j < activeMemories.length; j++) {
      const m1 = activeMemories[i];
      const m2 = activeMemories[j];

      if (m1.type === m2.type && m1.title.toLowerCase().trim() === m2.title.toLowerCase().trim()) {
        findings.push({
          id: generateId("find"),
          projectId: m1.projectId,
          findingType: "duplicate_candidate",
          severity: "medium",
          title: `Duplicate Memory Candidate: "${m1.title}"`,
          explanation: `Two active memories of type "${m1.type}" share the identical title.`,
          affectedMemoryIds: [m1.id, m2.id],
          suggestedAction: `Consolidate information or archive the duplicate entry.`,
          detectedAt: now,
        });
      }
    }
  }

  return findings;
}

function extractKeywords(text: string): string[] {
  const STOPWORDS = new Set([
    "the", "and", "a", "an", "in", "on", "for", "with", "about", "to", "at",
    "by", "from", "of", "is", "are", "was", "were", "be", "this", "that", "it",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}
