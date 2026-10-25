/**
 * Types and interfaces for the ProjectNova AI Code Explainer.
 * Supports ELI5 (Explain Like I'm 5) and Normal (Technical Developer) explanation modes.
 */

export type CodeExplainerMode = "eli5" | "normal";

export interface CodeExplanationStep {
  step: number;
  title: string;
  explanation: string;
  lines?: string; // e.g. "1-14"
}

export interface CodeBreakdownItem {
  name: string;
  kind: "variable" | "function" | "component" | "import" | "config" | "block" | "hook" | "class" | "interface" | "constant";
  lines?: string; // e.g. "15-28"
  simpleExplanation?: string; // ELI5 plain language
  analogy?: string; // ELI5 real world analogy
  summary?: string; // Normal technical summary
  details?: string; // Normal implementation details
}

export interface CodeExample {
  scenario: string;
  walkthrough: string;
}

export interface CodeConnection {
  target: string;
  relationship: string;
}

export interface CodeExplanationResult {
  mode: CodeExplainerMode;
  fileName: string;
  atAGlance: string;
  howItWorks: CodeExplanationStep[];
  breakdown: CodeBreakdownItem[];
  example?: CodeExample;
  connections: CodeConnection[];
  thingsToNotice: string[];
  rawTextFallback?: string;
}
