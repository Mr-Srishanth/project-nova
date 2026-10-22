import JSZip from "jszip";
import type { BuildArtifact } from "@/types/artifact";
import type { BlueprintDirectoryModel } from "./blueprintDirectoryModel";
import { validateRelativeFilePath } from "./pathValidator";

export interface ZipExportFileItem {
  path: string;
  content: string;
  size: number;
}

export interface ZipExportExclusion {
  path: string;
  reason: string;
}

export interface ZipExportManifest {
  projectName: string;
  totalPlannedFiles: number;
  totalIncludedFiles: number;
  missingFiles: string[];
  ungeneratedFiles: string[];
  failedFiles: string[];
  isComplete: boolean;
  files: ZipExportFileItem[];
  exclusions: ZipExportExclusion[];
  generatedAt: string;
}

export interface ZipGenerationResult {
  blob: Blob;
  uint8Array?: Uint8Array;
  filename: string;
  manifest: ZipExportManifest;
}

/**
 * Patterns and exact names of files, directories, and credentials that must NEVER
 * be packaged into an exported project archive.
 */
const FORBIDDEN_EXACT_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".git",
  "node_modules",
  ".DS_Store",
  "Thumbs.db",
]);

const FORBIDDEN_DIR_PREFIXES = [
  "node_modules/",
  ".git/",
  ".cache/",
  "dist/",
  "build/",
  ".next/",
  ".turbo/",
];

export interface ZipExportOptions {
  includeConfiguredEnv?: boolean;
  configuredEnvContent?: string;
  userConfirmationGranted?: boolean;
}

/**
 * Checks if a given relative file path is safe to export in a project archive.
 */
export function isSafeArchivePath(
  filePath: string,
  options?: { allowConfiguredEnv?: boolean }
): { safe: boolean; reason?: string } {
  const norm = filePath.replace(/\\/g, "/").trim();

  // Traversal & Root path check
  const pathValidation = validateRelativeFilePath(norm);
  if (!pathValidation.isValid) {
    return { safe: false, reason: pathValidation.error || "Invalid or unsafe path traversal" };
  }

  const baseName = norm.split("/").pop() || "";

  // If allowConfiguredEnv is explicitly granted by user confirmation, allow root .env
  if (options?.allowConfiguredEnv && (norm === ".env" || baseName === ".env")) {
    return { safe: true };
  }

  // Exact forbidden secrets or clutter
  if (FORBIDDEN_EXACT_NAMES.has(baseName) || FORBIDDEN_EXACT_NAMES.has(norm)) {
    return { safe: false, reason: `Excluded secret or build clutter: '${baseName}'` };
  }

  // Forbidden directory prefixes
  for (const prefix of FORBIDDEN_DIR_PREFIXES) {
    if (norm.startsWith(prefix) || norm.includes(`/${prefix}`)) {
      return { safe: false, reason: `Excluded system or cache directory: '${prefix}'` };
    }
  }

  // Suspicious secret patterns
  const lower = norm.toLowerCase();
  if (
    lower.endsWith(".pem") ||
    lower.endsWith(".key") ||
    lower.endsWith(".pfx") ||
    lower.includes("service_role") ||
    lower.includes("secret_key")
  ) {
    return { safe: false, reason: "Forbidden private certificate or credential key pattern" };
  }

  return { safe: true };
}

/**
 * Builds an export manifest from the canonical blueprint directory model and stored artifacts.
 */
export function buildExportManifest(
  projectName: string,
  blueprintModel: BlueprintDirectoryModel,
  artifacts: BuildArtifact[],
  exportOptions?: ZipExportOptions
): ZipExportManifest {
  const artifactMap = new Map<string, BuildArtifact>();
  for (const a of artifacts) {
    artifactMap.set(a.path.replace(/\\/g, "/"), a);
  }

  const files: ZipExportFileItem[] = [];
  const exclusions: ZipExportExclusion[] = [];
  const missingFiles: string[] = [];
  const ungeneratedFiles: string[] = [];
  const failedFiles: string[] = [];

  const addedPaths = new Set<string>();

  const allowConfigured = Boolean(
    exportOptions?.includeConfiguredEnv && exportOptions?.userConfirmationGranted
  );

  // Process all canonical files defined in the blueprint
  for (const bpPath of blueprintModel.files) {
    const safeCheck = isSafeArchivePath(bpPath, { allowConfiguredEnv: allowConfigured });
    if (!safeCheck.safe) {
      exclusions.push({ path: bpPath, reason: safeCheck.reason || "Excluded by safety rule" });
      continue;
    }

    const art = artifactMap.get(bpPath);
    if (!art) {
      missingFiles.push(bpPath);
      continue;
    }

    if (art.status === "failed") {
      failedFiles.push(bpPath);
    }

    // Determine if content is genuine generated/edited content or an empty placeholder
    const isPlaceholder =
      !art.content ||
      art.content.includes("// Generated placeholder from Blueprint Studio") ||
      art.content.includes("// Planned from Blueprint Studio") ||
      art.status === "planned";

    if (isPlaceholder) {
      ungeneratedFiles.push(bpPath);
      // Still include file content if available so code isn't blank
      if (art.content && !addedPaths.has(bpPath)) {
        addedPaths.add(bpPath);
        files.push({
          path: bpPath,
          content: art.content,
          size: new TextEncoder().encode(art.content).length,
        });
      }
    } else {
      if (!addedPaths.has(bpPath)) {
        addedPaths.add(bpPath);
        files.push({
          path: bpPath,
          content: art.content,
          size: new TextEncoder().encode(art.content).length,
        });
      }
    }
  }

  // Include any extra generated/approved artifacts not in canonical blueprint (e.g. user-added files)
  for (const art of artifacts) {
    const norm = art.path.replace(/\\/g, "/");
    if (!addedPaths.has(norm)) {
      const safeCheck = isSafeArchivePath(norm, { allowConfiguredEnv: allowConfigured });
      if (!safeCheck.safe) {
        exclusions.push({ path: norm, reason: safeCheck.reason || "Excluded by safety rule" });
        continue;
      }

      addedPaths.add(norm);
      files.push({
        path: norm,
        content: art.content || "",
        size: new TextEncoder().encode(art.content || "").length,
      });
    }
  }

  // Inject locally configured .env ONLY IF explicit opt-in confirmation was granted
  if (allowConfigured && exportOptions?.configuredEnvContent) {
    if (!addedPaths.has(".env")) {
      addedPaths.add(".env");
      files.push({
        path: ".env",
        content: exportOptions.configuredEnvContent,
        size: new TextEncoder().encode(exportOptions.configuredEnvContent).length,
      });
    }
  }

  const isComplete =
    missingFiles.length === 0 && ungeneratedFiles.length === 0 && failedFiles.length === 0;

  return {
    projectName,
    totalPlannedFiles: blueprintModel.files.length,
    totalIncludedFiles: files.length,
    missingFiles,
    ungeneratedFiles,
    failedFiles,
    isComplete,
    files,
    exclusions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Packages all included manifest files into an in-memory ZIP archive using JSZip.
 */
export async function createProjectZipArchive(
  manifest: ZipExportManifest
): Promise<ZipGenerationResult> {
  const zip = new JSZip();

  for (const item of manifest.files) {
    zip.file(item.path, item.content);
  }

  const uint8Array = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const blob = new Blob([uint8Array.buffer as ArrayBuffer], { type: "application/zip" });
  const safeName = manifest.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "project";
  const filename = `${safeName}-source-code.zip`;

  return {
    blob,
    uint8Array,
    filename,
    manifest,
  };
}

/**
 * Initiates browser file download for a generated Blob and safely revokes the temporary URL.
 */
export function triggerBrowserZipDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  // Safely cleanup temporary Object URL
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}
