import { StudentProfile, ProjectIdea, FeasibilityAssessment } from '../../types/domain';

export class FeasibilityEngine {
  public static assess(project: ProjectIdea, student: StudentProfile): FeasibilityAssessment {
    let complexityScore = 50; // out of 100
    if (project.complexity === 'Beginner') complexityScore = 20;
    else if (project.complexity === 'Intermediate') complexityScore = 50;
    else if (project.complexity === 'Advanced') complexityScore = 75;
    else if (project.complexity === 'Industry/Research') complexityScore = 90;

    // Estimate total engineering hours needed
    const baseHours = project.estimatedWeeks * 14;

    // Student capacity in available weeks
    const availableWeeks = student.targetDeadlineWeeks;
    const weeklyHours = student.timeAvailability.includes('Part-Time') ? 10 :
      student.timeAvailability.includes('Standard') ? 16 :
      student.timeAvailability.includes('Intensive') ? 30 : 40;

    const totalAvailableHours = availableWeeks * weeklyHours;

    // Time risk evaluation
    let timeRisk: FeasibilityAssessment['timeRisk'] = 'Within Bounds';
    if (baseHours > totalAvailableHours * 1.2) {
      timeRisk = 'Likely Overrun';
    } else if (baseHours > totalAvailableHours * 0.85) {
      timeRisk = 'Tight Schedule';
    }

    // Cost evaluation
    let estimatedCostUSD = 0;
    if (project.estimatedCost.includes('$0') || project.estimatedCost.toLowerCase().includes('free')) {
      estimatedCostUSD = 0;
    } else {
      const match = project.estimatedCost.match(/\$?(\d+)/);
      estimatedCostUSD = match ? parseInt(match[1], 10) : 35;
    }

    let resourceRisk: FeasibilityAssessment['resourceRisk'] = 'Low';
    if (student.budgetConstraint.includes('Zero Budget') && estimatedCostUSD > 0) {
      resourceRisk = 'Critical';
    } else if (student.budgetConstraint.includes('Low') && estimatedCostUSD > 50) {
      resourceRisk = 'Medium';
    }

    // Calculate composite feasibility score (0 - 100)
    let rawScore = 100;
    if (timeRisk === 'Likely Overrun') rawScore -= 30;
    else if (timeRisk === 'Tight Schedule') rawScore -= 12;

    if (resourceRisk === 'Critical') rawScore -= 35;
    else if (resourceRisk === 'Medium') rawScore -= 15;

    if (complexityScore > 70 && student.academicLevel === 'Undergraduate') {
      rawScore -= 15;
    }

    const feasibilityScore = Math.max(15, Math.min(98, rawScore));

    const mitigations = [
      {
        risk: 'Scope inflation during initial architectural design',
        mitigation: 'Strictly decouple core MVP verification milestones from extended exploratory features.'
      },
      {
        risk: 'Cloud hosting / API rate limit exhaustion',
        mitigation: 'Implement local offline mocked fixtures or utilize self-hosted Dockerized containers.'
      },
      {
        risk: 'Steep framework prerequisite onboarding',
        mitigation: 'Follow Phase 1 of the Personalized Roadmap before writing production schema.'
      }
    ];

    let verdict: FeasibilityAssessment['verdict'] = 'Feasible with Scoping';
    if (feasibilityScore >= 75) verdict = 'Highly Feasible';
    else if (feasibilityScore < 50) verdict = 'High Risk';

    return {
      feasibilityScore,
      complexityLevel: project.complexity === 'Beginner' ? 'Low' :
        project.complexity === 'Intermediate' ? 'Moderate' :
        project.complexity === 'Advanced' ? 'High' : 'Extreme',
      estimatedHours: baseHours,
      estimatedCostUSD,
      resourceRisk,
      timeRisk,
      technicalDependencies: [
        project.suggestedStack.frontend,
        project.suggestedStack.backend,
        project.suggestedStack.database,
        project.suggestedStack.aiOrSpecialized
      ].filter(t => t && t !== 'None'),
      riskMitigations: mitigations,
      verdict,
    };
  }
}
