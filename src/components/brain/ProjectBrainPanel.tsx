import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Plus,
  Search,
  CheckCircle,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Trash2,
  Tag,
  Save,
} from "lucide-react";
import type { ProjectMemory, ProjectMemoryType, ProjectMemorySource } from "@/types/memory";
import { brainStorage } from "@/lib/storage/brainStorage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface ProjectBrainPanelProps {
  projectId: string;
  projectName: string;
}

const TYPE_CONFIG: Record<
  ProjectMemoryType,
  { label: string; icon: React.ReactNode; badgeVariant: "primary" | "blue" | "yellow" | "danger" | "muted" }
> = {
  decision: { label: "Decision", icon: <CheckCircle className="w-3.5 h-3.5 text-primary" />, badgeVariant: "primary" },
  fact: { label: "Confirmed Fact", icon: <Lightbulb className="w-3.5 h-3.5 text-accent-blue" />, badgeVariant: "blue" },
  constraint: { label: "Constraint", icon: <ShieldAlert className="w-3.5 h-3.5 text-accent-yellow" />, badgeVariant: "yellow" },
  risk: { label: "Known Risk", icon: <AlertTriangle className="w-3.5 h-3.5 text-danger" />, badgeVariant: "danger" },
  open_question: { label: "Open Question", icon: <HelpCircle className="w-3.5 h-3.5 text-foreground-muted" />, badgeVariant: "muted" },
  summary: { label: "Summary", icon: <Brain className="w-3.5 h-3.5 text-foreground" />, badgeVariant: "muted" },
  lesson_learned: { label: "Lesson Learned", icon: <Lightbulb className="w-3.5 h-3.5 text-accent-blue" />, badgeVariant: "blue" },
  requirement: { label: "Requirement", icon: <ShieldAlert className="w-3.5 h-3.5 text-accent-yellow" />, badgeVariant: "yellow" },
  preference: { label: "Preference", icon: <Tag className="w-3.5 h-3.5 text-primary" />, badgeVariant: "muted" },
};

export const ProjectBrainPanel: React.FC<ProjectBrainPanelProps> = ({ projectId, projectName }) => {
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Create form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ProjectMemoryType>("decision");
  const [newSource, setNewSource] = useState<ProjectMemorySource>("user");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    const list = await brainStorage.list(projectId);
    setMemories(list);
    setLoading(false);
  };

  useEffect(() => {
    loadMemories();
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSaving(true);
    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await brainStorage.create({
      projectId,
      type: newType,
      title: newTitle.trim(),
      content: newContent.trim(),
      source: newSource,
      tags,
    });

    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setIsAdding(false);
    setSaving(false);
    await loadMemories();
  };

  const handleDelete = async (id: string, title: string) => {
    const confirm = window.confirm(`Remove memory "${title}" from Project Brain?`);
    if (!confirm) return;

    await brainStorage.delete(id);
    await loadMemories();
  };

  const filtered = memories.filter((m) => {
    const matchesType = selectedType === "all" || m.type === selectedType;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)));
    return matchesType && matchesQuery;
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b-2 border-border/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-bold text-foreground">Project Brain</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-tactile-sm bg-accent-blue/20 text-foreground border border-border">
              {memories.length} Memories Stored
            </span>
          </div>
          <p className="text-xs font-sans text-foreground-muted mt-0.5">
            Persistent technical memory, confirmed decisions, constraints, and open risks scoped to {projectName}.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          {isAdding ? "Close Form" : "Record Memory"}
        </Button>
      </div>

      {/* Add Memory Box with Framer Motion slide-in */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="bg-[#FAF7ED] border-2 border-border shadow-hard space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <span className="font-display font-bold text-xs uppercase tracking-wider text-foreground">
                  Record New Project Knowledge
                </span>
                <span className="text-[11px] font-mono text-foreground-muted">Persisted in Project Memory</span>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Memory Title / Header *"
                    placeholder="e.g. Reject GraphQL in favor of REST API"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />

                  <div className="space-y-1">
                    <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                      Memory Classification
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as ProjectMemoryType)}
                      className="w-full bg-surface border-2 border-border rounded-tactile px-3 py-2 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="decision">Architectural Decision</option>
                      <option value="fact">Confirmed Fact</option>
                      <option value="constraint">Technical Constraint</option>
                      <option value="risk">Known Risk</option>
                      <option value="open_question">Open Question</option>
                      <option value="summary">Summary</option>
                    </select>
                  </div>
                </div>

                <Textarea
                  label="Detailed Technical Rationale *"
                  placeholder="Explain why this decision was made, what trade-offs were considered, or the exact constraint details..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={2}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Tags (comma-separated)"
                    placeholder="e.g. database, security, api"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                  />

                  <div className="space-y-1">
                    <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                      Knowledge Source
                    </label>
                    <select
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value as ProjectMemorySource)}
                      className="w-full bg-surface border-2 border-border rounded-tactile px-3 py-2 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="user">User Confirmed</option>
                      <option value="blueprint">Blueprint Specification</option>
                      <option value="ai">AI Architectural Review</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => setIsAdding(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" disabled={saving} icon={<Save className="w-3.5 h-3.5" />}>
                    {saving ? "Saving…" : "Save to Brain"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search decisions, constraints, or tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border-2 border-border rounded-tactile text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground shadow-hard-sm"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-surface border-2 border-border rounded-tactile px-3 py-1.5 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground shadow-hard-sm"
        >
          <option value="all">All Classifications</option>
          <option value="decision">Decisions</option>
          <option value="fact">Facts</option>
          <option value="constraint">Constraints</option>
          <option value="risk">Risks</option>
          <option value="open_question">Open Questions</option>
        </select>
      </div>

      {/* Memory Cards Grid */}
      {loading ? (
        <div className="p-8 text-center border-2 border-border rounded-tactile bg-surface">
          <p className="text-xs font-mono text-foreground-muted">Loading project memory…</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-10 bg-surface shadow-hard">
          <div className="max-w-sm mx-auto space-y-2">
            <Brain className="w-8 h-8 text-foreground-muted mx-auto" />
            <h4 className="font-display font-bold text-sm text-foreground">
              {query || selectedType !== "all" ? "No Matching Memories" : "Project Brain is Empty"}
            </h4>
            <p className="text-xs font-sans text-foreground-muted">
              Record key decisions, tech constraints, or approved facts so the ProjectNova AI Assistant stays grounded in your actual specifications.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {filtered.map((item) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.summary;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="bg-surface border-2 border-border shadow-hard space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground">
                          {cfg.icon}
                          <span>{item.title}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="text-foreground-muted hover:text-danger p-1 rounded transition-colors"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-sans text-foreground leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-border/10 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={cfg.badgeVariant}>{cfg.label.toUpperCase()}</Badge>
                        <span className="text-foreground-muted">Source: {item.source}</span>
                      </div>
                      <span className="text-foreground-muted">{formatDate(item.createdAt)}</span>
                    </div>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FAF7ED] border border-border/40 text-foreground-muted"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
