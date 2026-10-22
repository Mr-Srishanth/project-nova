import { useEffect, useRef } from "react";
import type { Project } from "@/types/project";

/**
 * Opens the selected project exactly once per selection, as soon as its
 * record is actually available.
 *
 * The race this guards against: the selected project id can be known (URL
 * param or the global active project) before `projectStorage.list()`
 * resolves, so the project record is still `null` on the first renders. An
 * effect keyed only on the id runs too early, finds no record, bails out,
 * and — because the id never changes afterwards — never runs again. The
 * studio is then left with a project that was never opened or seeded
 * (Rev 0, no files, preview cannot build). Keying the open on the resolved
 * record instead makes it fire whenever the record arrives, regardless of
 * load ordering.
 *
 * Semantics:
 * - Re-renders with a fresh record object for the same project id (e.g. a
 *   list refresh) do not re-open.
 * - Switching to a different project opens it; switching back re-opens
 *   (matching the previous selection-keyed effect).
 * - The `open` callback receives an `isCurrent()` predicate that stays true
 *   only while this open is the latest one and the component is mounted, so
 *   a slow open cannot write UI state over a newer selection. Opening and
 *   seeding themselves are idempotent and are not gated on it.
 */
export function useProjectOpener(
  project: Project | null,
  open: (project: Project, isCurrent: () => boolean) => void | Promise<void>
): void {
  const openedIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!project) {
      // No record resolved for the current selection: invalidate any
      // in-flight open so its late completion cannot apply UI state.
      generationRef.current++;
      return;
    }
    if (openedIdRef.current === project.id) return;
    openedIdRef.current = project.id;
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    void openRef.current(project, isCurrent);
  }, [project]);

  // Invalidate any in-flight open on unmount.
  useEffect(
    () => () => {
      generationRef.current++;
    },
    []
  );
}
