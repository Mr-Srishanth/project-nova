import React, { useState } from "react";
import {
  ChevronDown,
  Target,
  Layers,
  Cpu,
  Workflow,
  Database,
  Globe,
  FolderTree,
  FlaskConical,
  Rocket,
  Plus,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { Blueprint } from "@/types/blueprint";
import { aiClient } from "@/lib/ai/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ArchitectureDiagram } from "@/components/visualizer/ArchitectureDiagram";

interface BlueprintViewProps {
  blueprint?: Blueprint;
  onUpdateBlueprint?: (updated: Blueprint) => Promise<void> | void;
  onCreateBlankBlueprint?: () => void;
  projectName?: string;
  projectObjective?: string;
  contextText?: string;
}

const SectionAccordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}> = ({ title, icon, children, defaultOpen = true, action }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="p-0 overflow-hidden mb-4 bg-surface border-2 border-border shadow-hard">
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b-2 border-border/10 cursor-pointer select-none hover:bg-[#FAF7ED]" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-tactile-sm bg-[#FAF7ED] border border-border text-foreground">
            {icon}
          </div>
          <h3 className="font-display font-bold text-base text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          <ChevronDown
            className={`w-4 h-4 text-foreground-muted transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </Card>
  );
};

export const BlueprintView: React.FC<BlueprintViewProps> = ({
  blueprint,
  onCreateBlankBlueprint,
  onUpdateBlueprint,
  projectName,
  projectObjective,
  contextText,
}) => {
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerateWithAI = async () => {
    if (!projectName || !projectObjective || !blueprint) return;
    setRegenerating(true);
    setError(null);

    try {
      const generated = await aiClient.generateBlueprint({
        projectName,
        objective: projectObjective,
        contextText,
        technologies: blueprint.techStack.map((t) => t.tech),
      });

      const updatedBlueprint: Blueprint = {
        ...blueprint,
        title: generated.title || blueprint.title,
        overview: generated.overview || blueprint.overview,
        problemStatement: generated.problemStatement || blueprint.problemStatement,
        targetUsers: generated.targetUsers || blueprint.targetUsers,
        realWorldUseCase: generated.realWorldUseCase || blueprint.realWorldUseCase,
        features: generated.features || blueprint.features,
        techStack: generated.techStack || blueprint.techStack,
        architecture: {
          summary: generated.architecture.summary,
          nodes: (generated.architecture.nodes || []).map((n) => ({
            id: n.id,
            label: n.label,
            kind: n.kind as any,
            detail: n.detail,
          })),
          edges: generated.architecture.edges || [],
        },
        database: generated.database as any || blueprint.database,
        api: generated.api || blueprint.api,
        folderStructure: generated.folderStructure || blueprint.folderStructure,
        testingStrategy: generated.testingStrategy || blueprint.testingStrategy,
        deploymentStrategy: generated.deploymentStrategy || blueprint.deploymentStrategy,
        futureImprovements: generated.futureImprovements || blueprint.futureImprovements,
        updatedAt: new Date().toISOString(),
      };

      if (onUpdateBlueprint) {
        await onUpdateBlueprint(updatedBlueprint);
      }
    } catch (err: any) {
      setError(err.message || "Failed to regenerate blueprint with AI.");
    } finally {
      setRegenerating(false);
    }
  };

  if (!blueprint) {
    return (
      <Card className="text-center py-16 bg-surface border-2 border-border shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <Layers className="w-7 h-7 text-foreground" />
          </div>
          <h3 className="font-display font-bold text-xl text-foreground">
            No Blueprint Generated Yet
          </h3>
          <p className="text-sm text-foreground-muted">
            The Blueprint defines your architecture topology, database schema, API contracts, and MVP feature tiers.
          </p>
          <div className="pt-2">
            <Button
              onClick={onCreateBlankBlueprint}
              icon={<Plus className="w-4 h-4" />}
            >
              Initialize Blueprint Spec
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Top Action Bar for AI Regeneration */}
      {projectName && projectObjective && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-surface border-2 border-border rounded-tactile shadow-hard gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-display font-bold text-foreground block">
              Blueprint Architecture Specification
            </span>
            <span className="text-[11px] font-mono text-foreground-muted block">
              Review and export your architectural topology and data contracts.
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleRegenerateWithAI}
            disabled={regenerating}
            icon={regenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          >
            {regenerating ? "Synthesizing Architecture…" : "Regenerate with AI Engine"}
          </Button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-semibold">
          {error}
        </div>
      )}

      {/* 1. Overview & Problem */}
      <SectionAccordion
        title="1. Overview & Problem Scope"
        icon={<Target className="w-4 h-4" />}
        action={<CopyButton text={`${blueprint.overview}\n\nProblem:\n${blueprint.problemStatement}`} label="Copy Overview" />}
      >
        <div className="space-y-3">
          <div>
            <span className="text-xs font-mono font-semibold uppercase text-foreground-muted">Summary</span>
            <p className="text-sm font-sans mt-0.5 text-foreground leading-relaxed">{blueprint.overview}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile">
              <span className="text-xs font-mono font-semibold uppercase text-foreground-muted">Core Problem</span>
              <p className="text-sm font-sans mt-1 text-foreground">{blueprint.problemStatement}</p>
            </div>
            <div className="p-3 bg-[#FAF7ED] border border-border rounded-tactile">
              <span className="text-xs font-mono font-semibold uppercase text-foreground-muted">Target Users</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {blueprint.targetUsers.map((u, i) => (
                  <Badge key={i} variant="blue">{u}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionAccordion>

      {/* 2. Feature Breakdown */}
      <SectionAccordion
        title="2. Feature Breakdown by Tier"
        icon={<Layers className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 bg-surface border-2 border-border rounded-tactile shadow-hard-sm">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/10">
              <span className="text-xs font-mono font-bold text-foreground uppercase">MVP Features</span>
              <Badge variant="primary">Priority 1</Badge>
            </div>
            <ul className="space-y-1.5">
              {blueprint.features.mvp.map((feat, i) => (
                <li key={i} className="text-xs font-sans text-foreground flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3.5 bg-surface border-2 border-border rounded-tactile shadow-hard-sm">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/10">
              <span className="text-xs font-mono font-bold text-foreground uppercase">Important Post-MVP</span>
              <Badge variant="blue">Priority 2</Badge>
            </div>
            <ul className="space-y-1.5">
              {blueprint.features.important.map((feat, i) => (
                <li key={i} className="text-xs font-sans text-foreground flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue mt-1.5 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionAccordion>

      {/* 3. Tech Stack Justification */}
      <SectionAccordion
        title="3. Technology Stack & Rationale"
        icon={<Cpu className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {blueprint.techStack.map((item, i) => (
            <div key={i} className="p-3 bg-[#FAF7ED] border border-border rounded-tactile space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-foreground-muted uppercase">{item.layer}</span>
                <Badge variant="yellow">{item.tech}</Badge>
              </div>
              <p className="text-xs font-sans text-foreground pt-1">{item.why}</p>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* 4. Architecture Diagram */}
      <SectionAccordion
        title="4. Architecture & Data Flow Topology"
        icon={<Workflow className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <p className="text-sm font-sans text-foreground-muted">{blueprint.architecture.summary}</p>
          <ArchitectureDiagram
            nodes={blueprint.architecture.nodes}
            edges={blueprint.architecture.edges}
          />
        </div>
      </SectionAccordion>

      {/* 5. Database Schema */}
      <SectionAccordion
        title="5. Database Entities & Schema"
        icon={<Database className="w-4 h-4" />}
        action={<CopyButton text={blueprint.database.sql} label="Copy DDL SQL" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {blueprint.database.entities.map((entity, i) => (
              <div key={i} className="p-3 bg-surface border border-border rounded-tactile">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-sm text-foreground">{entity.name}</span>
                  <span className="text-[11px] font-sans text-foreground-muted">{entity.purpose}</span>
                </div>
                <div className="space-y-1">
                  {entity.fields.map((f, j) => (
                    <div key={j} className="flex items-center justify-between text-xs font-mono py-0.5 border-t border-border/10">
                      <span className="text-foreground font-medium">{f.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground-muted">{f.type}</span>
                        {f.key && <Badge variant="yellow">{f.key}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-semibold uppercase text-foreground-muted">SQL Migration Script</span>
            </div>
            <pre className="p-3.5 bg-[#FAF7ED] border-2 border-border rounded-tactile text-xs font-mono overflow-x-auto text-foreground shadow-[inset_2px_2px_0_rgba(21,58,82,0.06)]">
              <code>{blueprint.database.sql}</code>
            </pre>
          </div>
        </div>
      </SectionAccordion>

      {/* 6. API Route Contracts */}
      <SectionAccordion
        title="6. API Route Contracts"
        icon={<Globe className="w-4 h-4" />}
      >
        <div className="space-y-2">
          {blueprint.api.map((route, i) => (
            <div key={i} className="p-3 bg-surface border border-border rounded-tactile flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Badge variant={route.method === "GET" ? "blue" : route.method === "POST" ? "primary" : "yellow"}>
                  {route.method}
                </Badge>
                <code className="text-xs font-mono font-bold text-foreground">{route.route}</code>
              </div>
              <span className="text-xs font-sans text-foreground-muted md:text-right">{route.purpose}</span>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* 7. Directory Tree */}
      <SectionAccordion
        title="7. Standard Directory Structure"
        icon={<FolderTree className="w-4 h-4" />}
        action={<CopyButton text={blueprint.folderStructure} label="Copy Tree" />}
      >
        <pre className="p-3.5 bg-[#FAF7ED] border-2 border-border rounded-tactile text-xs font-mono overflow-x-auto text-foreground shadow-[inset_2px_2px_0_rgba(21,58,82,0.06)]">
          <code>{blueprint.folderStructure}</code>
        </pre>
      </SectionAccordion>

      {/* 8. Testing & Deployment */}
      <SectionAccordion
        title="8. Quality Gates & Deployment Spec"
        icon={<Rocket className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 bg-[#FAF7ED] border border-border rounded-tactile space-y-2">
            <div className="flex items-center gap-2 text-foreground font-display font-semibold text-sm">
              <FlaskConical className="w-4 h-4 text-foreground" />
              <span>Testing Strategy</span>
            </div>
            <ul className="space-y-1.5">
              {blueprint.testingStrategy.map((t, i) => (
                <li key={i} className="text-xs font-sans text-foreground-muted flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-foreground mt-1.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3.5 bg-[#FAF7ED] border border-border rounded-tactile space-y-2">
            <div className="flex items-center gap-2 text-foreground font-display font-semibold text-sm">
              <Rocket className="w-4 h-4 text-foreground" />
              <span>Deployment Guidelines</span>
            </div>
            <ul className="space-y-1.5">
              {blueprint.deploymentStrategy.map((d, i) => (
                <li key={i} className="text-xs font-sans text-foreground-muted flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-foreground mt-1.5 shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionAccordion>
    </div>
  );
};
