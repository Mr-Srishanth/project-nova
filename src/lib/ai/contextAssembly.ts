import type { Project } from "@/types/project";
import type { ProjectMemory } from "@/types/memory";

export interface ProjectContextSummary {
  projectId: string;
  projectName: string;
  category: string;
  objective: string;
  description: string;
  technologies: string[];
  constraints?: string;
  confirmedFacts: string[];
  architecturalDecisions: string[];
  technicalConstraints: string[];
  knownRisks: string[];
  openQuestions: string[];
  blueprintSummary?: string;
  milestonesOverview?: string[];
}

export function assembleProjectContext(
  project: Project,
  memories: ProjectMemory[],
  maxChars = 4000
): { text: string; summary: ProjectContextSummary } {
  // Ensure strict project isolation & active status: only process active non-superseded memories matching project ID
  const scopedMemories = memories.filter(
    (m) => m.projectId === project.id && (m.status === undefined || m.status === "active") && m.verificationState !== "rejected"
  );

  const confirmedFacts = scopedMemories
    .filter((m) => m.type === "fact")
    .map((m) => `${m.title}: ${m.content}`);

  const architecturalDecisions = scopedMemories
    .filter((m) => m.type === "decision")
    .map((m) => `${m.title}: ${m.content}`);

  const technicalConstraints = scopedMemories
    .filter((m) => m.type === "constraint")
    .map((m) => `${m.title}: ${m.content}`);

  const knownRisks = scopedMemories
    .filter((m) => m.type === "risk")
    .map((m) => `${m.title}: ${m.content}`);

  const openQuestions = scopedMemories
    .filter((m) => m.type === "open_question")
    .map((m) => `${m.title}: ${m.content}`);

  const milestoneNotes = project.milestones.map(
    (m) => `${m.phase} (${m.tasks.filter((t) => t.status === "done").length}/${m.tasks.length} tasks done)`
  );

  const summary: ProjectContextSummary = {
    projectId: project.id,
    projectName: project.name,
    category: project.category,
    objective: project.objective,
    description: project.description,
    technologies: project.technologies,
    constraints: project.constraints,
    confirmedFacts,
    architecturalDecisions,
    technicalConstraints,
    knownRisks,
    openQuestions,
    blueprintSummary: project.blueprint
      ? `${project.blueprint.overview} (MVP Features: ${project.blueprint.features.mvp.length}, DB Entities: ${project.blueprint.database.entities.length})`
      : undefined,
    milestonesOverview: milestoneNotes.length > 0 ? milestoneNotes : undefined,
  };

  // Build formatted context prompt
  const parts: string[] = [
    `=== PROJECT CONTEXT: ${project.name} ===`,
    `ID: ${project.id}`,
    `Category: ${project.category}`,
    `Objective: ${project.objective}`,
  ];

  if (project.description) {
    parts.push(`Description: ${project.description}`);
  }

  if (project.technologies.length > 0) {
    parts.push(`Target Technologies: ${project.technologies.join(", ")}`);
  }

  if (project.constraints) {
    parts.push(`Explicit Constraints: ${project.constraints}`);
  }

  if (architecturalDecisions.length > 0) {
    parts.push(`\n[ARCHITECTURAL DECISIONS]:\n${architecturalDecisions.map((d) => `- ${d}`).join("\n")}`);
  }

  if (technicalConstraints.length > 0) {
    parts.push(`\n[TECHNICAL CONSTRAINTS]:\n${technicalConstraints.map((c) => `- ${c}`).join("\n")}`);
  }

  if (confirmedFacts.length > 0) {
    parts.push(`\n[CONFIRMED FACTS]:\n${confirmedFacts.map((f) => `- ${f}`).join("\n")}`);
  }

  if (knownRisks.length > 0) {
    parts.push(`\n[KNOWN RISKS]:\n${knownRisks.map((r) => `- ${r}`).join("\n")}`);
  }

  if (summary.blueprintSummary) {
    parts.push(`\n[CURRENT BLUEPRINT]:\n${summary.blueprintSummary}`);
  }

  let fullText = parts.join("\n");
  if (fullText.length > maxChars) {
    fullText = fullText.slice(0, maxChars) + "\n...[Context truncated for size limit]";
  }

  return { text: fullText, summary };
}
