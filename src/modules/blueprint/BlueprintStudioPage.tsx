import React from "react";
import { useNavigate } from "react-router-dom";
import { FileCode2, Plus } from "lucide-react";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BlueprintView } from "@/components/blueprint/BlueprintView";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";

export const BlueprintStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, projects, loading, updateActiveProject } = useActiveProject();

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Blueprint Studio…</p>
      </div>
    );
  }

  if (projects.length === 0 || !activeProject) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <FileCode2 className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Blueprinting
          </h2>
          <p className="text-sm text-foreground-muted">
            Create a project first to inspect, visualize, and edit its architecture blueprint.
          </p>
          <Button onClick={() => navigate("/discover")} icon={<Plus className="w-4 h-4" />}>
            Create Project Now
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Blueprint Studio
          </h1>
          <p className="text-xs md:text-sm font-sans text-foreground-muted">
            Inspect architecture topologies, data contracts, and feature breakdown specs.
          </p>
        </div>

        {/* Global Active Project Indicator */}
        <div className="w-full sm:w-auto">
          <CompactProjectIndicator />
        </div>
      </div>

      <BlueprintView
        blueprint={activeProject.blueprint}
        projectName={activeProject.name}
        projectObjective={activeProject.objective}
        contextText={activeProject.description}
        onUpdateBlueprint={async (updated) => {
          await updateActiveProject({ blueprint: updated });
        }}
        onCreateBlankBlueprint={() => navigate(`/projects/${activeProject.id}`)}
      />
    </div>
  );
};
