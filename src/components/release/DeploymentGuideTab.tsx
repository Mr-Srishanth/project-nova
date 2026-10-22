import React, { useState } from "react";
import { Shield } from "lucide-react";
import type { DeploymentPrerequisite } from "@/types/release";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DeploymentGuideTabProps {
  prerequisites: DeploymentPrerequisite;
  onUpdatePrerequisites: (updated: DeploymentPrerequisite) => void;
}

export const DeploymentGuideTab: React.FC<DeploymentGuideTabProps> = ({
  prerequisites,
  onUpdatePrerequisites,
}) => {
  const [target, setTarget] = useState(prerequisites.target);
  const [commands, setCommands] = useState(prerequisites.buildCommands.join("\n"));
  const [migration, setMigration] = useState(prerequisites.databaseMigrationStep || "");
  const [rollback, setRollback] = useState(prerequisites.rollbackPlan);

  const handleSave = () => {
    onUpdatePrerequisites({
      ...prerequisites,
      target,
      buildCommands: commands.split("\n").filter((c) => c.trim().length > 0),
      databaseMigrationStep: migration.trim() || undefined,
      rollbackPlan: rollback,
    });
  };

  return (
    <div className="space-y-6">
      {/* Policy Warning */}
      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-tactile shadow-hard-sm space-y-1">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <Shield className="w-4 h-4 text-amber-600" />
          <span>Non-Autonomous Deployment Execution Policy</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          ProjectNova AI prepares, verifies, and packages operational deployment runbooks. In accordance with safety policies, these commands are <strong>never</strong> executed automatically to production servers without human operations oversight.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Editable Runbook Details */}
        <Card className="p-5 bg-surface border-2 border-border shadow-hard-sm space-y-4">
          <h4 className="font-bold text-sm text-foreground">Operational Runbook Parameters</h4>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-foreground-muted font-mono mb-1">Target Hosting Platform</label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. Docker Container / AWS ECS / Vercel"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
              />
            </div>

            <div>
              <label className="block text-foreground-muted font-mono mb-1">
                Standard Build & Packaging Commands (One per line)
              </label>
              <textarea
                rows={3}
                value={commands}
                onChange={(e) => setCommands(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
              />
            </div>

            <div>
              <label className="block text-foreground-muted font-mono mb-1">
                Database Migration Step (Optional)
              </label>
              <input
                type="text"
                value={migration}
                onChange={(e) => setMigration(e.target.value)}
                placeholder="e.g. npm run db:migrate or psql $DATABASE_URL < schema.sql"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
              />
            </div>

            <div>
              <label className="block text-foreground-muted font-mono mb-1">Rollback Procedure</label>
              <textarea
                rows={2}
                value={rollback}
                onChange={(e) => setRollback(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleSave}>
                Save Runbook Guidelines
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column: Operator Terminal View */}
        <div className="space-y-3">
          <span className="text-xs font-mono font-bold text-foreground">
            Operator Runbook Synopsis
          </span>

          <div className="p-4 bg-navy-deep text-cream font-mono text-xs rounded-tactile border-2 border-border shadow-hard-sm space-y-3">
            <div>
              <span className="text-foreground-muted"># 1. Target Infrastructure</span>
              <p className="text-emerald-400">$ PLATFORM="{target}"</p>
            </div>

            <div>
              <span className="text-foreground-muted"># 2. Build & Assembly</span>
              <pre className="text-cream whitespace-pre-wrap">{commands}</pre>
            </div>

            {migration && (
              <div>
                <span className="text-foreground-muted"># 3. Database Migration</span>
                <p className="text-accent-yellow">{migration}</p>
              </div>
            )}

            <div>
              <span className="text-foreground-muted"># 4. Post-Deployment Smoke Checks</span>
              <ul className="text-xs list-disc list-inside text-cream space-y-1">
                {prerequisites.postDeploymentSmokeChecks.map((sc, i) => (
                  <li key={i}>{sc}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-foreground-muted"># 5. Contingency Rollback Strategy</span>
              <p className="text-xs text-foreground-muted">{rollback}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
