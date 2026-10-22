import React from "react";
import {
  FileText,
  BookOpen,
  Layers,
  Database,
  FlaskConical,
  Rocket,
  Plus,
  Compass,
  AlertTriangle,
} from "lucide-react";
import type { ProjectDocument, DocumentType } from "@/types/document";
import { Button } from "@/components/ui/Button";

interface DocListSidebarProps {
  documents: ProjectDocument[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onGenerateTemplate: (type: DocumentType) => void;
}

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  readme: <BookOpen className="w-3.5 h-3.5 text-accent-blue" />,
  architecture: <Layers className="w-3.5 h-3.5 text-primary" />,
  setup: <Compass className="w-3.5 h-3.5 text-secondary" />,
  api_reference: <FileText className="w-3.5 h-3.5 text-accent-blue-strong" />,
  database: <Database className="w-3.5 h-3.5 text-accent-yellow" />,
  testing: <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />,
  deployment: <Rocket className="w-3.5 h-3.5 text-primary" />,
  contributing: <FileText className="w-3.5 h-3.5 text-foreground-muted" />,
  decision_record: <FileText className="w-3.5 h-3.5 text-foreground-muted" />,
  custom: <FileText className="w-3.5 h-3.5 text-foreground-muted" />,
};

export const DocListSidebar: React.FC<DocListSidebarProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  onGenerateTemplate,
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Header and Add dropdown / actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-foreground">
          DOCUMENTS ({documents.length})
        </span>
        <div className="relative group">
          <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />}>
            New Doc
          </Button>
          <div className="absolute right-0 top-full mt-1 w-48 bg-surface border-2 border-border rounded-tactile shadow-hard py-1 hidden group-hover:block z-20 text-xs">
            <button
              onClick={() => onGenerateTemplate("readme")}
              className="w-full text-left px-3 py-1.5 hover:bg-background flex items-center gap-2"
            >
              <BookOpen className="w-3.5 h-3.5 text-accent-blue" />
              <span>Project README</span>
            </button>
            <button
              onClick={() => onGenerateTemplate("architecture")}
              className="w-full text-left px-3 py-1.5 hover:bg-background flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Architecture Spec</span>
            </button>
            <button
              onClick={() => onGenerateTemplate("api_reference")}
              className="w-full text-left px-3 py-1.5 hover:bg-background flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-accent-blue" />
              <span>API Reference</span>
            </button>
            <button
              onClick={() => onGenerateTemplate("database")}
              className="w-full text-left px-3 py-1.5 hover:bg-background flex items-center gap-2"
            >
              <Database className="w-3.5 h-3.5 text-accent-yellow" />
              <span>Database DDL</span>
            </button>
            <button
              onClick={() => onGenerateTemplate("deployment")}
              className="w-full text-left px-3 py-1.5 hover:bg-background flex items-center gap-2"
            >
              <Rocket className="w-3.5 h-3.5 text-primary" />
              <span>Deployment Runbook</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
        {documents.map((doc) => {
          const isSelected = doc.id === selectedDocId;
          const openDriftCount = doc.driftFindings?.filter((d) => d.status === "open").length || 0;

          return (
            <button
              key={doc.id}
              onClick={() => onSelectDoc(doc.id)}
              className={`w-full flex items-center justify-between p-2.5 rounded-tactile text-left transition-all border-2 ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-hard-sm"
                  : "bg-surface text-foreground border-border hover:bg-background"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={isSelected ? "text-primary-foreground" : "text-foreground"}>
                  {TYPE_ICONS[doc.type] || <FileText className="w-3.5 h-3.5" />}
                </span>
                <div className="truncate">
                  <span className="block font-bold text-xs truncate">{doc.title}</span>
                  <span
                    className={`block text-[10px] font-mono truncate ${
                      isSelected ? "text-primary-foreground/80" : "text-foreground-muted"
                    }`}
                  >
                    {doc.type.toUpperCase()} • {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {openDriftCount > 0 && (
                <span
                  title={`${openDriftCount} potential drift finding(s)`}
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? "bg-white text-navy-deep"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {openDriftCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
