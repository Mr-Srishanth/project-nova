import React, { useState } from "react";
import { Download, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ReleaseRecord, ReadinessCheckResult } from "@/types/release";
import { formatReleaseNotesMarkdown } from "@/lib/release/releaseNotesGenerator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ReleaseNotesTabProps {
  release: ReleaseRecord;
  readinessChecks: ReadinessCheckResult[];
  onUpdateRelease: (updated: Partial<ReleaseRecord>) => void;
  onApproveRelease: () => void;
  onMarkReleased: () => void;
  isReadyForApproval: boolean;
}

export const ReleaseNotesTab: React.FC<ReleaseNotesTabProps> = ({
  release,
  readinessChecks,
  onUpdateRelease,
  onApproveRelease,
  onMarkReleased,
  isReadyForApproval,
}) => {
  const [version, setVersion] = useState(release.version);
  const [title, setTitle] = useState(release.title);
  const [summary, setSummary] = useState(release.summary);
  const [newChange, setNewChange] = useState("");

  const markdownContent = formatReleaseNotesMarkdown(release, readinessChecks);

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RELEASE_NOTES_${release.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveMeta = () => {
    onUpdateRelease({
      version,
      title,
      summary,
    });
  };

  const handleAddChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChange.trim()) return;
    onUpdateRelease({
      notableChanges: [...release.notableChanges, newChange.trim()],
    });
    setNewChange("");
  };

  return (
    <div className="space-y-6">
      {/* Top Release Control Bar */}
      <div className="p-4 bg-surface border-2 border-border rounded-tactile shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg text-foreground">
              {release.title} ({release.version})
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                release.status === "approved"
                  ? "bg-secondary-soft text-secondary border-secondary/20"
                  : release.status === "released"
                  ? "bg-primary-soft text-primary border-primary/20"
                  : release.status === "blocked"
                  ? "bg-red-50 text-accent-red border-red-200"
                  : "bg-surface-subtle text-foreground-muted border-border"
              }`}
            >
              STATUS: {release.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-foreground-muted">
            Inspect verified release notes, notable changes, and sign off on formal release approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadMarkdown}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Download Notes (.md)
          </Button>

          {release.status !== "approved" && release.status !== "released" ? (
            <Button
              size="sm"
              onClick={onApproveRelease}
              disabled={!isReadyForApproval}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Approve Release
            </Button>
          ) : release.status === "approved" ? (
            <Button size="sm" onClick={onMarkReleased} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              Mark as Released
            </Button>
          ) : (
            <span className="text-xs font-mono font-bold text-secondary flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Released
            </span>
          )}
        </div>
      </div>

      {!isReadyForApproval && release.status !== "approved" && release.status !== "released" && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-tactile flex items-center gap-2 text-xs text-amber-900 font-mono">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Release approval gate is currently locked. Resolve all failing readiness blockers to enable sign-off.
          </span>
        </div>
      )}

      {/* Editor & Preview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Metadata & Changes */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
            <h4 className="font-bold text-sm text-foreground">Release Metadata</h4>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-muted font-mono mb-1">Version String</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block text-foreground-muted font-mono mb-1">Release Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground-muted font-mono mb-1">Executive Summary</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={handleSaveMeta}>
                  Save Metadata Changes
                </Button>
              </div>
            </div>
          </Card>

          {/* Notable Changes */}
          <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
            <h4 className="font-bold text-sm text-foreground">Notable Changes & Feature Highlights</h4>
            <ul className="text-xs space-y-1.5 divide-y divide-border/10">
              {release.notableChanges.map((change, i) => (
                <li key={i} className="pt-1.5 flex items-start justify-between gap-2 text-foreground">
                  <span>• {change}</span>
                  <button
                    onClick={() =>
                      onUpdateRelease({
                        notableChanges: release.notableChanges.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-foreground-muted hover:text-accent-red font-mono text-[10px]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddChange} className="pt-2 flex gap-2">
              <input
                type="text"
                placeholder="Add highlight (e.g. Added Stripe webhook integration)"
                value={newChange}
                onChange={(e) => setNewChange(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded text-xs text-foreground"
              />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Markdown Preview */}
        <div className="lg:col-span-6 space-y-2">
          <span className="text-xs font-mono font-bold text-foreground">
            Formatted Markdown Preview
          </span>
          <pre className="p-4 bg-background border-2 border-border rounded-tactile shadow-hard-sm font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap max-h-[560px]">
            {markdownContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
