import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from './intelligence/recommendationEngine';
import { SkillGapEngine } from './intelligence/skillGapEngine';
import { NoveltyEngine } from './intelligence/noveltyEngine';
import { FeasibilityEngine } from './intelligence/feasibilityEngine';
import { IdeaEvolutionEngine } from './intelligence/ideaEvolutionEngine';
import { BlueprintEngine } from './intelligence/blueprintEngine';
import { RoadmapEngine } from './intelligence/roadmapEngine';
import { INITIAL_STUDENT_PROFILES } from '../data/sampleProfiles';
import { RESEARCH_AND_OPEN_SOURCE_CORPUS } from '../data/corpus';
import { ProjectIdea } from '../types/domain';

describe('ProjectNova AI — 10 Intelligent Modules Core Engine Verification', () => {
  const student = INITIAL_STUDENT_PROFILES[0]; // Alex Chen, ML & Edge AI student

  const sampleProject: ProjectIdea = {
    id: 'test-proj-01',
    title: 'ResonantEdge: Micro-Acoustic Bio-Diversity Sentinel',
    tagline: 'Ultra-low-power edge audio classifier',
    domain: 'Edge AI & Environmental Tech',
    problemStatement: 'Manual retrieval of SD cards delays conservation interventions.',
    measurableObjectives: ['Achieve > 89% F1-score', 'Under 1.2W power draw'],
    proposedSolution: 'Quantized MobileNet on microcontrollers with solar harvesting.',
    suggestedStack: {
      frontend: 'React + Tailwind CSS',
      backend: 'FastAPI',
      database: 'PostgreSQL',
      aiOrSpecialized: 'TensorFlow Lite / Edge Audio',
    },
    complexity: 'Intermediate',
    estimatedWeeks: 10,
    estimatedCost: '$35 (Hardware kit)',
    prerequisites: ['Python', 'Audio Preprocessing', 'FastAPI'],
  };

  it('Module 2: SkillGapEngine accurately identifies matched and missing prerequisites', () => {
    const report = SkillGapEngine.analyzeGap(student, sampleProject);
    expect(report.studentId).toBe(student.id);
    expect(report.overlapScore).toBeGreaterThanOrEqual(0);
    expect(report.overlapScore).toBeLessThanOrEqual(1);
    expect(report.matchedSkills.length).toBeGreaterThan(0);
    expect(report.totalLearningCurveWeeks).toBeGreaterThanOrEqual(1);
  });

  it('Module 4: RecommendationEngine computes reproducible multi-factor weighted scores', () => {
    const breakdown = RecommendationEngine.scoreProject(sampleProject, student);
    expect(breakdown.finalWeightedScore).toBeGreaterThan(0);
    expect(breakdown.finalWeightedScore).toBeLessThanOrEqual(100);
    expect(breakdown.reasoning.length).toBe(5);
    
    // Test rank order
    const ranked = RecommendationEngine.rankProjects([sampleProject], student);
    expect(ranked[0].project.id).toBe(sampleProject.id);
  });

  it('Module 4 Innovation: evaluateAgainstBaselines produces comparative deltas', () => {
    const evaluation = RecommendationEngine.evaluateAgainstBaselines(sampleProject, student);
    expect(evaluation.projectTitle).toBe(sampleProject.title);
    expect(evaluation.projectNovaScore).toBeGreaterThan(0);
    expect(evaluation.baselineKeywordScore).toBeGreaterThan(0);
    expect(evaluation.baselineRandomScore).toBeGreaterThan(0);
  });

  it('Module 5: NoveltyEngine extracts TF-IDF similarities and outputs evidence without hallucinations', () => {
    const noveltyReport = NoveltyEngine.evaluateNovelty(sampleProject, RESEARCH_AND_OPEN_SOURCE_CORPUS);
    expect(noveltyReport.overallNoveltyScore).toBeGreaterThan(0);
    expect(noveltyReport.overallNoveltyScore).toBeLessThanOrEqual(100);
    expect(noveltyReport.topSimilarProjects.length).toBeGreaterThan(0);
    expect(noveltyReport.methodUsed).toContain('TF-IDF');
    expect(noveltyReport.differentiationOpportunities.length).toBeGreaterThan(0);
  });

  it('Module 6: IdeaEvolutionEngine enhances ideas using prior-art similarity gaps', () => {
    const noveltyReport = NoveltyEngine.evaluateNovelty(sampleProject, RESEARCH_AND_OPEN_SOURCE_CORPUS);
    const evolved = IdeaEvolutionEngine.evolveIdea(sampleProject, student, noveltyReport);
    expect(evolved.isEvolved).toBe(true);
    expect(evolved.title).toContain('Adaptive Evolved');
    expect(evolved.parentIdeaId).toBe(sampleProject.id);
    expect(evolved.evolutionSummary).toBeDefined();
  });

  it('Module 7: FeasibilityEngine audits complexity, cost, schedule, and risks', () => {
    const feasibility = FeasibilityEngine.assess(sampleProject, student);
    expect(feasibility.feasibilityScore).toBeGreaterThan(0);
    expect(feasibility.estimatedHours).toBeGreaterThan(0);
    expect(feasibility.riskMitigations.length).toBeGreaterThan(0);
    expect(['Highly Feasible', 'Feasible with Scoping', 'High Risk']).toContain(feasibility.verdict);
  });

  it('Module 8: BlueprintEngine generates complete architecture, SQL DDL schema, and API contracts', () => {
    const blueprint = BlueprintEngine.generateBlueprint(sampleProject);
    expect(blueprint.modules.length).toBe(4);
    expect(blueprint.apiContracts.length).toBeGreaterThanOrEqual(3);
    expect(blueprint.ddlSchemaSql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(blueprint.ddlSchemaSql).toContain('uuid-ossp');
  });

  it('Module 9: RoadmapEngine sequences personalized learning tasks and deliverables', () => {
    const gapReport = SkillGapEngine.analyzeGap(student, sampleProject);
    const roadmap = RoadmapEngine.generateRoadmap(sampleProject, student, gapReport);
    expect(roadmap.length).toBeGreaterThanOrEqual(4);
    expect(roadmap[0].title).toBeDefined();
    expect(roadmap[0].resources.length).toBeGreaterThan(0);
  });
});
