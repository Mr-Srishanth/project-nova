import { ProjectIdea, StudentProfile, NoveltyReport } from '../../types/domain';

export class IdeaEvolutionEngine {
  public static evolveIdea(
    original: ProjectIdea,
    student: StudentProfile,
    noveltyReport: NoveltyReport
  ): ProjectIdea {
    const topSimilar = noveltyReport.topSimilarProjects[0];
    const topMatchTitle = topSimilar ? topSimilar.sourceTitle : 'standard baseline';
    const chosenDiff = noveltyReport.differentiationOpportunities[0] || 'on-device zero-knowledge edge verification';

    const evolvedTitle = `${original.title} (Adaptive Evolved)`;
    const evolvedTagline = `Differentiated from ${topMatchTitle.split(':')[0]} via ${chosenDiff.toLowerCase()}.`;

    const evolvedProblem = `${original.problemStatement} Existing implementations like ${topMatchTitle} typically rely on centralized batch servers or unverified assumptions, failing students requiring ${student.preferredDomain || 'applied high-trust reliability'}.`;

    const evolvedSolution = `${original.proposedSolution} ProjectNova Adaptive Evolution enhances this by integrating: 1) ${chosenDiff}, 2) localized differential privacy guarantees, and 3) automated edge-device failover designed for ${student.budgetConstraint}.`;

    const evolvedStack = {
      ...original.suggestedStack,
      aiOrSpecialized: `${original.suggestedStack.aiOrSpecialized} + Edge ONNX / WASM Quantization`,
      backend: `${original.suggestedStack.backend} (Async Event-Driven Stream)`,
    };

    return {
      ...original,
      id: `${original.id}-evolved-${Date.now().toString().slice(-4)}`,
      title: evolvedTitle,
      tagline: evolvedTagline,
      problemStatement: evolvedProblem,
      proposedSolution: evolvedSolution,
      suggestedStack: evolvedStack,
      measurableObjectives: [
        ...original.measurableObjectives,
        `Demonstrate latency improvement over baseline (${topMatchTitle.slice(0, 20)}) under constrained bandwidth`,
        `Validate ${chosenDiff.slice(0, 35)} with reproducible statistical benchmark tests`
      ],
      isEvolved: true,
      parentIdeaId: original.id,
      evolutionSummary: `Evolved specifically to counter common patterns found in ${topMatchTitle}. Introduced ${chosenDiff} to boost technical novelty from ${noveltyReport.overallNoveltyScore}% to an estimated 88%+ while honoring ${student.timeAvailability}.`,
    };
  }
}
