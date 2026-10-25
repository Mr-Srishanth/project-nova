import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { projectStorage } from "@/lib/storage/projectStorage";
import { generateDefaultBlueprint } from "@/lib/blueprintDefaults";
import { aiClient } from "@/lib/ai/client";
import type { IdeaUnderstandingResult } from "@/lib/ai/ideaTypes";
import type { ProjectCategory } from "@/types/project";
import type {
  ClarificationQuestion,
  ProjectSpecificationDraft,
  UserConfirmedDecision,
} from "@/types/discovery";
import {
  generateAdaptiveQuestionsForIdea,
  compileSpecificationFromAnalysis,
} from "@/lib/ai/adaptiveClarification";
import { ClarificationInterviewPanel } from "./ClarificationInterviewPanel";
import { SpecificationReviewPanel } from "./SpecificationReviewPanel";

const EXAMPLE_IDEAS = [
  "A mobile app for university students to form spontaneous study groups on campus with real-time location and subject tags",
  "A zero-telemetry command-line tool for developers to audit node_modules dependencies for license risk and dormant maintainers",
  "A local-first encrypted markdown note-taking app with peer-to-peer sync and offline vector search",
];

const DISCOVERY_SESSION_STORAGE_KEY = "projectnova_discover_session_v2";

export const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const interviewRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  // Workflow section active state
  const [activeWorkflowSection, setActiveWorkflowSection] = useState<"idea" | "interview" | "form" | "review">("idea");

  // Section A: Idea Understanding Engine state
  const [rawIdea, setRawIdea] = useState("");
  const [understanding, setUnderstanding] = useState(false);
  const [ideaResult, setIdeaResult] = useState<IdeaUnderstandingResult | null>(null);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  // Section B: Adaptive Clarification Interview state
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [confirmedDecisions, setConfirmedDecisions] = useState<UserConfirmedDecision[]>([]);

  // Section C: Controlled Form State (The Existing Specification Form)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [category, setCategory] = useState<ProjectCategory>("Web Application");
  const [techInput, setTechInput] = useState("");
  const [constraints, setConstraints] = useState("");
  const [autoGenerateBlueprint, setAutoGenerateBlueprint] = useState(true);

  // Section D: Final Review state
  const [compiledSpec, setCompiledSpec] = useState<ProjectSpecificationDraft | null>(null);

  // Overall Page Operations & Gateway State
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState<boolean | null>(null);
  const [hasManuallyEditedForm, setHasManuallyEditedForm] = useState(false);

  // Check AI Gateway Connectivity on Mount
  useEffect(() => {
    // Ensure Discover page starts at top of viewport
    window.scrollTo(0, 0);

    aiClient
      .checkHealth()
      .then((h) => setGatewayConfigured(h.hasKey))
      .catch(() => setGatewayConfigured(false));
  }, []);

  // Restore Discovery Session if present
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DISCOVERY_SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rawIdea) setRawIdea(parsed.rawIdea);
        if (parsed.ideaResult) setIdeaResult(parsed.ideaResult);
        if (parsed.questions) setQuestions(parsed.questions);
        if (parsed.confirmedDecisions) setConfirmedDecisions(parsed.confirmedDecisions);
        if (parsed.name) setName(parsed.name);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.objective) setObjective(parsed.objective);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.techInput) setTechInput(parsed.techInput);
        if (parsed.constraints) setConstraints(parsed.constraints);
        if (parsed.activeSection) setActiveWorkflowSection(parsed.activeSection);
      }
    } catch (e) {
      console.warn("Could not restore discovery session:", e);
    }
  }, []);

  // Persist Discovery Session on meaningful changes
  useEffect(() => {
    if (!rawIdea && !name) return;
    try {
      sessionStorage.setItem(
        DISCOVERY_SESSION_STORAGE_KEY,
        JSON.stringify({
          rawIdea,
          ideaResult,
          questions,
          confirmedDecisions,
          name,
          description,
          objective,
          category,
          techInput,
          constraints,
          activeSection: activeWorkflowSection,
        })
      );
    } catch {}
  }, [
    rawIdea,
    ideaResult,
    questions,
    confirmedDecisions,
    name,
    description,
    objective,
    category,
    techInput,
    constraints,
    activeWorkflowSection,
  ]);

  // Phase 1: Understand the Idea via AI Gateway
  const handleUnderstandIdea = async (ideaText?: string) => {
    const textToAnalyze = (ideaText !== undefined ? ideaText : rawIdea).trim();
    if (!textToAnalyze) {
      setIdeaError("Please enter your rough project thoughts, bullet points, or goal.");
      return;
    }

    setUnderstanding(true);
    setIdeaError(null);

    try {
      const result = await aiClient.understandIdea({
        idea: textToAnalyze,
        targetTechnologies: techInput || undefined,
      });

      setIdeaResult(result);

      // Generate adaptive clarification questions tailored specifically for this project
      const dynamicQuestions = generateAdaptiveQuestionsForIdea(result, []);
      setQuestions(dynamicQuestions);

      // Auto-populate form fields unless user already manually altered them
      if (!hasManuallyEditedForm) {
        setName(result.suggestedName);
        setCategory(result.suggestedCategory);
        setObjective(result.mainObjective || result.coreIntent);
        setDescription(
          `${result.polishedSummary}\n\nProblem Statement: ${result.problemStatement}\n\nArchitecture: ${result.proposedSolution}`
        );
        if (result.suggestedTechnologies && result.suggestedTechnologies.length > 0) {
          setTechInput(result.suggestedTechnologies.map((t) => (typeof t === "string" ? t : t.tech)).join(", "));
        }
        if (result.constraintsAndRisks && result.constraintsAndRisks.length > 0) {
          setConstraints(result.constraintsAndRisks.join("; "));
        }
      }

      // If questions exist, transition to Clarification Interview (Section B); otherwise Form
      if (dynamicQuestions.length > 0) {
        setActiveWorkflowSection("interview");
        setTimeout(() => {
          interviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      } else {
        setActiveWorkflowSection("form");
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to analyze idea. Please ensure the AI Gateway is active.";
      setIdeaError(msg);
      // Fallback: Populate form with raw input so user can proceed manually without data loss
      if (!name) setName("New Project Workspace");
      if (!objective) setObjective(textToAnalyze.slice(0, 100));
      if (!description) setDescription(textToAnalyze);
    } finally {
      setUnderstanding(false);
    }
  };

  // Phase 2: Handle Clarification Answers
  const handleConfirmAnswer = (
    questionId: string,
    answer: string,
    source: UserConfirmedDecision["source"]
  ) => {
    const updatedDecisions: UserConfirmedDecision[] = [
      ...confirmedDecisions.filter((d) => d.questionId !== questionId),
      {
        questionId,
        question: questions.find((q) => q.id === questionId)?.question || "Technical Decision",
        answer,
        source,
        timestamp: new Date().toISOString(),
      },
    ];
    setConfirmedDecisions(updatedDecisions);

    // Update question status
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, status: "confirmed", selectedOption: answer }
          : q
      )
    );

    // Synchronize into Form fields
    if (ideaResult) {
      const compiled = compileSpecificationFromAnalysis(ideaResult, updatedDecisions, {
        name,
        category,
        objective,
        description,
        technologyStack: techInput ? techInput.split(",").map((s) => s.trim()) : undefined,
        constraints,
      });
      setName(compiled.name);
      setCategory(compiled.category);
      setObjective(compiled.objective);
      setDescription(compiled.description);
      setTechInput(compiled.technologyStack.join(", "));
      setConstraints(compiled.constraints);
    }
  };

  const handleSkipQuestion = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, status: "unanswered", selectedOption: undefined } : q
      )
    );
    setConfirmedDecisions((prev) => prev.filter((d) => d.questionId !== questionId));
  };

  const handleProceedToForm = () => {
    setActiveWorkflowSection("form");
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleProceedToReview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a project name.");
      return;
    }
    if (!objective.trim() && !description.trim()) {
      setError("Please provide at least a project objective or description.");
      return;
    }

    const techList = techInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const spec: ProjectSpecificationDraft = {
      name,
      category,
      objective: objective || description,
      description,
      targetUsers: ideaResult?.targetUsers && ideaResult.targetUsers.length > 0 ? ideaResult.targetUsers : ["End Users"],
      coreFeatures: ideaResult?.essentialFeatures && ideaResult.essentialFeatures.length > 0 ? ideaResult.essentialFeatures : ["Core functional MVP prototype"],
      technologyStack: techList.length > 0 ? techList : ["React", "TypeScript", "Tailwind CSS"],
      architectureOverview: ideaResult?.proposedSolution || "Responsive modular architecture",
      dataStorageNeeds: "Local state storage and browser cache",
      authRequirements: "Standard access / Anonymous session for MVP",
      externalIntegrations: ["Zero external paid APIs for MVP"],
      constraints: constraints || "2-week delivery target",
      assumptions: ideaResult?.assumptions && ideaResult.assumptions.length > 0 ? ideaResult.assumptions : ["Modern browser deployment"],
      unresolvedOptionalDetails: ideaResult?.optionalFeatures || [],
      confirmedDecisions,
    };

    setCompiledSpec(spec);
    setActiveWorkflowSection("review");
    setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  // Phase 4: Final Confirmation and Blueprint Creation Handoff
  const handleConfirmAndCreateBlueprint = async () => {
    setError(null);
    setCreating(true);

    try {
      const technologies = techInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const creationPrompt = (rawIdea || objective || description).trim();

      const created = await projectStorage.create({
        name,
        description,
        objective: objective || description,
        category,
        technologies,
        discoveryMode: "custom",
        constraints,
        initialPrompt: creationPrompt,
        generationStatus: "not_generated",
      });

      if (autoGenerateBlueprint) {
        const bp = generateDefaultBlueprint(
          created.id,
          created.name,
          technologies,
          category,
          objective || description,
          description
        );
        await projectStorage.update(created.id, { blueprint: bp });
      }

      // Clear session after successful creation
      sessionStorage.removeItem(DISCOVERY_SESSION_STORAGE_KEY);

      // Navigate to UI Studio directly so the user can generate with 1 click
      navigate(`/ui-studio?project=${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create project and blueprint");
    } finally {
      setCreating(false);
    }
  };

  // Quick Starter Preload Helper
  const handlePreload = (template: {
    name: string;
    cat: ProjectCategory;
    desc: string;
    obj: string;
    tech: string;
  }) => {
    setRawIdea(`${template.name}: ${template.desc} (Goal: ${template.obj})`);
    setName(template.name);
    setCategory(template.cat);
    setDescription(template.desc);
    setObjective(template.obj);
    setTechInput(template.tech);
    setHasManuallyEditedForm(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fadeIn pb-12">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-tactile-sm bg-accent-yellow-soft border border-border text-[11px] font-mono font-semibold text-foreground mb-2">
          <span>PROJECT DISCOVERY & SPECIFICATION</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Create New Project
        </h1>
        <p className="text-sm font-sans text-foreground-muted mt-1">
          Describe your idea in natural language. ProjectNova AI will analyze your concept, clarify architectural decisions through an adaptive interview, and configure your Project OS workspace.
        </p>
      </div>

      {/* SECTION A — DESCRIBE YOUR IDEA */}
      <Card className="bg-surface border-2 border-border p-6 shadow-hard space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-tactile bg-[#70C84B]/20 border border-[#70C84B]/40 text-[#153A52]">
              <Sparkles className="w-5 h-5 text-[#153A52]" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
                Section A • Natural Language Conception
              </span>
              <h2 className="text-lg font-display font-bold text-foreground">
                Describe your idea
              </h2>
            </div>
          </div>

          {gatewayConfigured === false && (
            <Badge variant="yellow" className="self-center">
              AI Gateway Unconfigured (Manual Mode Active)
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            placeholder="e.g. I want to build a local-first markdown note taking app for developers that encrypts everything and allows peer-to-peer sync without a central server..."
            rows={4}
            className="w-full bg-[#FAF7ED] border-2 border-border rounded-tactile p-3.5 text-sm text-foreground focus:outline-none focus:bg-surface focus:ring-2 focus:ring-foreground transition-all shadow-[inset_2px_2px_0_rgba(21,58,82,0.08)] placeholder:text-foreground-muted/60"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono font-semibold text-foreground-muted flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-primary" /> Try an example:
              </span>
              {EXAMPLE_IDEAS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setRawIdea(ex);
                    handleUnderstandIdea(ex);
                  }}
                  className="text-[11px] font-sans px-2 py-0.5 bg-[#FAF7ED] border border-border rounded hover:bg-primary/20 transition-colors text-foreground"
                >
                  Prompt {idx + 1}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {rawIdea && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRawIdea("");
                    setIdeaResult(null);
                    setQuestions([]);
                    setConfirmedDecisions([]);
                  }}
                  disabled={understanding}
                >
                  Clear
                </Button>
              )}
              <Button
                type="button"
                onClick={() => handleUnderstandIdea()}
                disabled={understanding || !rawIdea.trim()}
                icon={
                  understanding ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )
                }
              >
                {understanding ? "Understanding Idea…" : "Understand My Idea"}
              </Button>
            </div>
          </div>
        </div>

        {ideaError && (
          <div className="p-3 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{ideaError}</span>
          </div>
        )}
      </Card>

      {/* Quick Preload Starters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono font-semibold text-foreground-muted">Quick Starters:</span>
        <button
          type="button"
          onClick={() =>
            handlePreload({
              name: "Autonomous Data Pipeline",
              cat: "Data Engineering",
              desc: "Automated ingestion engine that processes webhooks and stores partitioned parquet files.",
              obj: "Build verifiable, resilient event stream handler with replay capability.",
              tech: "Python, DuckDB, Apache Parquet, FastAPI",
            })
          }
          className="text-xs font-mono px-2.5 py-1 bg-surface border border-border rounded-tactile-sm hover:bg-[#FAF7ED] shadow-[1px_1px_0_var(--border)] text-foreground"
        >
          + Data Pipeline
        </button>
        <button
          type="button"
          onClick={() =>
            handlePreload({
              name: "Hybrid Agent Orchestrator",
              cat: "AI & Machine Learning",
              desc: "Controlled execution framework for LLM agent actions with audit ledger.",
              obj: "Implement permission verification gates and step rollback logic.",
              tech: "TypeScript, Node.js, SQLite, React",
            })
          }
          className="text-xs font-mono px-2.5 py-1 bg-surface border border-border rounded-tactile-sm hover:bg-[#FAF7ED] shadow-[1px_1px_0_var(--border)] text-foreground"
        >
          + Agent Orchestrator
        </button>
        <button
          type="button"
          onClick={() =>
            handlePreload({
              name: "Developer Documentation Hub",
              cat: "Web Application",
              desc: "Interactive Markdown documentation engine with embedded code execution runners.",
              obj: "Publish typed documentation with live interactive component playground.",
              tech: "React, Vite, Tailwind CSS, TypeScript",
            })
          }
          className="text-xs font-mono px-2.5 py-1 bg-surface border border-border rounded-tactile-sm hover:bg-[#FAF7ED] shadow-[1px_1px_0_var(--border)] text-foreground"
        >
          + Docs Hub
        </button>
      </div>

      {/* SECTION B — ADAPTIVE CLARIFICATION INTERVIEW */}
      {questions.length > 0 && (
        <div ref={interviewRef}>
          <ClarificationInterviewPanel
            questions={questions}
            onConfirmAnswer={handleConfirmAnswer}
            onSkipQuestion={handleSkipQuestion}
            onProceedToSpecification={handleProceedToForm}
            isAnalyzing={understanding}
          />
        </div>
      )}

      {/* SECTION C — PROJECT SPECIFICATION FORM */}
      <form
        ref={formRef}
        onSubmit={handleProceedToReview}
        className="space-y-5 bg-surface border-2 border-border rounded-tactile p-6 shadow-hard"
      >
        <div className="flex items-center justify-between border-b border-border/20 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Section C • Project Specification Form
            </span>
            <h3 className="font-display font-bold text-base text-foreground">
              Core Parameters & Stack
            </h3>
            <p className="text-xs font-sans text-foreground-muted">
              Populated automatically from your idea analysis and interview answers. All fields are editable.
            </p>
          </div>
          {name && (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-primary/20 text-[#153A52] rounded border border-border">
              Ready to review
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Project Name *"
            placeholder="e.g. Nexus Query Engine"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasManuallyEditedForm(true);
            }}
            required
          />

          <div className="space-y-1 text-left w-full">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ProjectCategory);
                setHasManuallyEditedForm(true);
              }}
              className="w-full bg-[#FAF7ED] border-2 border-border rounded-tactile px-3.5 py-2 text-sm text-foreground focus:outline-none focus:bg-surface focus:ring-2 focus:ring-foreground transition-all shadow-[inset_2px_2px_0_rgba(21,58,82,0.08)]"
            >
              <option value="Web Application">Web Application</option>
              <option value="AI & Machine Learning">AI & Machine Learning</option>
              <option value="Mobile App">Mobile App</option>
              <option value="Cloud & Infrastructure">Cloud & Infrastructure</option>
              <option value="Data Engineering">Data Engineering</option>
              <option value="Developer Tool">Developer Tool</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <Textarea
          label="Main Objective *"
          placeholder="What is the concrete goal or milestone this project will achieve?"
          value={objective}
          onChange={(e) => {
            setObjective(e.target.value);
            setHasManuallyEditedForm(true);
          }}
          rows={2}
          required
        />

        <Textarea
          label="Problem Statement / Description"
          placeholder="Describe the context, user pain points, and why this project exists..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setHasManuallyEditedForm(true);
          }}
          rows={3}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Target Technologies (comma-separated)"
            placeholder="e.g. React, TypeScript, FastAPI, PostgreSQL"
            value={techInput}
            onChange={(e) => {
              setTechInput(e.target.value);
              setHasManuallyEditedForm(true);
            }}
            hint="Used to seed the initial architectural topology and dependencies."
          />

          <Input
            label="Constraints / Deadline (optional)"
            placeholder="e.g. 2 weeks, strict zero-telemetry requirement"
            value={constraints}
            onChange={(e) => {
              setConstraints(e.target.value);
              setHasManuallyEditedForm(true);
            }}
          />
        </div>

        <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-display font-semibold text-xs text-foreground block">
              Auto-generate Architecture Blueprint Spec
            </span>
            <span className="text-[11px] font-sans text-foreground-muted block">
              Initializes full SVG system diagram, schema tables, and API contracts immediately.
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoGenerateBlueprint}
            onChange={(e) => setAutoGenerateBlueprint(e.target.checked)}
            className="w-4 h-4 accent-primary border-2 border-border cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/projects")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Review Final Specification
          </Button>
        </div>
      </form>

      {/* SECTION D — FINAL REVIEW & BLUEPRINT HANDOFF */}
      {compiledSpec && (
        <div ref={reviewRef}>
          <SpecificationReviewPanel
            specification={compiledSpec}
            onConfirmAndCreateBlueprint={handleConfirmAndCreateBlueprint}
            onEditSpecification={() => {
              setActiveWorkflowSection("form");
              formRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            onEditInterview={() => {
              setActiveWorkflowSection("interview");
              interviewRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            isCreating={creating}
          />
        </div>
      )}
    </div>
  );
};
