import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type { ReleaseRecord } from "@/types/release";
import type { ProjectDocument, DocumentType } from "@/types/document";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { releaseStorage } from "@/lib/storage/releaseStorage";
import { documentStorage } from "@/lib/storage/documentStorage";
import { generateDeterministicDoc } from "@/lib/docs/docGenerator";
import { detectDocumentDrift } from "@/lib/docs/driftDetector";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DocListSidebar } from "@/components/docs/DocListSidebar";
import { DocWorkbench } from "@/components/docs/DocWorkbench";
import { generateId } from "@/lib/utils";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

export const DocsStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject: selectedProject, projects, loading } = useActiveProject();
  const selectedProjectId = selectedProject?.id || "";

  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [assessment, setAssessment] = useState<QualityAssessment | null>(null);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [syncingDrift, setSyncingDrift] = useState(false);

  // Load project docs & reference sources
  useEffect(() => {
    if (!selectedProjectId) {
      setDocuments([]);
      setArtifacts([]);
      return;
    }

    Promise.all([
      documentStorage.list(selectedProjectId),
      artifactStorage.list(selectedProjectId),
      qualityStorage.getLatestAssessment(selectedProjectId),
      qualityStorage.listTestPlans(selectedProjectId),
      releaseStorage.getLatest(selectedProjectId),
    ]).then(async ([storedDocs, storedArtifacts, storedAssess, storedPlans, storedRel]) => {
      setArtifacts(storedArtifacts);
      setAssessment(storedAssess);
      setTestPlans(storedPlans);
      setRelease(storedRel);

      if (storedDocs.length === 0 && selectedProject) {
        // Automatically generate initial core documentation suite
        const context = {
          project: selectedProject,
          artifacts: storedArtifacts,
          assessment: storedAssess,
          testPlans: storedPlans,
          release: storedRel,
        };

        const initialTypes: DocumentType[] = ["readme", "architecture", "api_reference", "database"];
        const created: ProjectDocument[] = [];

        for (const type of initialTypes) {
          const docData = generateDeterministicDoc(type, context);
          const newDoc: ProjectDocument = {
            ...docData,
            id: generateId("doc_"),
            versions: [],
            driftFindings: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const saved = await documentStorage.save(newDoc);
          created.push(saved);
        }

        setDocuments(created);
        if (created.length > 0) setSelectedDocId(created[0].id);
      } else {
        setDocuments(storedDocs);
        if (storedDocs.length > 0 && !selectedDocId) {
          setSelectedDocId(storedDocs[0].id);
        }
      }
    });
  }, [selectedProjectId, selectedProject]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) || null,
    [documents, selectedDocId]
  );

  const handleGenerateTemplate = async (type: DocumentType) => {
    if (!selectedProject) return;
    const docData = generateDeterministicDoc(type, {
      project: selectedProject,
      artifacts,
      assessment,
      testPlans,
      release,
    });

    const newDoc: ProjectDocument = {
      ...docData,
      id: generateId("doc_"),
      versions: [],
      driftFindings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await documentStorage.save(newDoc);
    setDocuments((prev) => [saved, ...prev]);
    setSelectedDocId(saved.id);
  };

  const handleSaveDoc = async (newContent: string, summary: string) => {
    if (!selectedDoc || !selectedProject) return;
    const updated = await documentStorage.recordVersion(
      selectedProject.id,
      selectedDoc.id,
      newContent,
      summary,
      "user"
    );
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
  };

  const handleRevertVersion = async (versionNumber: number) => {
    if (!selectedDoc || !selectedProject) return;
    const reverted = await documentStorage.revertToVersion(
      selectedProject.id,
      selectedDoc.id,
      versionNumber
    );
    if (reverted) {
      setDocuments((prev) => prev.map((d) => (d.id === reverted.id ? reverted : d)));
    }
  };

  // Run living drift detection across all docs
  const handleScanLivingDrift = async () => {
    if (!selectedProject) return;
    setSyncingDrift(true);

    const envNames = release?.envVariables.map((v) => v.name) || [];
    const updatedDocs: ProjectDocument[] = [];

    for (const doc of documents) {
      const findings = detectDocumentDrift({
        document: doc,
        artifacts,
        blueprint: selectedProject.blueprint,
        documentedEnvVars: envNames,
      });

      const updated = await documentStorage.updateDriftFindings(selectedProject.id, doc.id, findings);
      if (updated) updatedDocs.push(updated);
    }

    setDocuments(updatedDocs);
    setSyncingDrift(false);
  };

  const handleDismissDrift = async (driftId: string) => {
    if (!selectedDoc || !selectedProject) return;
    const updatedFindings = selectedDoc.driftFindings.map((f) =>
      f.id === driftId ? { ...f, status: "dismissed" as const } : f
    );
    const updated = await documentStorage.updateDriftFindings(
      selectedProject.id,
      selectedDoc.id,
      updatedFindings
    );
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
  };

  const handleResolveDrift = async (driftId: string) => {
    if (!selectedDoc || !selectedProject) return;
    const updatedFindings = selectedDoc.driftFindings.map((f) =>
      f.id === driftId ? { ...f, status: "resolved" as const } : f
    );
    const updated = await documentStorage.updateDriftFindings(
      selectedProject.id,
      selectedDoc.id,
      updatedFindings
    );
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
  };

  const handleDownloadDoc = () => {
    if (!selectedDoc) return;
    const blob = new Blob([selectedDoc.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDoc.slug || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Documentation Studio…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <BookOpen className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Documentation
          </h2>
          <p className="text-sm text-foreground-muted">
            Create a project first to synthesize and maintain living architectural documentation.
          </p>
          <Button onClick={() => navigate("/discover")} icon={<ArrowRight className="w-4 h-4" />}>
            Start Discovery
          </Button>
        </div>
      </Card>
    );
  }

  const totalDriftCount = documents.reduce(
    (acc, d) => acc + (d.driftFindings?.filter((f) => f.status === "open").length || 0),
    0
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary-soft text-primary rounded-tactile border border-primary/20">
              PHASE 8 ENGINE
            </span>
            <span className="text-xs text-foreground-muted">
              Living Documentation & Project Knowledge Center
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Documentation Studio
          </h1>
          <p className="text-sm text-foreground-muted">
            Source-grounded system specifications, architectural diagrams, API guides, and drift synchronization.
          </p>
        </div>

        {/* Global Active Project Indicator */}
        <div className="w-full sm:w-auto">
          <CompactProjectIndicator />
        </div>
      </div>

      {/* Top Knowledge Overview Card */}
      <Card className="p-4 bg-surface border-2 border-border shadow-hard">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-tactile bg-secondary-soft text-secondary border border-secondary/20 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground">
                Knowledge Synchronization Hub: {selectedProject?.name}
              </span>
              <p className="text-xs text-foreground-muted">
                {documents.length} verified documentation records registered • {totalDriftCount} potential drift finding(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScanLivingDrift}
              disabled={syncingDrift || documents.length === 0}
              icon={<RotateCw className={`w-3.5 h-3.5 ${syncingDrift ? "animate-spin" : ""}`} />}
            >
              {syncingDrift ? "Checking Drift…" : "Check Living Drift"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Workbench: Left Doc List, Right Editor/Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        <div className="lg:col-span-4 xl:col-span-3">
          <DocListSidebar
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={(id) => setSelectedDocId(id)}
            onGenerateTemplate={handleGenerateTemplate}
          />
        </div>

        <div className="lg:col-span-8 xl:col-span-9">
          {selectedDoc ? (
            <DocWorkbench
              document={selectedDoc}
              onSave={handleSaveDoc}
              onRevertVersion={handleRevertVersion}
              onDismissDrift={handleDismissDrift}
              onResolveDrift={handleResolveDrift}
              onDownload={handleDownloadDoc}
            />
          ) : (
            <Card className="h-full flex items-center justify-center p-12 text-center bg-surface">
              <div className="space-y-2 text-foreground-muted">
                <FileText className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-bold">No document selected</p>
                <p className="text-xs">
                  Choose a document from the left list or generate a new template to inspect and edit.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
