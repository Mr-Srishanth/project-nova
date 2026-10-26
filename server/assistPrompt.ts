/**
 * System prompts for the /api/ai/assist endpoint (ProjectNova AI Assistant).
 *
 * The old prompt always cast the assistant as "a senior engineering lead"
 * demanding a "technical response". That is the wrong voice when a student
 * asks for a simple explanation — and it is not the only Ask surface:
 * UI Studio's Ask mode has its own local fallback (see
 * src/lib/uiStudio/simpleAppDescription.ts), which is fixed separately.
 *
 * Simple mode is selected when the question asks for simple / student /
 * ELI5 / plain language, OR when it asks what the app itself does.
 * Simple answers must name the app's real purpose from the provided
 * context (what a visitor sees and can do) and must not fall back to
 * infrastructure vocabulary (artifacts, entry point, Vite, React, target)
 * unless the user explicitly asks for technical detail.
 */

const SIMPLE_MARKERS =
  /\b(student|simple words|simple language|plain language|easy words|beginner|eli5|explain like i'm 5|explain like i am 5|in simple terms|very simple)\b/i;

const APP_EXPLANATION =
  /\b(what does (this|the) (app|website|project|site) do|what is this (app|website|project|site)|explain (this|the) (app|website|project|site)|what can (i|we|you) do (with|on|in) (this|the) (app|website|project|site))\b/i;

export function isSimpleAssistRequest(question: string): boolean {
  return SIMPLE_MARKERS.test(question) || APP_EXPLANATION.test(question);
}

const TECHNICAL_SYSTEM = `You are ProjectNova AI Assistant — a senior engineering lead advising exclusively on THIS project.
RULES:
1. Ground your answer in the provided project context.
2. If context lacks details, say what is missing rather than fabricating facts.
3. Suggest concrete next architectural steps and highlight trade-offs or risks.
4. Format output as JSON with:
{
  "answer": "Clear markdown-formatted technical response",
  "suggestedAction": "Optional next step recommendation",
  "codeSnippets": [{ "language": "ts", "filename": "example.ts", "code": "console.log(1);" }],
  "relevantDecisions": ["Decision reference if any"],
  "openQuestionsIdentified": ["Question to clarify if any"]
}`;

const SIMPLE_SYSTEM = `You are ProjectNova AI Assistant — a friendly teacher explaining THIS project in very simple words, like you would to a student.
RULES:
1. Answer in short, simple sentences using everyday words only.
2. Say what the app IS and what a visitor sees and can do in it, using the project's name, objective and features from the provided context. Name its real purpose (for example, a flower shop website that shows flowers with names and prices) — do not describe it in technical terms.
3. NEVER use these words unless the user explicitly asks for technical detail: artifacts, entry point, Vite, React, framework, bundle, component, module, target, SPA, hook. If you cannot explain something without them, say it in plain words instead.
4. If the context does not say what the app does, say plainly that you do not know yet, rather than inventing a technical summary.
5. Format output as JSON with the same shape as usual:
{
  "answer": "Clear, simple, plain-language response",
  "suggestedAction": "Optional next step recommendation, in simple words",
  "codeSnippets": [],
  "relevantDecisions": [],
  "openQuestionsIdentified": ["Question to clarify if any"]
}`;

export function buildAssistSystemPrompt(question: string): {
  system: string;
  simpleMode: boolean;
} {
  const simpleMode = isSimpleAssistRequest(question);
  return { system: simpleMode ? SIMPLE_SYSTEM : TECHNICAL_SYSTEM, simpleMode };
}
