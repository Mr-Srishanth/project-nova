# ProjectNova AI

An independent, hybrid-autonomous AI Project Operating System.

Takes projects from idea through discovery, architectural blueprinting, execution milestones, quality verification, and deployment.

---

## Architecture & Technology Stack

- **Framework:** React 18.3 + TypeScript + Vite 5.4
- **Styling & Design System:** Tailwind CSS with tactile ivory/navy tokens, hard offset shadows (`4px 4px 0 #153A52`), and responsive layouts
- **State & Storage:** Typed domain models (`Project`, `Blueprint`, `Milestone`, `Task`) backed by an isolated browser storage adapter with graceful error handling
- **Visual Topology:** Pure responsive SVG Architecture Flow Diagram (`ArchitectureDiagram.tsx`)
- **Testing:** Vitest + Happy-DOM

---

## Getting Started

### Prerequisites

- Node.js >= 18 or Bun runtime
- Git

### Installation

```bash
bun install
# or: npm install
```

### Running Locally

```bash
bun run dev
# or: npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Test Suite

```bash
bun run test
# or: npm run test
```

### Production Build

```bash
bun run build
# or: npm run build
```

---

## Phase 2 Core Deliverables

- [x] Clean initialization with zero SkillNova runtime coupling
- [x] Locked tactile Ivory/Navy/Green visual system & design tokens
- [x] Responsive Application Shell & Navigation
- [x] Overview dashboard powered by live project storage
- [x] Project Discovery & manual / template creation flow
- [x] Project Workspace with metadata editor & milestone task tracker
- [x] Blueprint Studio with interactive SVG system topology diagram & DDL generator
- [x] Automated unit test suite for local storage persistence
