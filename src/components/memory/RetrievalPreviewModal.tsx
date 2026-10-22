import React, { useState } from "react";
import type { ProjectMemory, AssembledMemoryContext } from "@/types/memory";
import { retrieveRelevantMemories } from "@/lib/memory/retrievalEngine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Search, Sparkles, AlertCircle } from "lucide-react";

interface RetrievalPreviewModalProps {
  projectId: string;
  memories: ProjectMemory[];
  onClose: () => void;
}

export const RetrievalPreviewModal: React.FC<RetrievalPreviewModalProps> = ({
  projectId,
  memories,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [budget, setBudget] = useState<number>(4000);

  const preview: AssembledMemoryContext = retrieveRelevantMemories(memories, {
    projectId,
    query: query.trim() || undefined,
    targetCategory: category || undefined,
    maxBudgetChars: budget,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border-2 border-border shadow-hard-lg">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">AI Context Retrieval Simulator</h3>
              <p className="text-xs text-muted-foreground">
                Inspect which memories are packed into AI prompts and why. Zero external AI calls executed.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Close
          </Button>
        </div>

        {/* Query Controls */}
        <div className="p-4 bg-muted/20 border-b border-border grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Simulated prompt keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-white focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-white focus:outline-none focus:border-primary"
            >
              <option value="">All Categories (Standard Packing)</option>
              <option value="decision">Decisions Only</option>
              <option value="constraint">Constraints Only</option>
              <option value="requirement">Requirements Only</option>
              <option value="fact">Facts Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">Budget Ceiling:</span>
            <input
              type="number"
              min={500}
              max={8000}
              step={500}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 4000)}
              className="w-24 px-2 py-1 text-xs border border-border rounded bg-white text-center font-mono"
            />
            <span className="text-muted-foreground">chars</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Budget Meter */}
          <div className="bg-white p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Context Budget Utilization</span>
              <span className="font-mono text-muted-foreground">
                {preview.budgetUsedChars} / {preview.maxBudgetChars} chars (
                {Math.round((preview.budgetUsedChars / preview.maxBudgetChars) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-secondary/15 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  preview.isTruncated ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (preview.budgetUsedChars / preview.maxBudgetChars) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Selected: {preview.selectedMemories.length} / {preview.totalAvailable} active memories</span>
              {preview.isTruncated && (
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {preview.omittedCount} low-priority memor(ies) truncated
                </span>
              )}
            </div>
          </div>

          {/* Ranked Memory Cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Ranked Selection Order
            </h4>
            <div className="space-y-2">
              {preview.selectedMemories.map((item, idx) => (
                <div
                  key={item.memory.id}
                  className="p-3 bg-white border border-border rounded-md hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary/10 font-bold uppercase">
                          #{idx + 1} {item.memory.type}
                        </span>
                        <h5 className="text-xs font-bold text-foreground truncate">{item.memory.title}</h5>
                      </div>
                      <p className="text-xs text-secondary mt-1">{item.memory.content}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                        Score {item.relevanceScore}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                    <span className="text-emerald-700 font-semibold">Selection reason: </span>
                    {item.retrievalReason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assembled Prompt Output */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Generated Prompt Context Block
            </h4>
            <pre className="text-xs font-mono bg-muted/30 p-3 rounded-md border border-border whitespace-pre-wrap break-all text-secondary max-h-48 overflow-y-auto">
              {preview.contextText || "(No active memories packed)"}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
};
