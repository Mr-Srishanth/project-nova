/**
 * Target Project Environment & Provider Integration Configuration Storage
 *
 * Persists user-defined target-project environment configuration separately
 * from ProjectNova's own runtime credentials.
 */

export type TargetProjectVarStatus = "MISSING" | "EXAMPLE ONLY" | "CONFIGURED" | "VERIFIED";

export interface TargetProjectEnvVarConfig {
  value: string;
  status: TargetProjectVarStatus;
  updatedAt: string;
}

export interface TargetProjectEnvSettings {
  projectId: string;
  enabledProviders: {
    supabase: boolean;
    gemini: boolean;
  };
  variables: Record<string, TargetProjectEnvVarConfig>;
  updatedAt: string;
}

const STORAGE_PREFIX = "projectnova_target_project_env_";

export const targetProjectEnvStorage = {
  get(projectId: string): TargetProjectEnvSettings {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
      if (!data) {
        return {
          projectId,
          enabledProviders: { supabase: false, gemini: false },
          variables: {},
          updatedAt: new Date().toISOString(),
        };
      }
      return JSON.parse(data);
    } catch {
      return {
        projectId,
        enabledProviders: { supabase: false, gemini: false },
        variables: {},
        updatedAt: new Date().toISOString(),
      };
    }
  },

  save(settings: TargetProjectEnvSettings): TargetProjectEnvSettings {
    const updated = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${settings.projectId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("[TargetProjectEnvStorage] Unable to save settings to localStorage:", e);
    }
    return updated;
  },

  setVariable(
    projectId: string,
    varName: string,
    value: string,
    status: TargetProjectVarStatus = "CONFIGURED"
  ): TargetProjectEnvSettings {
    const current = this.get(projectId);
    current.variables[varName] = {
      value,
      status,
      updatedAt: new Date().toISOString(),
    };
    return this.save(current);
  },

  clearVariable(projectId: string, varName: string): TargetProjectEnvSettings {
    const current = this.get(projectId);
    delete current.variables[varName];
    return this.save(current);
  },

  clearAll(projectId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
    } catch (e) {
      console.warn("[TargetProjectEnvStorage] Unable to delete settings:", e);
    }
  },
};
