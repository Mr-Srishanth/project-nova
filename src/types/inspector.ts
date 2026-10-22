export interface InspectedElementData {
  tagName: string;
  id: string | null;
  className: string;
  textContent: string;
  previewId?: string | null;
  sourceFile?: string | null;
  hierarchy?: Array<{ tagName: string; className?: string; id?: string }>;
  attributes?: Record<string, string>;
  styles: Record<string, string>;
}

export interface InspectorChange {
  id: string;
  property: string;
  previousValue: string;
  newValue: string;
  elementLabel: string;
  previewId?: string | null;
  sourceFile?: string | null;
  timestamp: string;
  isAppliedLive: boolean;
  isSavedToSource: boolean;
  status: "preview_only" | "unsaved" | "saved" | "build_passed" | "runtime_verified" | "failed";
}

export type StyleSectionTab = "layout" | "typography" | "colors" | "effects" | "attributes";
