import React, { useState, useEffect, useMemo } from "react";
import {
  Brain,
  Plus,
  Search,
  CheckCircle,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Tag,
  Check,
  X,
  Sparkles,
  Archive,
  Eye,
} from "lucide-react";
import type {
  ProjectMemory,
  ProjectMemoryType,
  ProjectMemorySource,
  MemoryIntegrityFinding,
} from "@/types/memory";
import { brainStorage } from "@/lib/storage/brainStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { detectMemoryIntegrityFindings } from "@/lib/memory/integrityEngine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { RetrievalPreviewModal } from "@/components/memory/RetrievalPreviewModal";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

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
  lesson_learned: { label: "Lesson Learned", icon: <Sparkles className="w-3.5 h-3.5 text-purple-600" />, badgeVariant: "blue" },
  requirement: { label: "Requirement", icon: <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />, badgeVariant: "primary" },
  preference: { label: "Preference", icon: <Tag className="w-3.5 h-3.5 text-blue-500" />, badgeVariant: "muted" },
};

export const ProjectMemoryPage: React.FC = () => {
  const { activeProject } = useActiveProject();
  const selectedProjectId = activeProject?.id || "";

  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [findings, setFindings] = useState<MemoryIntegrityFinding[]>([]);

  // Filters
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [activeTab, setActiveTab] = useState<"memories" | "integrity">("memories");

  // Create form
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ProjectMemoryType>("decision");
  const [newSource, setNewSource] = useState<ProjectMemorySource>("user");
  const [newRationale, setNewRationale] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  // Simulator
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    if (selectedProjectId) {
      loadMemories(selectedProjectId);
    } else {
      setMemories([]);
      setFindings([]);
    }
  }, [selectedProjectId]);

  const loadMemories = async (projId: string) => {
    try {
      const list = await brainStorage.list(projId);
      setMemories(list);

      const artifacts = await artifactStorage.list(projId);
      const knownPaths = artifacts.map((a) => a.path);
      const detected = detectMemoryIntegrityFindings(list, { knownArtifactPaths: knownPaths });
      setFindings(detected);
    } catch (err) {
      console.error("Failed to load project memories:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !selectedProjectId) return;

    setSaving(true);
    try {
      await brainStorage.create({
        projectId: selectedProjectId,
        type: newType,
        title: newTitle.trim(),
        content: newContent.trim(),
        source: newSource,
        rationale: newRationale.trim() || undefined,
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });

      setNewTitle("");
      setNewContent("");
      setNewRationale("");
      setNewTags("");
      setIsAdding(false);
      await loadMemories(selectedProjectId);
    } catch (err) {
      console.error("Failed to create memory:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmProposal = async (id: string) => {
    await brainStorage.confirmProposal(id);
    await loadMemories(selectedProjectId);
  };

  const handleRejectProposal = async (id: string) => {
    await brainStorage.rejectProposal(id);
    await loadMemories(selectedProjectId);
  };

  const handleResolveQuestion = async (id: string) => {
    await brainStorage.resolveQuestion(id);
    await loadMemories(selectedProjectId);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Archive this project memory?")) {
      await brainStorage.update(id, { status: "archived" });
      await loadMemories(selectedProjectId);
    }
  };

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedStatus !== "all" && m.status !== selectedStatus) return false;
      if (selectedType !== "all" && m.type !== selectedType) return false;
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const match =
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)));
        if (!match) return false;
      }
      return true;
    });
  }, [memories, selectedStatus, selectedType, query]);

  // Statistics
  const stats = useMemo(() => {
    const verified = memories.filter((m) => m.verificationState === "user_confirmed").length;
    const proposals = memories.filter((m) => m.verificationState === "ai_proposed").length;
    const decisions = memories.filter((m) => m.type === "decision" && m.status === "active").length;
    const questions = memories.filter((m) => m.type === "open_question" && m.status === "active").length;
    return { verified, proposals, decisions, questions, total: memories.length };
  }, [memories]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300">
              <Brain className="w-3.5 h-3.5" />
              Project Brain & Memory
            </span>
            <span className="text-xs font-mono text-muted-foreground">Phase 12 Knowledge System</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Intelligent Project Memory
          </h1>
          <p className="text-sm text-secondary">
            Traceable architectural decisions, confirmed facts, contradiction resolution, and AI context alignment.
          </p>
        </div>

        {/* Global Project Indicator & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <CompactProjectIndicator />

          <Button
            onClick={() => setShowSimulator(true)}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            Retrieval Simulator
          </Button>

          <Button
            onClick={() => setIsAdding(!isAdding)}
            variant="primary"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border border-emerald-200 bg-emerald-50/40">
          <span className="text-xs font-semibold text-emerald-800">Verified Facts & Decisions</span>
          <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">{stats.verified}</p>
          <span className="text-[11px] text-emerald-700">User confirmed source</span>
        </Card>

        <Card className="p-3 border border-purple-200 bg-purple-50/40">
          <span className="text-xs font-semibold text-purple-800">Active Architectural Decisions</span>
          <p className="text-2xl font-bold font-mono text-purple-900 mt-1">{stats.decisions}</p>
          <span className="text-[11px] text-purple-700">Guiding project architecture</span>
        </Card>

        <Card className="p-3 border border-blue-200 bg-blue-50/40">
          <span className="text-xs font-semibold text-blue-800">AI Proposed Knowledge</span>
          <p className="text-2xl font-bold font-mono text-blue-900 mt-1">{stats.proposals}</p>
          <span className="text-[11px] text-blue-700">Awaiting user confirmation</span>
        </Card>

        <Card className="p-3 border border-amber-200 bg-amber-50/40">
          <span className="text-xs font-semibold text-amber-800">Integrity Findings</span>
          <p className="text-2xl font-bold font-mono text-amber-900 mt-1">{findings.length}</p>
          <span className="text-[11px] text-amber-700">Contradictions or stale refs</span>
        </Card>
      </div>

      {/* Create Memory Form */}
      {isAdding && (
        <Card className="p-4 border-2 border-primary bg-white shadow-hard-sm">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Record Project Memory</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Knowledge Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ProjectMemoryType)}
                  className="w-full text-xs p-1.5 border border-border rounded bg-white"
                >
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Provenance Source</label>
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value as ProjectMemorySource)}
                  className="w-full text-xs p-1.5 border border-border rounded bg-white"
                >
                  <option value="user">User Supplied (Confirmed)</option>
                  <option value="blueprint">Derived from Blueprint</option>
                  <option value="ai">AI Proposed</option>
                  <option value="execution">Derived from Execution</option>
                  <option value="document">Project Document</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Tags (comma-separated)</label>
                <Input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. auth, security, database"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. PostgreSQL with Drizzle ORM Selected"
                className="h-8 text-xs font-semibold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Content / Specification</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Describe the decision, fact, or constraint clearly..."
                rows={2}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Decision Rationale (Optional)</label>
              <Input
                value={newRationale}
                onChange={(e) => setNewRationale(e.target.value)}
                placeholder="Why was this choice made? Trade-offs considered..."
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)} className="h-7 text-xs">
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving} className="h-7 text-xs">
                {saving ? "Saving..." : "Save to Project Brain"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("memories")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "memories"
                ? "border-primary text-foreground bg-white/60"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Project Memories ({filteredMemories.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("integrity")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "integrity"
                ? "border-primary text-foreground bg-white/60"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Integrity & Conflicts ({findings.length})
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground font-mono hidden md:block">
          Project: {activeProject?.name || selectedProjectId}
        </div>
      </div>

      {/* Tab: Integrity & Conflicts */}
      {activeTab === "integrity" && (
        <div className="space-y-3">
          {findings.length === 0 ? (
            <Card className="p-8 text-center text-secondary border border-border">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
              <p className="font-bold text-foreground">Zero Contradictions Detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                All active decisions, requirements, and artifact references are mutually consistent.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => (
                <Card
                  key={f.id}
                  className={`p-4 border ${
                    f.severity === "high"
                      ? "border-red-300 bg-red-50/40"
                      : "border-amber-300 bg-amber-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            f.severity === "high"
                              ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {f.severity} severity
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{f.title}</h4>
                      </div>
                      <p className="text-xs text-secondary mt-1">{f.explanation}</p>
                      <div className="mt-2 bg-white/70 p-2 rounded border border-border text-xs text-foreground font-medium">
                        <span className="text-muted-foreground">Action: </span>
                        {f.suggestedAction}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Memory Browser */}
      {activeTab === "memories" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="p-3 border border-border bg-white flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search memories, tags, or decisions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs border border-border rounded bg-transparent focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <span>Category:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="border border-border rounded px-1.5 py-1 bg-transparent font-medium"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span>Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="border border-border rounded px-1.5 py-1 bg-transparent font-medium"
                >
                  <option value="active">Active Only</option>
                  <option value="superseded">Superseded</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                  <option value="all">All Statuses</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Memory List */}
          {filteredMemories.length === 0 ? (
            <Card className="p-8 text-center text-secondary border border-border">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-foreground">No Project Memories Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Knowledge" to record verified project facts, decisions, or constraints.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMemories.map((mem) => {
                const cfg = TYPE_CONFIG[mem.type] || TYPE_CONFIG.fact;

                return (
                  <Card
                    key={mem.id}
                    className={`p-4 border transition-colors ${
                      mem.status === "superseded"
                        ? "bg-slate-50/70 border-slate-200 opacity-70"
                        : mem.verificationState === "ai_proposed"
                        ? "bg-blue-50/30 border-blue-200"
                        : "bg-white border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono font-medium bg-secondary/10 text-foreground">
                            {cfg.icon}
                            {cfg.label}
                          </span>

                          {mem.verificationState === "user_confirmed" ? (
                            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                              ✓ Verified Fact
                            </span>
                          ) : mem.verificationState === "ai_proposed" ? (
                            <span className="text-[11px] font-mono text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded">
                              ✦ AI Proposal (Unconfirmed)
                            </span>
                          ) : null}

                          {mem.status !== "active" && (
                            <span className="text-[11px] font-mono text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded uppercase font-bold">
                              {mem.status}
                            </span>
                          )}

                          <span className="text-xs text-muted-foreground ml-auto font-mono">
                            v{mem.version || 1} • {new Date(mem.updatedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-foreground mt-1">{mem.title}</h4>
                        <p className="text-xs text-secondary mt-1 whitespace-pre-wrap">{mem.content}</p>

                        {mem.rationale && (
                          <div className="mt-2 text-xs bg-muted/20 p-2 rounded border border-border/60 text-secondary">
                            <span className="font-semibold text-foreground">Rationale: </span>
                            {mem.rationale}
                          </div>
                        )}

                        {mem.tags && mem.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {mem.tags.map((t) => (
                              <span key={t} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {mem.verificationState === "ai_proposed" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmProposal(mem.id)}
                              className="h-7 text-xs px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              title="Confirm proposal"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectProposal(mem.id)}
                              className="h-7 text-xs px-2 text-red-700 border-red-300 hover:bg-red-50"
                              title="Reject proposal"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}

                        {mem.type === "open_question" && mem.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveQuestion(mem.id)}
                            className="h-7 text-xs px-2 text-primary"
                          >
                            Mark Resolved
                          </Button>
                        )}

                        {mem.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(mem.id)}
                            className="p-1 text-muted-foreground hover:text-red-700 rounded transition-colors"
                            title="Archive memory"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Simulator Modal */}
      {showSimulator && (
        <RetrievalPreviewModal
          projectId={selectedProjectId}
          memories={memories}
          onClose={() => setShowSimulator(false)}
        />
      )}
    </div>
  );
};
