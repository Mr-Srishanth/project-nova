import { StudentProfile, ProjectIdea, ProjectBlueprint, RoadmapMilestone, EvaluationComparison } from '../../types/domain';
import { INITIAL_STUDENT_PROFILES } from '../../data/sampleProfiles';

const STORAGE_KEYS = {
  CURRENT_STUDENT: 'projectnova_current_student',
  ALL_STUDENTS: 'projectnova_students',
  SAVED_PROJECTS: 'projectnova_saved_projects',
  PROJECT_BLUEPRINTS: 'projectnova_blueprints',
  PROJECT_ROADMAPS: 'projectnova_roadmaps',
  EVALUATIONS: 'projectnova_evaluations',
};

export class StorageService {
  public static getStudents(): StudentProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALL_STUDENTS);
      return data ? JSON.parse(data) : INITIAL_STUDENT_PROFILES;
    } catch {
      return INITIAL_STUDENT_PROFILES;
    }
  }

  public static saveStudent(student: StudentProfile): void {
    const list = this.getStudents();
    const idx = list.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      list[idx] = student;
    } else {
      list.push(student);
    }
    localStorage.setItem(STORAGE_KEYS.ALL_STUDENTS, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.CURRENT_STUDENT, JSON.stringify(student));
  }

  public static getCurrentStudent(): StudentProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_STUDENT);
      return data ? JSON.parse(data) : INITIAL_STUDENT_PROFILES[0];
    } catch {
      return INITIAL_STUDENT_PROFILES[0];
    }
  }

  public static setCurrentStudent(student: StudentProfile): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STUDENT, JSON.stringify(student));
  }

  public static getSavedProjects(): ProjectIdea[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveProject(project: ProjectIdea): void {
    const list = this.getSavedProjects();
    if (!list.some(p => p.id === project.id)) {
      list.push(project);
      localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(list));
    }
  }

  public static removeSavedProject(projectId: string): void {
    const list = this.getSavedProjects().filter(p => p.id !== projectId);
    localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(list));
  }

  public static getBlueprint(projectId: string): ProjectBlueprint | null {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT_BLUEPRINTS) || '{}');
      return all[projectId] || null;
    } catch {
      return null;
    }
  }

  public static saveBlueprint(blueprint: ProjectBlueprint): void {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT_BLUEPRINTS) || '{}');
    all[blueprint.projectIdeaId] = blueprint;
    localStorage.setItem(STORAGE_KEYS.PROJECT_BLUEPRINTS, JSON.stringify(all));
  }

  public static getRoadmap(projectId: string): RoadmapMilestone[] | null {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT_ROADMAPS) || '{}');
      return all[projectId] || null;
    } catch {
      return null;
    }
  }

  public static saveRoadmap(projectId: string, roadmap: RoadmapMilestone[]): void {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT_ROADMAPS) || '{}');
    all[projectId] = roadmap;
    localStorage.setItem(STORAGE_KEYS.PROJECT_ROADMAPS, JSON.stringify(all));
  }

  public static getEvaluations(): EvaluationComparison[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveEvaluation(evalItem: EvaluationComparison): void {
    const list = this.getEvaluations();
    const idx = list.findIndex(e => e.projectTitle === evalItem.projectTitle);
    if (idx >= 0) list[idx] = evalItem;
    else list.push(evalItem);
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(list));
  }
}
