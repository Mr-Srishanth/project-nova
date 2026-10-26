import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Trash2,
  FileCode2,
  CheckCircle2,
} from "lucide-react";
import type { Project } from "@/types/project";
import { projectStorage } from "@/lib/storage/projectStorage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const ProjectsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await projectStorage.list();
      setProjects(data);
    } catch (err: any) {
      // Previously a failed list() left the loading spinner up forever
      // with no error and no retry — surface it instead.
      setLoadError(err?.message || "Could not load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This action removes the project and its blueprint from your workspace.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    await projectStorage.delete(id);
    await loadProjects();
    setDeletingId(null);
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase()) ||
      p.technologies.some((t) => t.toLowerCase().includes(query.toLowerCase()));

    const matchesStatus = statusFilter === "all" ? true : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Project Workspaces
          </h1>
          <p className="text-xs md:text-sm font-sans text-foreground-muted">
            Manage your projects, open active blueprints, and monitor milestone progression.
          </p>
        </div>
        <Button
          onClick={() => navigate("/discover")}
          icon={<Plus className="w-4 h-4" />}
        >
          New Project
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-foreground-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, description, or technology…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border-2 border-border rounded-tactile text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground shadow-hard-sm placeholder:text-foreground-muted/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-muted shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface border-2 border-border rounded-tactile px-3 py-2 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground shadow-hard-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Project Cards List */}
      {loading ? (
        <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
          <p className="text-sm font-mono text-foreground-muted">Loading your projects…</p>
        </div>
      ) : loadError ? (
        <div className="p-16 text-center border-2 border-red-300 rounded-tactile bg-surface shadow-hard space-y-4">
          <p className="text-sm font-mono text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
            Retry
          </Button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="text-center py-16 bg-surface shadow-hard">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
              <FolderKanban className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground">
              {query || statusFilter !== "all" ? "No Matching Projects" : "No Projects in Registry"}
            </h3>
            <p className="text-xs md:text-sm text-foreground-muted">
              {query || statusFilter !== "all"
                ? "Try adjusting your search criteria or filter to locate what you are looking for."
                : "Create your first project to unlock the Blueprint Studio, execution tasks, and architecture visualizer."}
            </p>
            {query || statusFilter !== "all" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/discover")}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Project
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => (
            <Card
              key={p.id}
              interactive
              onClick={() => navigate(`/projects/${p.id}`)}
              className="space-y-4 bg-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-base text-foreground">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="blue">{p.category}</Badge>
                    <span className="text-[11px] font-mono text-foreground-muted">
                      Created {formatDate(p.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "completed" ? "primary" : "yellow"}>
                    {p.status.toUpperCase()}
                  </Badge>
                  <button
                    onClick={(e) => handleDelete(p.id, p.name, e)}
                    disabled={deletingId === p.id}
                    title="Delete project"
                    aria-label={`Delete ${p.name}`}
                    className="p-1.5 text-foreground-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30 rounded-tactile-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs font-sans text-foreground leading-relaxed line-clamp-2">
                {p.description || p.objective}
              </p>

              <div className="space-y-2 pt-2 border-t border-border/10">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground-muted">Blueprint Spec:</span>
                  <span className="text-foreground font-semibold flex items-center gap-1">
                    <FileCode2 className="w-3.5 h-3.5 text-accent-blue-strong" />
                    {p.blueprint ? "Structured Spec Ready" : "Uninitialized"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground-muted">Milestones:</span>
                  <span className="text-foreground font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    {p.milestones.length} Defined
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {p.technologies.map((t, i) => (
                  <Badge key={i} variant="muted">{t}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
