import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { Project } from "@/types/project";
import { projectStorage } from "@/lib/storage/projectStorage";
import { AUTH_CHANGED_EVENT } from "@/lib/supabase/auth";

export const ACTIVE_PROJECT_STORAGE_KEY = "projectnova_active_project_id_v1";

interface ActiveProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;
  setActiveProjectId: (id: string, syncUrl?: boolean) => void;
  updateActiveProject: (updates: Partial<Project>) => Promise<Project | null>;
  refreshProjects: () => Promise<Project[]>;
}

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined);

export const ActiveProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to persist selection safely
  const persistActiveProjectId = (id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("[ActiveProjectContext] Failed to save active project to localStorage:", e);
    }
  };

  // Helper to read persisted selection safely
  const getPersistedActiveProjectId = (): string | null => {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  };

  // Refresh projects from storage and reconcile active project
  const refreshProjects = useCallback(async (): Promise<Project[]> => {
    try {
      setError(null);
      const list = await projectStorage.list();
      setProjects(list);

      // Check URL param first (precedence: URL ?project= or ?projectId= -> localStorage -> list[0])
      const urlParam = searchParams.get("project") || searchParams.get("projectId");
      const persistedId = getPersistedActiveProjectId();

      if (urlParam && list.some((p) => p.id === urlParam)) {
        setActiveProjectIdState(urlParam);
        persistActiveProjectId(urlParam);
      } else if (persistedId && list.some((p) => p.id === persistedId)) {
        setActiveProjectIdState(persistedId);
      } else if (list.length > 0) {
        setActiveProjectIdState(list[0].id);
        persistActiveProjectId(list[0].id);
      } else {
        setActiveProjectIdState(null);
        persistActiveProjectId(null);
      }
      return list;
    } catch (err: any) {
      console.error("[ActiveProjectContext] Failed to load projects:", err);
      setError(err?.message || "Failed to load projects.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Initial load
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Refresh when auth changes (sign in / sign out): the active storage
  // switches between Supabase (own projects only) and local fallback,
  // so the list must not keep showing the previous account's projects.
  useEffect(() => {
    const handler = () => {
      void refreshProjects();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
  }, [refreshProjects]);

  // React to external URL parameter changes (e.g. browser back/forward or deep links)
  useEffect(() => {
    const urlParam = searchParams.get("project") || searchParams.get("projectId");
    if (urlParam && projects.length > 0 && projects.some((p) => p.id === urlParam)) {
      if (urlParam !== activeProjectId) {
        setActiveProjectIdState(urlParam);
        persistActiveProjectId(urlParam);
      }
    }
  }, [searchParams, projects, activeProjectId]);

  // Action to change active project across the entire application
  const setActiveProjectId = useCallback(
    (id: string, syncUrl = true) => {
      const exists = projects.some((p) => p.id === id);
      if (!exists && id !== "") {
        console.warn(`[ActiveProjectContext] Attempted to select non-existent project id: ${id}`);
        return;
      }

      setActiveProjectIdState(id);
      persistActiveProjectId(id);

      if (syncUrl && id) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            // Standardize on 'project' while supporting legacy 'projectId'
            if (next.has("projectId")) {
              next.set("projectId", id);
            } else {
              next.set("project", id);
            }
            return next;
          },
          { replace: true }
        );
      }
    },
    [projects, setSearchParams]
  );

  const updateActiveProject = useCallback(
    async (updates: Partial<Project>): Promise<Project | null> => {
      if (!activeProjectId) return null;
      try {
        const updated = await projectStorage.update(activeProjectId, updates);
        setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? updated : p)));
        return updated;
      } catch (err: unknown) {
        console.error("[ActiveProjectContext] Failed to update project:", err);
        return null;
      }
    },
    [activeProjectId]
  );

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ActiveProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId,
        loading,
        error,
        setActiveProjectId,
        updateActiveProject,
        refreshProjects,
      }}
    >
      {children}
    </ActiveProjectContext.Provider>
  );
};

export const useActiveProject = () => {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error("useActiveProject must be used within an ActiveProjectProvider");
  }
  return context;
};
