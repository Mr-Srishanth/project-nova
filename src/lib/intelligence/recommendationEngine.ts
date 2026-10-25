import { StudentProfile, ProjectIdea, RecommendationBreakdown } from '../../types/domain';
import { SkillGapEngine } from './skillGapEngine';
import { FeasibilityEngine } from './feasibilityEngine';
import { NoveltyEngine } from './noveltyEngine';
import { RESEARCH_AND_OPEN_SOURCE_CORPUS } from '../../data/corpus';

export class RecommendationEngine {
  public static scoreProject(project: ProjectIdea, student: StudentProfile): RecommendationBreakdown {
    const gapReport = SkillGapEngine.analyzeGap(student, project);
    const skillFitScore = Math.round(gapReport.overlapScore * 100);

    const projectText = `${project.title} ${project.domain} ${project.problemStatement} ${project.tagline}`.toLowerCase();
    let interestHits = 0;
    const matchedInterests: string[] = [];

    for (const interest of student.primaryInterests) {
      const kw = interest.toLowerCase();
      if (projectText.includes(kw) || kw.split(' ').some((w: string) => w.length > 3 && projectText.includes(w))) {
        interestHits++;
        matchedInterests.push(interest);
      }
    }

    const interestAlignmentScore = student.primaryInterests.length > 0
      ? Math.min(100, Math.round((interestHits / student.primaryInterests.length) * 80 + (matchedInterests.length > 0 ? 20 : 0)))
      : 50;

    const feasibilityReport = FeasibilityEngine.assess(project, student);
    const feasibilityScore = feasibilityReport.feasibilityScore;

    let learningValueScore = 70;
    if (gapReport.overlapScore >= 0.4 && gapReport.overlapScore <= 0.75) {
      learningValueScore = 95;
    } else if (gapReport.overlapScore > 0.85) {
      learningValueScore = 60;
    } else if (gapReport.overlapScore < 0.2) {
      learningValueScore = 45;
    }

    const noveltyReport = NoveltyEngine.evaluateNovelty(project, RESEARCH_AND_OPEN_SOURCE_CORPUS);
    const noveltyScore = noveltyReport.overallNoveltyScore;

    const finalWeightedScore = Number((
      (skillFitScore * 0.25) +
      (interestAlignmentScore * 0.25) +
      (feasibilityScore * 0.20) +
      (learningValueScore * 0.15) +
      (noveltyScore * 0.15)
    ).toFixed(1));

    const reasoning: string[] = [
      `Skill Fit: ${skillFitScore}% baseline overlap with ${gapReport.matchedSkills.length} mastered tools (${gapReport.matchedSkills.slice(0, 3).join(', ')}).`,
      `Interest Alignment: Matches ${matchedInterests.length} target career interests (${matchedInterests.join(', ') || 'General domain match'}).`,
      `Feasibility: Scored ${feasibilityScore}/100. ${feasibilityReport.verdict} within student's ${student.targetDeadlineWeeks}-week target window.`,
      `Learning Value: Scored ${learningValueScore}/100. Provides structured exposure to ${gapReport.missingSkills.length} new technologies without impossible friction.`,
      `Novelty: Scored ${noveltyScore}/100 (${noveltyReport.noveltyVerdict}) compared against IEEE/GitHub corpus.`
    ];

    const pros: string[] = [];
    const cons: string[] = [];

    if (skillFitScore >= 70) pros.push(`Strong technology foundation in ${gapReport.matchedSkills.slice(0, 2).join(' & ')}.`);
    else cons.push(`Requires upfront onboarding in ${gapReport.missingSkills.slice(0, 2).map((m: any) => m.skill).join(' & ')}.`);

    if (feasibilityScore >= 75) pros.push(`Realistic timeline fitting comfortably inside ${student.targetDeadlineWeeks} weeks.`);
    else cons.push(`Tight schedule; scope control is critical to avoid timeline slippage.`);

    if (noveltyScore >= 70) pros.push(`Distinct architectural angle that stands out in portfolios or research submissions.`);
    else cons.push(`Shares common patterns with known open-source tools; needs differentiated features.`);

    return {
      skillFitScore,
      interestAlignmentScore,
      feasibilityScore,
      learningValueScore,
      noveltyScore,
      finalWeightedScore,
      reasoning,
      pros,
      cons,
    };
  }

  public static rankProjects(projects: ProjectIdea[], student: StudentProfile): { project: ProjectIdea; score: RecommendationBreakdown }[] {
    const scored = projects.map(project => ({
      project,
      score: this.scoreProject(project, student)
    }));

    return scored.sort((a, b) => b.score.finalWeightedScore - a.score.finalWeightedScore);
  }

  public static evaluateAgainstBaselines(project: ProjectIdea, student: StudentProfile) {
    const projectNovaBreakdown = this.scoreProject(project, student);

    const studentWords = new Set<string>([...student.existingSkills, ...student.primaryInterests].map(s => s.toLowerCase()));
    const projWords = project.title.toLowerCase().split(/\s+/);
    let matchedKw = 0;
    for (const w of projWords) {
      if (studentWords.has(w)) matchedKw++;
    }
    const baselineKeywordScore = Math.min(85, Math.max(30, matchedKw * 25));

    const pseudoRandom = Math.abs(Math.sin(project.id.length * 42)) * 50 + 20;
    const baselineRandomScore = Math.round(pseudoRandom);

    return {
      projectTitle: project.title,
      projectNovaScore: projectNovaBreakdown.finalWeightedScore,
      baselineRandomScore,
      baselineKeywordScore,
      skillAlignmentDelta: Number((projectNovaBreakdown.skillFitScore - baselineKeywordScore).toFixed(1)),
      noveltyDelta: Number((projectNovaBreakdown.noveltyScore - 40).toFixed(1)),
    };
  }
}
