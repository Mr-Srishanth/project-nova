import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type { ReleaseRecord } from "@/types/release";
import type { ProjectDocument, DocumentType } from "@/types/document";

export interface DocGenerationContext {
  project: Project;
  artifacts: BuildArtifact[];
  assessment?: QualityAssessment | null;
  testPlans?: TestPlan[];
  release?: ReleaseRecord | null;
}

export function generateDeterministicDoc(
  type: DocumentType,
  context: DocGenerationContext
): Omit<ProjectDocument, "id" | "createdAt" | "updatedAt" | "versions" | "driftFindings"> {
  const { project, artifacts, testPlans, release } = context;
  const blueprint = project.blueprint;

  switch (type) {
    case "readme": {
      const techStackSummary = blueprint?.techStack
        ? blueprint.techStack.map((t) => `- **${t.layer}:** ${t.tech} (${t.why})`).join("\n")
        : project.technologies.map((t) => `- ${t}`).join("\n") || "_[Not documented]_";

      const isDataPipeline =
        project.category === "Data Engineering" ||
        project.name.toLowerCase().includes("pipeline") ||
        project.technologies.some((t) => ["python", "duckdb", "fastapi"].includes(t.toLowerCase()));

      const setupInstructions = isDataPipeline
        ? `### Prerequisites
- Python 3.10+ (with pip or venv)
- Node.js 18+ & npm

### 1. Environment Configuration
\`\`\`bash
# Copy safe environment template to active local .env
cp .env.example .env

# Configure PORT (default 8000), DATABASE_URL, and GEMINI_API_KEY if AI features are enabled
\`\`\`

### 2. Backend Installation & Run
\`\`\`bash
# Create Python virtual environment
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\\Scripts\\activate

# Install Python requirements
pip install -r requirements.txt

# Run FastAPI backend ingestion server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`

### 3. Frontend Monitoring UI
\`\`\`bash
# In a separate terminal:
npm install
npm run dev
# The monitoring console will run on http://localhost:5173
\`\`\`

### 4. Database Migrations & Data Setup
\`\`\`bash
# Initialize DuckDB/Postgres tables from schema.sql
# In Python or database client:
# DuckDB creates tables automatically upon first ingestion event
\`\`\``
        : `### Prerequisites
- Node.js 18+ & npm

### 1. Environment Configuration
\`\`\`bash
# Copy safe environment template to active local .env
cp .env.example .env

# For Supabase-backed projects, fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your dashboard
\`\`\`

### 2. Installation & Development
\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
# App will be accessible at http://localhost:5173
\`\`\`

### 3. Production Build
\`\`\`bash
# Typecheck & build distribution bundle
npm run build

# Preview production build locally
npm run preview
\`\`\`

### 4. Database Setup
If using Supabase/PostgreSQL, copy the SQL definitions from \`src/db/schema.sql\` or the Blueprint SQL tab into your Supabase SQL Editor and execute.`;

      const content = `# ${project.name}

> ${project.description || project.objective || "AI Project OS Workspace"}

---

## 🎯 Executive Overview
${blueprint?.overview || project.objective || "_[TODO: Overview not yet defined in blueprint]_"}

## 🛠️ Technology Stack
${techStackSummary}

## 📂 Source Structure & File Inventory
${artifacts.length > 0
  ? artifacts.map((a) => `- \`${a.path}\` — ${a.purpose} _[${a.status.toUpperCase()}]_`).join("\n")
  : "_[TODO: No artifacts registered yet in Build Studio]_"}

## 🚀 Installation & Runnable Development Commands
${setupInstructions}

## 🧪 Testing & Verification
${testPlans && testPlans.length > 0
  ? `Recorded ${testPlans.reduce((sum, p) => sum + p.testCases.length, 0)} test case(s) in Testing Lab.`
  : "_[TODO: No tests recorded in Testing Lab]_"}

---
_Document generated from ProjectNova Blueprint & File Plan sources._
`;

      return {
        projectId: project.id,
        title: `${project.name} README`,
        slug: "readme",
        type: "readme",
        status: "approved",
        summary: `Standard README overview for ${project.name}`,
        content,
        sourcesUsed: ["project.metadata", "project.blueprint", "build_artifacts"],
        isAiGenerated: false,
        linkedArtifactPaths: artifacts.map((a) => a.path),
        linkedBrainRecordIds: [],
      };
    }

    case "architecture": {
      const archSummary = blueprint?.architecture?.summary || "_[TODO: Architecture summary unverified]_";
      const nodes = blueprint?.architecture?.nodes || [];
      const edges = blueprint?.architecture?.edges || [];

      const diagramText = nodes.length > 0
        ? "```mermaid\ngraph TD\n" +
          nodes.map((n) => `  ${n.id}["${n.label} (${n.kind})"]`).join("\n") +
          "\n" +
          edges.map((e) => `  ${e.from} -->|${e.label}| ${e.to}`).join("\n") +
          "\n```"
        : "_[Not documented: No architectural nodes defined]_";

      const content = `# Architecture Overview: ${project.name}

## 🏛️ System Architecture Design
${archSummary}

## 📊 System Component Diagram
${diagramText}

## 🧩 Architectural Nodes Specification
${nodes.length > 0
  ? nodes.map((n) => `### ${n.label} (\`${n.kind}\`)\n- **Specification:** ${n.detail}`).join("\n\n")
  : "_[TODO: Define architectural nodes in Blueprint Studio]_"}

## 🔗 Storage & Persistence Topology
${blueprint?.database
  ? `- **Entities:** ${blueprint.database.entities.map((e) => e.name).join(", ") || "None"}\n- **Relationships:** ${blueprint.database.relationships.join("; ") || "None"}`
  : "_[Not documented: Database topology not defined]_"}
`;

      return {
        projectId: project.id,
        title: "System Architecture Specification",
        slug: "architecture",
        type: "architecture",
        status: "approved",
        summary: `Architecture nodes and topological blueprint for ${project.name}`,
        content,
        sourcesUsed: ["project.blueprint.architecture", "project.blueprint.database"],
        isAiGenerated: false,
        linkedArtifactPaths: artifacts.filter((a) => a.type === "schema" || a.type === "backend").map((a) => a.path),
        linkedBrainRecordIds: [],
      };
    }

    case "api_reference": {
      const endpoints = blueprint?.api || [];
      const endpointsDoc = endpoints.length > 0
        ? endpoints.map((ep) => `### \`${ep.method} ${ep.route}\`
- **Purpose:** ${ep.purpose}
- **Request Body:** \`${ep.request || "None"}\`
- **Response Format:** \`${ep.response || "200 OK JSON"}\``).join("\n\n")
        : "_[TODO: No API endpoints defined in Blueprint or inspected routes]_";

      const content = `# API Reference Guide: ${project.name}

## 🌐 Endpoints & Gateway Contracts
All API routes follow standard RESTful JSON conventions.

${endpointsDoc}

---
*Notice: API endpoints reflect blueprint specifications and verified route files.*
`;

      return {
        projectId: project.id,
        title: "REST API Reference",
        slug: "api_reference",
        type: "api_reference",
        status: "approved",
        summary: `API routes and contract specifications for ${project.name}`,
        content,
        sourcesUsed: ["project.blueprint.api"],
        isAiGenerated: false,
        linkedArtifactPaths: artifacts.filter((a) => a.type === "api").map((a) => a.path),
        linkedBrainRecordIds: [],
      };
    }

    case "database": {
      const entities = blueprint?.database?.entities || [];
      const sqlSchema = blueprint?.database?.sql || "_[TODO: No SQL schema generated]_";

      const entitiesDoc = entities.length > 0
        ? entities.map((ent) => `### Table: \`${ent.name}\`
_${ent.purpose}_
| Column | Type | Key | Note |
| :--- | :--- | :--- | :--- |
${ent.fields.map((f) => `| \`${f.name}\` | \`${f.type}\` | ${f.key || "—"} | ${f.note || "—"} |`).join("\n")}`).join("\n\n")
        : "_[Not documented: No database entities defined]_";

      const content = `# Database Schema Specification: ${project.name}

## 🗄️ Relational Entities
${entitiesDoc}

## 📜 Executable DDL SQL Schema
\`\`\`sql
${sqlSchema}
\`\`\`
`;

      return {
        projectId: project.id,
        title: "Database Schema Reference",
        slug: "database",
        type: "database",
        status: "approved",
        summary: `Entity relational models and DDL for ${project.name}`,
        content,
        sourcesUsed: ["project.blueprint.database"],
        isAiGenerated: false,
        linkedArtifactPaths: artifacts.filter((a) => a.type === "schema").map((a) => a.path),
        linkedBrainRecordIds: [],
      };
    }

    case "deployment": {
      const prereq = release?.deploymentPrerequisites;
      const content = `# Deployment & Operations Guide: ${project.name}

## 🚀 Target Environment
- **Platform:** ${prereq?.target || "Docker / Generic Node"}
- **Release Version:** ${release?.version || "v1.0.0"}

## 📦 Build Instructions
\`\`\`bash
${prereq?.buildCommands?.join("\n") || "npm run build"}
\`\`\`

${prereq?.databaseMigrationStep ? `## 🗃️ Database Migrations\n\`\`\`bash\n${prereq.databaseMigrationStep}\n\`\`\`\n` : ""}

## 🔍 Post-Deployment Verification
${prereq?.postDeploymentSmokeChecks?.map((s) => `- [ ] ${s}`).join("\n") || "- [ ] Inspect /health response 200 OK"}

## 🔄 Rollback Contingency
${prereq?.rollbackPlan || "Revert Docker image to previous tag."}
`;

      return {
        projectId: project.id,
        title: "Deployment & Operations Runbook",
        slug: "deployment",
        type: "deployment",
        status: "approved",
        summary: `Deployment runbook and verification checks for ${project.name}`,
        content,
        sourcesUsed: ["release.prerequisites"],
        isAiGenerated: false,
        linkedArtifactPaths: [],
        linkedBrainRecordIds: [],
      };
    }

    default: {
      return {
        projectId: project.id,
        title: `Project ${type.toUpperCase()}`,
        slug: type,
        type,
        status: "draft",
        summary: `Custom document for ${project.name}`,
        content: `# ${type.toUpperCase()}\n\n_[Author notes and project specifications here]_`,
        sourcesUsed: ["manual_authoring"],
        isAiGenerated: false,
        linkedArtifactPaths: [],
        linkedBrainRecordIds: [],
      };
    }
  }
}
