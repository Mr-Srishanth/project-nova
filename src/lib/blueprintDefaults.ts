import type { Blueprint } from "@/types/blueprint";
import { generateId } from "@/lib/utils";
import { detectProjectArchetype } from "@/lib/build/targetProjectBaseline";

export function generateDefaultBlueprint(
  projectId: string,
  projectName: string,
  technologies: string[],
  category = "Web Application",
  objective = "",
  description = ""
): Blueprint {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "project";

  const archetype = detectProjectArchetype({
    name: projectName,
    category,
    objective,
    description,
    technologies,
  });

  // Archetype 1: Car Racing / Vehicle Arcade Game
  if (archetype === "car_game") {
    return {
      id: generateId("bp"),
      projectId,
      title: `${projectName} Game Architecture Blueprint`,
      overview: `Interactive 2D Highway Car Racing & Arcade Game architecture for ${projectName}. Features high-performance HTML5 Canvas rendering, realistic physics and lane steering, continuous obstacle/traffic generation, bounding-box collision detection, real-time speed/distance telemetry, and game-over/restart state machines.`,
      problemStatement: `Users requesting arcade games require instant interactivity, responsive keyboard/touch steering, collision states, and high score tracking without complex external gaming engine dependencies.`,
      targetUsers: ["Arcade Game Players", "Casual Web Gamers", "Frontend Developers"],
      realWorldUseCase: `High-framerate 60 FPS highway driving simulation with dodging mechanics, nitro acceleration, high score persistence, and dynamic traffic hazards.`,
      features: {
        mvp: [
          "Interactive HTML5 60 FPS Canvas rendering loop with road scrolling",
          "Player car steering (Left, Right, Accelerate) via Keyboard & Touch Controls",
          "Procedural obstacle spawning with multi-lane traffic hazards",
          "Precise 2D AABB bounding-box collision detection",
          "Live score, distance, and speedometer telemetry display",
          "Start menu, game-over crash state, and instant restart loop",
        ],
        important: [
          "Local storage high score persistence",
          "Nitro boost acceleration with dynamic speed physics",
          "Multi-type obstacle vehicles (sports cars, trucks, road barriers)",
          "Touch-friendly on-screen steering controls for mobile devices",
        ],
        advanced: [
          "Web Audio API synthesized sound effects and engine rumble",
          "Day/night cycle and weather particle effects",
        ],
        optional: [
          "Global online leaderboard integration",
          "Custom vehicle skin and garage customizer",
        ],
      },
      techStack: [
        { layer: "Presentation & Game Canvas", tech: "HTML5 Canvas & React", why: "Zero-latency 60 FPS rendering with declarative state management." },
        { layer: "Styling & UI Shell", tech: "Tailwind CSS", why: "Modern high-contrast neon racing arcade aesthetic." },
        { layer: "Game Logic & Physics", tech: "TypeScript", why: "Strict typing for vector math, collision physics, and obstacle states." },
        { layer: "Build & Development Tooling", tech: "Vite", why: "Instant HMR development server and optimized production bundling." },
      ],
      architecture: {
        summary: "Game engine loop decoupled into an input handler, a physics & collision processor, and an HTML5 canvas renderer.",
        nodes: [
          { id: "input", label: "Input Controller", kind: "frontend", detail: "Keyboard (WASD/Arrows) & On-screen touch buttons" },
          { id: "engine", label: "Game Loop & State Machine", kind: "backend", detail: "60 FPS requestAnimationFrame loop & state management" },
          { id: "physics", label: "Physics & Collision Engine", kind: "api", detail: "AABB bounding box detection & lane positioning" },
          { id: "canvas", label: "Canvas Highway Renderer", kind: "frontend", detail: "Road curves, player car, headlights & obstacle sprites" },
        ],
        edges: [
          { from: "input", to: "engine", label: "Key & Touch Events" },
          { from: "engine", to: "physics", label: "Update Positions" },
          { from: "physics", to: "canvas", label: "Draw Entities" },
        ],
      },
      database: {
        entities: [
          {
            name: "game_scores",
            purpose: "Player high scores and telemetry session records",
            fields: [
              { name: "id", type: "uuid", key: "PK", note: "Primary identifier" },
              { name: "score", type: "integer", note: "Final score achieved" },
              { name: "distance_meters", type: "integer", note: "Total distance traveled" },
              { name: "max_speed_kmh", type: "integer", note: "Top speed reached" },
              { name: "achieved_at", type: "timestamp", note: "UTC timestamp" },
            ],
          },
        ],
        relationships: [],
        sql: `-- Car Game High Scores Schema
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER NOT NULL,
  distance_meters INTEGER NOT NULL,
  max_speed_kmh INTEGER NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_scores ON game_scores(score DESC);
`,
      },
      api: [
        { method: "GET", route: "/api/v1/scores", purpose: "Fetch top 10 player high scores" },
        { method: "POST", route: "/api/v1/scores", purpose: "Submit session score upon game over" },
      ],
      uiScreens: [
        { name: "Arcade Canvas HUD", purpose: "Main gameplay view with live speedometer, score, and road view", elements: ["HighwayCanvas", "Speedometer", "ScoreBadge"] },
        { name: "Start Menu Overlay", purpose: "Instructions, key controls guide, and start button", elements: ["StartButton", "ControlGuide", "HighScoreBadge"] },
        { name: "Game Over Modal", purpose: "Crash statistics, distance summary, and instant play again action", elements: ["CrashBanner", "ScoreSummary", "RestartButton"] },
      ],
      folderStructure: `${safeName}/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.tsx
│   ├── index.css
│   └── app/
│       └── App.tsx`,
      testingStrategy: [
        "Unit test collision detection math and AABB bounding-box overlaps",
        "Test score incrementation and speed boundary clamps",
        "End-to-end browser verification of game start, steering, and game-over loops",
      ],
      deploymentStrategy: [
        "Vite production build generating self-contained static HTML5 bundle",
        "CDN distribution for zero-latency client asset delivery",
      ],
      futureImprovements: [
        "Multiplayer ghost car racing over WebSockets",
        "Procedural track curve generator with hill elevations",
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  // Archetype 2: Hybrid Data Engineering Pipeline
  if (archetype === "data_pipeline") {
    return {
      id: generateId("bp"),
      projectId,
      title: `${projectName} Architecture Blueprint`,
      overview: `Hybrid Data Engineering & Observability Pipeline architecture for ${projectName}. Features a high-performance Python FastAPI & DuckDB event processing backend paired with a real-time Vite/React operational monitoring console.`,
      problemStatement: `Modern data teams require reproducible, verifiable ingestion and partitioning of streaming webhooks without complex JVM cluster overhead.`,
      targetUsers: ["Data Engineers", "Analytics Engineers", "DevOps Engineers"],
      realWorldUseCase: `Automated webhook event capture, schema validation, streaming DuckDB buffering, partitioned parquet writes, and live pipeline status dashboard.`,
      features: {
        mvp: [
          "FastAPI webhook receiver endpoint with signature verification",
          "DuckDB memory buffer & Parquet partitioner",
          "Vite/React real-time pipeline monitoring dashboard",
          "Automated schema validation & replay capability",
        ],
        important: [
          "Dead-letter queue for malformed JSON payloads",
          "Automated parquet compactor background worker",
          "Export metrics in Prometheus/OpenTelemetry format",
        ],
        advanced: [
          "Zero-copy Arrow flight streaming integration",
          "Distributed S3/GCS bucket sink dispatcher",
        ],
        optional: [
          "Slack/PagerDuty webhook alerts on ingestion drop",
          "Custom SQL analytics query runner in web console",
        ],
      },
      techStack: [
        { layer: "Ingestion & Core Engine", tech: "Python / FastAPI", why: "Asynchronous high-throughput webhook handling and native DuckDB integration." },
        { layer: "Analytical Engine", tech: "DuckDB & PyArrow", why: "Embedded columnar processing with blazing fast Parquet partitioning." },
        { layer: "Storage Sink", tech: "Apache Parquet / MinIO", why: "Columnar disk-partitioned format optimized for analytical queries." },
        { layer: "Operational UI", tech: "React / Vite / Tailwind CSS", why: "Lightweight, responsive dashboard for real-time ingestion health monitoring." },
      ],
      architecture: {
        summary: "Hybrid pipeline decoupled into a FastAPI event ingestion stream, a DuckDB batch partitioner, and a Vite/React monitoring UI.",
        nodes: [
          { id: "webhooks", label: "External Webhook Sources", kind: "external", detail: "HTTP POST event streams" },
          { id: "api_server", label: "FastAPI Ingestion Gateway", kind: "api", detail: "Async endpoint & signature verification" },
          { id: "duckdb_engine", label: "DuckDB Processing Engine", kind: "backend", detail: "In-memory buffer & Arrow vectorization" },
          { id: "parquet_sink", label: "Partitioned Parquet Storage", kind: "storage", detail: "Year/month/day partitioned files" },
          { id: "dashboard_ui", label: "Vite/React Monitoring UI", kind: "frontend", detail: "Real-time metrics & queue inspector" },
        ],
        edges: [
          { from: "webhooks", to: "api_server", label: "POST /events" },
          { from: "api_server", to: "duckdb_engine", label: "Batch Buffering" },
          { from: "duckdb_engine", to: "parquet_sink", label: "Write Parquet" },
          { from: "dashboard_ui", to: "api_server", label: "GET /metrics & /status" },
        ],
      },
      database: {
        entities: [
          {
            name: "pipeline_events",
            purpose: "Raw stream ingestion staging table in DuckDB",
            fields: [
              { name: "event_id", type: "uuid", key: "PK", note: "Unique event UUID" },
              { name: "event_type", type: "varchar", note: "Event categorization" },
              { name: "payload", type: "json", note: "Raw event payload" },
              { name: "ingested_at", type: "timestamp", note: "UTC timestamp" },
              { name: "partition_date", type: "date", note: "Date partition key" },
            ],
          },
        ],
        relationships: [],
        sql: `-- DuckDB Pipeline Lakehouse Schema
CREATE TABLE IF NOT EXISTS pipeline_events (
  event_id VARCHAR PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  payload JSON,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  partition_date DATE DEFAULT CURRENT_DATE
);
`,
      },
      api: [
        { method: "POST", route: "/api/v1/events", purpose: "Ingest external webhook event payloads" },
        { method: "GET", route: "/api/v1/health", purpose: "Pipeline buffer status and memory metrics" },
      ],
      uiScreens: [
        { name: "Pipeline Dashboard", purpose: "Ingestion throughput, buffer status, and partition inspector", elements: ["ThroughputChart", "BufferGauge", "PartitionViewer"] },
      ],
      folderStructure: `${safeName}/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
├── backend/
│   ├── main.py
│   └── engine.py
├── data/
│   └── schema.sql
└── src/
    ├── main.tsx
    ├── index.css
    └── app/
        ├── App.tsx
        └── router.tsx`,
      testingStrategy: [
        "Pytest unit tests for webhook signature validation and payload parsing",
        "Vitest component and hook testing for monitoring UI",
      ],
      deploymentStrategy: [
        "Multi-stage Dockerfile containing Python 3.11 runtime and static frontend bundle",
      ],
      futureImprovements: [
        "Cloud object storage sink (AWS S3 / Cloudflare R2 / GCS)",
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  // Archetype 3: Standard Web Application
  const techList = technologies.length > 0 ? technologies : ["React", "TypeScript", "Tailwind CSS", "Node.js", "PostgreSQL"];

  return {
    id: generateId("bp"),
    projectId,
    title: `${projectName} Architecture Blueprint`,
    overview: `Comprehensive architectural blueprint and system specification for ${projectName}. Designed for high cohesion, rapid iteration, and maintainable project lifecycle.`,
    problemStatement: `Modern teams require an organized, verifiable blueprint before writing code to prevent premature refactoring and tech debt.`,
    targetUsers: ["Full-Stack Developers", "Product Architects", "DevOps Engineers"],
    realWorldUseCase: `Enables automated task scheduling, consistent API definitions, and seamless execution verification.`,
    features: {
      mvp: [
        "Core Project Workspace with live state persistence",
        "Visual Interactive SVG Topology Diagram",
        "Database Schema DDL export and field verification",
        "Task checklist and milestone phase tracking",
      ],
      important: [
        "Hybrid Agent Orchestrator for controlled code modifications",
        "Automated Git commit snapshotting",
        "REST API mocking and endpoint validation",
      ],
      advanced: [
        "Live containerized preview sandbox",
        "Multi-model AI synthesis engine",
      ],
      optional: [
        "Third-party webhook dispatchers",
        "Legacy system database migrator",
      ],
    },
    techStack: [
      { layer: "Presentation", tech: techList[0] || "React", why: "Component modularity, predictable state, and rich ecosystem." },
      { layer: "Styling & UI", tech: "Tailwind CSS", why: "Utility-first design tokens with high-contrast tactile theme." },
      { layer: "Application State", tech: techList[1] || "TypeScript", why: "Compile-time strict typing and runtime contract safety." },
      { layer: "Persistence", tech: "Local Browser Adapter / PostgreSQL", why: "Zero-latency development mode with clean migration pathway." },
    ],
    architecture: {
      summary: "Three-tier architecture featuring decoupled frontend, resilient API gateway abstraction, and an isolated state engine.",
      nodes: [
        { id: "client", label: "Web Client UI", kind: "frontend", detail: "React SPA with tactile design system" },
        { id: "gateway", label: "API & Action Dispatcher", kind: "api", detail: "Typed contract routing & validation" },
        { id: "orchestrator", label: "Project OS Orchestrator", kind: "backend", detail: "Milestone engine & state coordinator" },
        { id: "storage", label: "Project State Engine", kind: "database", detail: "Structured metadata, blueprints & tasks" },
      ],
      edges: [
        { from: "client", to: "gateway", label: "HTTPS / REST" },
        { from: "gateway", to: "orchestrator", label: "RPC / Commands" },
        { from: "orchestrator", to: "storage", label: "Transactions" },
      ],
    },
    database: {
      entities: [
        {
          name: "projects",
          purpose: "Core entity holding project metadata and configuration",
          fields: [
            { name: "id", type: "uuid", key: "PK", note: "Primary identifier" },
            { name: "name", type: "text", note: "Unique human-readable project title" },
            { name: "status", type: "text", note: "active | completed | archived" },
            { name: "created_at", type: "timestamptz", note: "Creation timestamp" },
          ],
        },
        {
          name: "blueprints",
          purpose: "Stores architectural topology, schema specs and tiers",
          fields: [
            { name: "id", type: "uuid", key: "PK", note: "Primary identifier" },
            { name: "project_id", type: "uuid", key: "FK", note: "Foreign key to projects(id)" },
            { name: "spec", type: "jsonb", note: "Full structured blueprint payload" },
          ],
        },
      ],
      relationships: [
        "projects.id 1:1 blueprints.project_id",
        "projects.id 1:N milestones.project_id",
      ],
      sql: `-- ProjectNova Schema Initialization
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  category TEXT NOT NULL DEFAULT 'Web Application',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
`,
    },
    api: [
      { method: "GET", route: "/api/v1/projects", purpose: "List active projects sorted by updated date" },
      { method: "POST", route: "/api/v1/projects", purpose: "Create a new project workspace" },
      { method: "GET", route: "/api/v1/projects/:id/blueprint", purpose: "Fetch architectural blueprint specification" },
      { method: "PATCH", route: "/api/v1/projects/:id/tasks", purpose: "Batch update milestone task statuses" },
    ],
    uiScreens: [
      { name: "Overview Dashboard", purpose: "Project counts, recent status, and quick action launcher", elements: ["MetricCards", "ProjectGrid", "RecentActivity"] },
      { name: "Blueprint Studio", purpose: "Deep system specs, SVG flow visualizer, DDL scripts", elements: ["ArchitectureDiagram", "SchemaViewer", "ApiTable"] },
      { name: "Task Workspace", purpose: "Milestone management and execution progress tracker", elements: ["MilestoneList", "ProgressBar", "TaskCheckboxes"] },
    ],
    folderStructure: `${safeName}/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── api/
│   │   └── routes.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── service.ts
│   │   └── service.test.ts
│   └── db/
│       └── schema.sql`,
    testingStrategy: [
      "Unit test domain models and state storage adapters with Vitest",
      "Validate API schema contracts with schema assertions",
      "Execute automated end-to-end user navigation flows",
    ],
    deploymentStrategy: [
      "Continuous integration with automated linting & type checks",
      "Immutable static asset distribution on high-availability CDN",
      "Containerized microservices for background task execution",
    ],
    futureImprovements: [
      "Automated unit test generation based on API contracts",
      "Bi-directional sync with git repository file tree",
    ],
    updatedAt: new Date().toISOString(),
  };
}
