import React from "react";
import {
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Edit3,
  ShieldCheck,
} from "lucide-react";
import type { ProjectSpecificationDraft } from "@/types/discovery";
import { Button } from "@/components/ui/Button";

interface SpecificationReviewPanelProps {
  specification: ProjectSpecificationDraft;
  onConfirmAndCreateBlueprint: () => void;
  onEditSpecification: () => void;
  onEditInterview: () => void;
  isCreating: boolean;
}

export const SpecificationReviewPanel: React.FC<SpecificationReviewPanelProps> = ({
  specification,
  onConfirmAndCreateBlueprint,
  onEditSpecification,
  onEditInterview,
  isCreating,
}) => {
  return (
    <div className="bg-surface border-2 border-border rounded-tactile p-6 shadow-hard space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/20 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-tactile bg-[#70C84B]/20 border border-[#70C84B]/40 text-[#153A52]">
            <FileCheck className="w-5 h-5 text-[#153A52]" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Section D • Final Review & Handoff
            </span>
            <h3 className="text-xl font-display font-bold text-foreground">
              {specification.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onEditSpecification}
            icon={<Edit3 className="w-3.5 h-3.5" />}
          >
            Edit Form Fields
          </Button>
          <Button
            size="sm"
            onClick={onConfirmAndCreateBlueprint}
            disabled={isCreating}
            icon={isCreating ? undefined : <ArrowRight className="w-4 h-4" />}
          >
            {isCreating ? "Initializing Blueprint Studio…" : "Confirm & Create Blueprint"}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-tactile bg-white border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-foreground-muted block">
            Category & Milestone
          </span>
          <div className="font-display font-bold text-sm text-foreground">
            {specification.category}
          </div>
          <p className="text-xs font-sans text-foreground-muted line-clamp-2">
            {specification.objective}
          </p>
        </div>

        <div className="p-4 rounded-tactile bg-white border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-foreground-muted block">
            Target Audience
          </span>
          <div className="font-display font-bold text-sm text-foreground">
            {specification.targetUsers.join(", ")}
          </div>
          <p className="text-xs font-sans text-foreground-muted">
            Tailored UX & operational workflows
          </p>
        </div>

        <div className="p-4 rounded-tactile bg-white border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-foreground-muted block">
            Storage & Auth
          </span>
          <div className="font-display font-bold text-sm text-foreground truncate">
            {specification.dataStorageNeeds}
          </div>
          <p className="text-xs font-sans text-foreground-muted truncate">
            {specification.authRequirements}
          </p>
        </div>
      </div>

      {/* Confirmed Technical Decisions List */}
      {specification.confirmedDecisions.length > 0 && (
        <div className="p-4 rounded-tactile bg-[#FAF7ED] border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-foreground-muted flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> Confirmed Interview Decisions ({specification.confirmedDecisions.length})
            </span>
            <button
              type="button"
              onClick={onEditInterview}
              className="text-xs text-primary font-mono hover:underline flex items-center gap-1"
            >
              <span>Edit Answers</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
            {specification.confirmedDecisions.map((d, i) => (
              <div key={i} className="p-2 bg-white rounded border border-border/60 space-y-0.5">
                <span className="text-[10px] text-foreground-muted font-mono block">
                  {d.question}
                </span>
                <span className="font-semibold text-foreground">{d.answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Features & Tech Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-tactile bg-white border border-border space-y-2">
          <span className="text-[10px] font-mono uppercase font-bold text-foreground-muted block">
            Core Features in Scope ({specification.coreFeatures.length})
          </span>
          <ul className="space-y-1.5 text-xs font-sans">
            {specification.coreFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-tactile bg-white border border-border space-y-2">
          <span className="text-[10px] font-mono uppercase font-bold text-foreground-muted block">
            Technology Stack & Topology
          </span>
          <div className="flex flex-wrap gap-1.5">
            {specification.technologyStack.map((tech, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border font-semibold"
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="pt-2 text-xs text-foreground-muted font-sans">
            <span className="font-mono font-bold block text-[10px] uppercase text-foreground-muted mb-0.5">
              Identified Assumptions & Constraints:
            </span>
            <p>{specification.constraints}</p>
          </div>
        </div>
      </div>

      {/* Final Call to Action */}
      <div className="pt-4 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs font-mono text-foreground-muted">
          All decisions and specifications will be compiled into your live Architecture Blueprint.
        </div>
        <Button
          onClick={onConfirmAndCreateBlueprint}
          disabled={isCreating}
          icon={isCreating ? undefined : <ArrowRight className="w-4 h-4" />}
        >
          {isCreating ? "Compiling Blueprint…" : "Confirm & Create Blueprint"}
        </Button>
      </div>
    </div>
  );
};
