/**
 * Client for interacting with ProjectNova Server Gateway for Deployment & Git operations.
 */

import { GATEWAY_ORIGIN } from "../gatewayBase";

export interface ServerGitStatus {
  isGit: boolean;
  currentBranch: string;
  hasRemote: boolean;
  remotes: { name: string; url: string }[];
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  changedFiles: { path: string; status: string; isSecret: boolean }[];
  originUrl: string | null;
}

export interface ServerCredentialStatus {
  vercelConfigured: boolean;
  vercelSource: "server_env" | "user_session" | "none";
  netlifyConfigured: boolean;
  netlifySource: "server_env" | "user_session" | "none";
  githubConfigured: boolean;
  githubSource: "server_env" | "user_session" | "none";
}

const GATEWAY_URL = GATEWAY_ORIGIN;

export const deploymentApiClient = {
  async getGitStatus(): Promise<ServerGitStatus> {
    const res = await fetch(`${GATEWAY_URL}/api/repo/git-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      throw new Error(`Failed to inspect git status: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getProviderCredentialStatus(sessionId?: string): Promise<ServerCredentialStatus> {
    const res = await fetch(`${GATEWAY_URL}/api/ai/health`, {
      headers: sessionId ? { "x-session-id": sessionId } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to check provider credentials: HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      vercelConfigured: Boolean(data?.credentials?.vercelConfigured),
      vercelSource: data?.credentials?.vercelSource || "none",
      netlifyConfigured: Boolean(data?.credentials?.netlifyConfigured),
      netlifySource: data?.credentials?.netlifySource || "none",
      githubConfigured: Boolean(data?.credentials?.githubConfigured),
      githubSource: data?.credentials?.githubSource || "none",
    };
  },

  async saveProviderToken(params: {
    sessionId: string;
    vercelToken?: string;
    netlifyToken?: string;
    githubToken?: string;
  }): Promise<void> {
    const res = await fetch(`${GATEWAY_URL}/api/settings/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save credentials: HTTP ${res.status}`);
    }
  },

  async dispatchDeployment(params: {
    providerId: "vercel" | "netlify";
    projectId: string;
    configuration: any;
    sourceRevision?: string;
    sessionId?: string;
  }): Promise<{
    status: string;
    providerDeploymentId?: string;
    deploymentUrl?: string;
    raw?: any;
    error?: string;
  }> {
    const res = await fetch(`${GATEWAY_URL}/api/deploy/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: params.providerId,
        projectId: params.projectId,
        configuration: params.configuration,
        sourceRevision: params.sourceRevision || "HEAD",
        idempotencyKey: `idemp_${Date.now()}`,
        sessionId: params.sessionId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Deployment dispatch failed (HTTP ${res.status})`);
    }
    return data;
  },

  async pollDeploymentStatus(params: {
    providerId: "vercel" | "netlify";
    providerDeploymentId: string;
    sessionId?: string;
  }): Promise<{
    status: string;
    providerStatusRaw?: string;
    deploymentUrl?: string;
    error?: string;
  }> {
    const res = await fetch(`${GATEWAY_URL}/api/deploy/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Deployment status check failed (HTTP ${res.status})`);
    }
    return data;
  },
};
