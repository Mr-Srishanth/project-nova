import { StudentProfile, ProjectIdea, SkillGapReport, SkillGapItem, ExistingProjectSource, NoveltyReport, SimilarityEvidence, FeasibilityAssessment, RecommendationBreakdown, ProjectBlueprint, RoadmapMilestone, EvaluationComparison } from '../../types/domain';

const TECH_KNOWLEDGE_BASE: Record<string, { category: SkillGapItem['category']; requiredLevel: SkillGapItem['requiredLevel']; learningHours: number; resource: string }> = {
  'PyTorch': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 25, resource: 'PyTorch Deep Learning with Python (Official Docs)' },
  'TensorFlow': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 25, resource: 'TensorFlow Developer Certificate Course' },
  'FastAPI': { category: 'Core Framework', requiredLevel: 'Foundational', learningHours: 10, resource: 'FastAPI Interactive Tutorial by Sebastián Ramírez' },
  'Docker': { category: 'DevOps/Tooling', requiredLevel: 'Foundational', learningHours: 8, resource: 'Docker for Developers Hands-on Handbook' },
  'Kubernetes': { category: 'DevOps/Tooling', requiredLevel: 'Advanced', learningHours: 35, resource: 'Kubernetes Up & Running (O\'Reilly)' },
  'React': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 20, resource: 'React.dev Official Interactive Walkthrough' },
  'TypeScript': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 15, resource: 'TypeScript in 50 Lessons by Stefan Baumgartner' },
  'PostgreSQL': { category: 'Core Framework', requiredLevel: 'Foundational', learningHours: 12, resource: 'The Art of PostgreSQL' },
  'WebAssembly': { category: 'Core Framework', requiredLevel: 'Advanced', learningHours: 30, resource: 'MDN WebAssembly Concepts & Rust Bindgen' },
  'WebSockets': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 10, resource: 'Real-Time Web Apps with WebSockets' },
  'BioBERT / Clinical NLP': { category: 'Domain Knowledge', requiredLevel: 'Advanced', learningHours: 30, resource: 'HuggingFace NLP Course: Domain Adaptation' },
  'Federated Learning (PySyft/Flower)': { category: 'Domain Knowledge', requiredLevel: 'Advanced', learningHours: 40, resource: 'Flower.dev Federated Learning Tutorial' },
  'Edge Audio / TFLite': { category: 'Domain Knowledge', requiredLevel: 'Intermediate', learningHours: 20, resource: 'TinyML: Machine Learning on Microcontrollers' },
  'D3.js / Canvas': { category: 'Core Framework', requiredLevel: 'Intermediate', learningHours: 18, resource: 'Interactive Data Visualization for the Web' },
};

export class SkillGapEngine {
  public static analyzeGap(student: StudentProfile, project: ProjectIdea): SkillGapReport {
    const studentSkillSet = new Set<string>(student.existingSkills.map((s: string) => s.toLowerCase().trim()));
    
    const requiredSkills: string[] = [
      ...project.prerequisites,
      project.suggestedStack.frontend,
      project.suggestedStack.backend,
      project.suggestedStack.database,
      project.suggestedStack.aiOrSpecialized
    ].filter((s: string) => s && s !== 'None' && s !== 'N/A');

    const uniqueRequired = Array.from(new Set(requiredSkills));

    const matchedSkills: string[] = [];
    const missingSkills: SkillGapItem[] = [];
    let totalLearningHours = 0;

    for (const req of uniqueRequired) {
      const isMatched = Array.from(studentSkillSet).some((skill: string) => 
        req.toLowerCase().includes(skill) || skill.includes(req.toLowerCase())
      );

      if (isMatched) {
        matchedSkills.push(req);
      } else {
        const kbEntry = TECH_KNOWLEDGE_BASE[req] || {
          category: 'Core Framework',
          requiredLevel: 'Foundational',
          learningHours: 12,
          resource: `Official Documentation & Getting Started for ${req}`
        };

        const difficulty: SkillGapItem['learningDifficulty'] = 
          kbEntry.learningHours > 25 ? 'High' : kbEntry.learningHours > 12 ? 'Medium' : 'Low';

        missingSkills.push({
          skill: req,
          category: kbEntry.category,
          requiredLevel: kbEntry.requiredLevel,
          studentHas: false,
          learningDifficulty: difficulty,
          estimatedLearningHours: kbEntry.learningHours,
          recommendedResource: kbEntry.resource,
        });

        totalLearningHours += kbEntry.learningHours;
      }
    }

    const overlapScore = uniqueRequired.length > 0
      ? Number((matchedSkills.length / uniqueRequired.length).toFixed(2))
      : 1.0;

    const hoursPerWeek = student.timeAvailability.includes('Part-Time') ? 8 :
      student.timeAvailability.includes('Standard') ? 15 :
      student.timeAvailability.includes('Intensive') ? 28 : 35;

    const totalLearningCurveWeeks = Math.max(1, Math.ceil(totalLearningHours / hoursPerWeek));

    let gapSummary = '';
    if (overlapScore >= 0.8) {
      gapSummary = `Exceptional skill synergy (${Math.round(overlapScore * 100)}% match). Ready to build core architecture immediately with minimal upfront ramp-up.`;
    } else if (overlapScore >= 0.5) {
      gapSummary = `Moderate skill alignment (${Math.round(overlapScore * 100)}% match). Requires approximately ${totalLearningHours} hours (${totalLearningCurveWeeks} weeks) of targeted ramp-up in ${missingSkills.slice(0, 2).map((m: any) => m.skill).join(', ')}.`;
    } else {
      gapSummary = `High learning curve (${Math.round(overlapScore * 100)}% match). Substantial prerequisite acquisition needed in ${missingSkills.map((m: any) => m.skill).join(', ')} before initiating core deliverables.`;
    }

    return {
      projectId: project.id,
      studentId: student.id,
      overlapScore,
      matchedSkills,
      missingSkills,
      totalLearningCurveWeeks,
      gapSummary,
    };
  }
}
