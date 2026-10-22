import React from "react";
import { Link } from "react-router-dom";
import { Hammer, Sparkles, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PlaceholderProps {
  moduleName: string;
  phaseScheduled: string;
  description: string;
}

export const ModulePlaceholderPage: React.FC<PlaceholderProps> = ({
  moduleName,
  phaseScheduled,
  description,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-12 animate-fadeIn">
      <Card className="text-center p-8 md:p-12 bg-surface shadow-hard space-y-5">
        <div className="w-14 h-14 mx-auto rounded-tactile bg-[#FAF7ED] border-2 border-border flex items-center justify-center shadow-hard-sm">
          <Hammer className="w-7 h-7 text-foreground" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-tactile-sm bg-accent-yellow-soft border border-border text-[11px] font-mono font-semibold text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-foreground" />
            <span>ROADMAP // {phaseScheduled}</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {moduleName}
          </h1>
          <p className="text-sm font-sans text-foreground-muted leading-relaxed max-w-lg mx-auto">
            {description}
          </p>
        </div>

        <div className="p-4 bg-[#FAF7ED] border border-border rounded-tactile text-left space-y-1.5">
          <span className="text-[11px] font-mono font-bold uppercase text-foreground block">
            Phase 2 Scope Notice
          </span>
          <p className="text-xs font-sans text-foreground-muted leading-relaxed">
            Per Phase 2 rules, ProjectNova AI avoids simulating fake working features. Real functionality is currently live for <strong>Overview</strong>, <strong>Project Workspaces</strong>, <strong>Discovery</strong>, and <strong>Blueprint Studio</strong>.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/">
            <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Overview
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
