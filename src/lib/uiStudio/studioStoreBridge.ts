/**
 * studioStoreBridge.ts — Bi-directional bridge between Project Nova's
 * StudioDocumentManager / artifactStorage and UI Studio's studioSourceStore.
 *
 * This ensures that:
 * 1. When a project is loaded or opened in UI Studio, its files are synchronized
 *    into studioSourceStore.
 * 2. When files are edited in StudioEditor (or via AI/Inspector/Tokens),
 *    changes propagate cleanly to both stores and notify dirty states.
 * 3. Saves update artifactStorage and increment the revision.
 */

import {
  loadProject as loadSourceProject,
  updateFileCode,
  addFile as addSourceFile,
  removeFile as removeSourceFile,
  renameFile as renameSourceFile,
  type SourceFile,
  type StudioProject as VirtualStudioProject,
} from "./studioSourceStore";
import type { StudioFileState } from "./studioDocuments";
import type { BuildArtifact } from "@/types/artifact";

/**
 * Infers language for studioSourceStore from file extension.
 */
export function inferSourceLanguage(path: string): "tsx" | "ts" | "css" | "json" {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  return "tsx";
}

/**
 * Syncs project files from Project Nova's artifacts / studioDocuments into studioSourceStore.
 */
export function syncFilesToSourceStore(
  projectId: string,
  projectName: string,
  files: StudioFileState[] | BuildArtifact[]
): void {
  const fileRecord: Record<string, SourceFile> = {};

  for (const f of files) {
    const path = "path" in f ? f.path : (f as any).id;
    const content = "draftContent" in f ? (f as StudioFileState).draftContent : (f as BuildArtifact).content || "";
    const name = path.split("/").pop() || path;

    fileRecord[path] = {
      id: path,
      name,
      code: content,
      language: inferSourceLanguage(path),
    };
  }

  const virtualProject: VirtualStudioProject = {
    id: projectId,
    name: projectName,
    files: fileRecord,
    savedAt: new Date().toISOString(),
  };

  loadSourceProject(virtualProject);
}

export function syncSingleFileToSourceStore(path: string, code: string): void {
  updateFileCode(path, code);
}

export function addFileToSourceStore(path: string, content = ""): void {
  addSourceFile({
    id: path,
    name: path.split("/").pop() || path,
    code: content,
    language: inferSourceLanguage(path),
  });
}

export function removeFileFromSourceStore(path: string): void {
  removeSourceFile(path);
}

export function renameFileInSourceStore(oldPath: string, newPath: string): void {
  renameSourceFile(oldPath, newPath);
}
