# ProjectNova AI — Production Deployment & Operations Guide
## Phase 20 Final Release Documentation

### 1. Architectural Architecture & Runtime Topology

ProjectNova AI operates as a split-architecture system designed for security, auditability, and deterministic software engineering governance:

```
[ Browser Client UI (SPA) ]  <--- CORS / JSON --->  [ Node.js AI Gateway (Port 4000) ]
        |                                                     |
  LocalStorage                                            Google Gemini API
  (Project-scoped storage)                                (Server-side GEMINI_API_KEY)
```

1. **Client Single Page Application (Vite + React 18 + TailwindCSS + Lucide)**:
   - Renders the user workspaces across all 20 modules (Blueprint Studio, Project Brain, Build Studio, Quality Engine, Execution Center, System Health, Repository Intelligence, Code Review, Test Automation, Deployments, Monitoring, Visual Workflows, and Multi-Agent Workspaces).
   - Zero secrets are embedded in client bundles.
   - All state is persisted in project-isolated browser local storage with schema migration and corruption recovery guards.
2. **AI Provider Gateway Runtime (`server/gateway.ts`)**:
   - Secure Node HTTP server (default port `4000`).
   - Acts as an authenticated proxy to LLM providers (Google Gemini 1.5 Flash).
   - Enforces strict input validation, 1MB payload caps, CORS origin restrictions, path-traversal prevention, and error message secret redaction.

---

### 2. Environment Configuration

#### Server-Only Environment Variables (Protected Runtime)
These variables MUST be configured in the secure server environment (e.g. systemd service, container environment, or `.env.server`). They are **never** bundled or exposed to the client:

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `4000` | Port for the AI Gateway HTTP server |
| `GEMINI_API_KEY` | **Required** | `""` | Google Gemini API Key for model inference |
| `GEMINI_MODEL` | Optional | `gemini-1.5-flash` | Gemini model target version |
| `NODE_ENV` | Optional | `production` | Runtime mode. In production, strict CORS origin checks are enforced |

#### Client-Safe Environment Variables (Public UI)
| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_AI_GATEWAY_URL` | Optional | `http://localhost:4000` | Target URL for the AI gateway backend |

> **Security Mandate**: Never prefix secret keys with `VITE_`. Any variable starting with `VITE_` is automatically baked into public static JavaScript assets.

---

### 3. Build & Startup Commands

#### Production Build
```bash
# Clean TypeScript compilation and Vite minification
bun run build
# Or via npm
npm run build
```

#### Starting the AI Gateway Server
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export NODE_ENV="production"
bun run server/gateway.ts
# Or with Node
node --loader ts-node/esm server/gateway.ts
```

#### Serving the Static Client Assets
Serve the generated `dist/` directory with any production web server (Nginx, Caddy, Cloudflare Pages, Vercel, or AWS S3 + CloudFront).

---

### 4. Verified Health Check Endpoints

The AI Gateway provides a grounded health check endpoint:
- **`GET /api/ai/health`**
  - **Status 200 OK**:
    ```json
    {
      "status": "ok",
      "provider": "gemini",
      "model": "gemini-1.5-flash",
      "hasKey": true
    }
    ```
  - When `GEMINI_API_KEY` is not present, returns `status: "unconfigured"` with `hasKey: false`. The application enters **Local Safe Mode** without throwing unhandled exceptions.

---

### 5. Deployment Governance & Approval Policies

1. **Strict Input Binding**:
   - Deployment approvals (`DeploymentApproval`) strictly bind the `projectId`, `configurationId`, `targetEnvironment`, `boundSourceRevision`, and `boundPreflightReportId`.
   - Modifying any of these parameters invalidates the authorization token.
2. **SSRF Guard**:
   - Webhook targets and health observation URLs are validated against private IP blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.1`, `localhost`) to prevent Server-Side Request Forgery.
3. **Agent Self-Approval Prevention**:
   - In Multi-Agent Teaming, `canApproveOwnProposals` is an unalterable architectural invariant set to `false`. Agents cannot approve their own generated diffs or deployment requests.

---

### 6. Persistence & Scalability Limitations (Release Notes)

- **Browser Storage Persistence**: Single-user local storage adapter (`localStorage`) is active by default. It provides robust project isolation, bounded retention (capping event histories at 300-500 entries), and corrupted JSON recovery backups.
- **Production Enterprise Blocker**: For shared multi-user enterprise operations, a shared PostgreSQL / cloud database adapter must be configured to supersede local browser storage.
- **Provider Status Polling**: Real deployments poll verified provider endpoints; simulated passes are strictly prohibited.
