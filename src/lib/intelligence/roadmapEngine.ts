import { ProjectIdea, StudentProfile, SkillGapReport, RoadmapMilestone } from '../../types/domain';

export class RoadmapEngine {
  public static generateRoadmap(
    project: ProjectIdea,
    student: StudentProfile,
    gapReport: SkillGapReport
  ): RoadmapMilestone[] {
    const milestones: RoadmapMilestone[] = [];
    let currentWeek = 1;

    // Phase 1: Prerequisite & Gap Bridging
    if (gapReport.missingSkills.length > 0) {
      milestones.push({
        id: `rm-${project.id}-w1`,
        weekNumber: currentWeek,
        title: `Skill Ramp-Up: ${gapReport.missingSkills.slice(0, 2).map((s: any) => s.skill).join(' & ')}`,
        type: 'Learning & Skill Acquisition',
        learningObjectives: gapReport.missingSkills.slice(0, 2).map((s: any) => `Master core fundamentals of ${s.skill} (${s.learningDifficulty} difficulty, ~${s.estimatedLearningHours}h study).`),
        implementationDeliverable: 'Build a standalone "Hello World" sandbox prototype executing basic data flows.',
        resources: gapReport.missingSkills.slice(0, 2).map((s: any) => ({
          name: s.skill,
          url: s.recommendedResource,
        })),
        verificationCriteria: 'Code runs locally with zero compiler or runtime errors.',
        status: 'in_progress',
      });
      currentWeek += gapReport.totalLearningCurveWeeks;
    }

    // Phase 2: Foundational Architecture & Schema Setup
    milestones.push({
      id: `rm-${project.id}-w2`,
      weekNumber: currentWeek,
      title: 'Repository Scaffolding & Database Schema Migration',
      type: 'Core Architecture',
      learningObjectives: [
        `Design relational entity diagrams for ${project.title}.`,
        'Configure Git workflow, environment variable isolation, and automated CI tests.'
      ],
      implementationDeliverable: 'Execute DDL migrations and write initial unit tests for data models.',
      resources: [
        { name: 'Database Schema Design Best Practices', url: 'https://martinfowler.com/articles/evodb.html' },
        { name: 'Environment Secrets Security Guidelines', url: 'https://12factor.net/config' }
      ],
      verificationCriteria: 'All migration scripts apply cleanly on a fresh database instance.',
      status: 'pending',
    });
    currentWeek += 2;

    // Phase 3: Core Algorithmic Pipeline & Feature Implementation
    milestones.push({
      id: `rm-${project.id}-w3`,
      weekNumber: currentWeek,
      title: `Implementation: ${project.measurableObjectives[0] || 'Core Processing Engine'}`,
      type: 'Feature Implementation',
      learningObjectives: [
        `Implement main processing algorithms using ${project.suggestedStack.aiOrSpecialized}.`,
        'Handle edge cases, malformed inputs, and asynchronous task scheduling.'
      ],
      implementationDeliverable: 'Working backend service endpoints serving predictions or transformations.',
      resources: [
        { name: 'FastAPI / Async Microservices Architecture', url: 'https://fastapi.tiangolo.com' },
        { name: 'High-Throughput Concurrency Patterns', url: 'https://docs.python.org/3/library/asyncio.html' }
      ],
      verificationCriteria: 'API passes automated test suite with deterministic test fixtures.',
      status: 'pending',
    });
    currentWeek += 3;

    // Phase 4: UI & Client Presentation
    milestones.push({
      id: `rm-${project.id}-w4`,
      weekNumber: currentWeek,
      title: 'Interactive Frontend Dashboard & Visual Feedback',
      type: 'Feature Implementation',
      learningObjectives: [
        `Connect client interface (${project.suggestedStack.frontend}) to backend REST/WebSocket APIs.`,
        'Implement responsive layouts, real-time status indicators, and state caching.'
      ],
      implementationDeliverable: 'Complete interactive user workflow demonstrating live project execution.',
      resources: [
        { name: 'Modern React Component Systems', url: 'https://react.dev' },
        { name: 'Tailwind Design System Tokens', url: 'https://tailwindcss.com' }
      ],
      verificationCriteria: 'Complete end-to-end user click path functional on desktop and mobile viewports.',
      status: 'pending',
    });
    currentWeek += 2;

    // Phase 5: Rigorous Evaluation & Benchmark Study
    milestones.push({
      id: `rm-${project.id}-w5`,
      weekNumber: currentWeek,
      title: 'Benchmarking, Ablation Study & Research Documentation',
      type: 'Evaluation & Polish',
      learningObjectives: [
        'Conduct reproducible evaluation against baseline methods.',
        'Document methodology, limitations, and reproducible runbook instructions.'
      ],
      implementationDeliverable: 'Final technical report, architecture presentation deck, and published repository.',
      resources: [
        { name: 'Writing Scientific & Technical Project Reports', url: 'https://ieee.org' },
        { name: 'Open Source Software Release Standards', url: 'https://opensource.guide' }
      ],
      verificationCriteria: 'Reproducible benchmark script outputs statistical comparison charts.',
      status: 'pending',
    });

    return milestones;
  }
}
