import type { ReleaseRecord, ReadinessCheckResult } from "@/types/release";

export function formatReleaseNotesMarkdown(
  release: ReleaseRecord,
  readinessChecks: ReadinessCheckResult[]
): string {
  const checkSummary = readinessChecks
    .map((c) => `- [${c.state.toUpperCase()}] **${c.name}**: ${c.explanation}`)
    .join("\n");

  const notableChanges = release.notableChanges.length > 0
    ? release.notableChanges.map((c) => `- ${c}`).join("\n")
    : "- Initial release artifact generation and architecture setup.";

  const limitations = release.knownLimitations.length > 0
    ? release.knownLimitations.map((l) => `- ${l}`).join("\n")
    : "- None documented.";

  const prereq = release.deploymentPrerequisites;
  const buildCmds = prereq.buildCommands.map((b) => `  ${b}`).join("\n");
  const smokeChecks = prereq.postDeploymentSmokeChecks.map((s) => `- ${s}`).join("\n");

  const checklistItems = release.checklist
    .map((item) => `- [${item.completed ? "x" : " "}] ${item.label}`)
    .join("\n");

  return `# Release Notes: ${release.title} (${release.version})
**Status:** ${release.status.toUpperCase()}  
**Generated Date:** ${new Date(release.createdAt).toLocaleDateString()}  
${release.approvedAt ? `**Approved Date:** ${new Date(release.approvedAt).toLocaleDateString()} by ${release.approvedBy || "User"}\n` : ""}

## Summary
${release.summary || "No executive summary provided."}

---

## Notable Changes & Feature Highlights
${notableChanges}

---

## Release Readiness Verification Gate
${checkSummary}

---

## Deployment & Operational Guide
**Target Platform:** ${prereq.target || "Generic Node/Docker"}  
**Build Commands:**
\`\`\`bash
${buildCmds}
\`\`\`

${prereq.databaseMigrationStep ? `**Database Migrations:**\n\`\`\`bash\n  ${prereq.databaseMigrationStep}\n\`\`\`\n` : ""}
**Post-Deployment Smoke Checks:**
${smokeChecks}

**Rollback Plan:**
${prereq.rollbackPlan || "Standard container redeploy or Git commit reversion."}

---

## Release Approval Checklist
${checklistItems}

---

## Known Limitations & Follow-ups
${limitations}
`;
}
