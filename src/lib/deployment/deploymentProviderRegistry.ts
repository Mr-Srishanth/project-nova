/**
 * ProjectNova AI - Deployment Provider Adapter Interface & Registry
 * Phase 16: Deployment Integrations & Release Orchestration
 *
 * Implements typed provider adapters for:
 * 1. Vercel Deployment API
 * 2. GitHub Actions Deployment Workflow
 *
 * Security & Integrity Guarantees:
 * - Credentials must NEVER be stored in frontend state or localStorage.
 * - Live calls require server-side token environment variables.
 * - When credentials or network access are unavailable, adapters report
 *   grounded diagnostic errors or 'unknown' status. They NEVER fabricate success.
 */

import {
  DeploymentProviderId,
  ProviderConnectionStatus,
  DeploymentStatus,
  DeploymentConfiguration,
  DeploymentApproval
} from '../../types/deployment';

export interface DispatchDeploymentParams {
  projectId: string;
  configuration: DeploymentConfiguration;
  sourceRevision: string;
  approval?: DeploymentApproval;
  idempotencyKey: string;
  authToken?: string; // Provided securely via server proxy or injected in test mocks
}

export interface DeploymentDispatchResult {
  status: DeploymentStatus;
  providerDeploymentId?: string;
  deploymentUrl?: string;
  rawResponse?: Record<string, any>;
  errorMessage?: string;
}

export interface DeploymentStatusPollResult {
  status: DeploymentStatus;
  providerStatusRaw?: string;
  deploymentUrl?: string;
  errorMessage?: string;
}

export interface IDeploymentProviderAdapter {
  readonly providerId: DeploymentProviderId;
  getConnectionStatus(): Promise<ProviderConnectionStatus>;
  dispatchDeployment(params: DispatchDeploymentParams): Promise<DeploymentDispatchResult>;
  pollDeploymentStatus(providerDeploymentId: string, config: DeploymentConfiguration, authToken?: string): Promise<DeploymentStatusPollResult>;
  cancelDeployment?(providerDeploymentId: string, config: DeploymentConfiguration, authToken?: string): Promise<{ cancelled: boolean; message: string }>;
}

/**
 * Sanitizes URLs to prevent SSRF and disallow loopback/private IP addresses.
 */
export function validateSafeDeploymentUrl(rawUrl: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { safe: false, reason: 'Protocol must be http: or https:' };
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return { safe: false, reason: 'Target hostname resides on private loopback network' };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }
}

/**
 * Vercel Deployment API Adapter
 */
export class VercelDeploymentAdapter implements IDeploymentProviderAdapter {
  readonly providerId: DeploymentProviderId = 'vercel';

  async getConnectionStatus(): Promise<ProviderConnectionStatus> {
    // Check if server-side Vercel token is available
    const hasServerToken = typeof process !== 'undefined' && Boolean(process.env?.VERCEL_TOKEN);
    return {
      providerId: 'vercel',
      name: 'Vercel Deployment Platform',
      version: 'v13',
      isConfigured: hasServerToken,
      isLiveVerified: false, // Requires real external call verification
      supportedEnvironments: ['preview', 'production'],
      supportedOperations: ['deploy_preview', 'deploy_production', 'poll_status', 'cancel'],
      authMechanism: 'server_env_token',
      credentialStatus: hasServerToken ? 'configured' : 'missing',
      diagnosticMessage: hasServerToken
        ? 'Server-side VERCEL_TOKEN detected.'
        : 'Missing VERCEL_TOKEN in server environment. Deployments will require server configuration.'
    };
  }

  async dispatchDeployment(params: DispatchDeploymentParams): Promise<DeploymentDispatchResult> {
    const token = params.authToken || (typeof process !== 'undefined' ? process.env?.VERCEL_TOKEN : undefined);
    if (!token) {
      return {
        status: 'failed',
        errorMessage: 'Vercel authorization token missing. Privileged operations are restricted to secure server environments.'
      };
    }

    if (!params.configuration.providerProjectId) {
      return {
        status: 'failed',
        errorMessage: 'Vercel project ID is required in deployment configuration.'
      };
    }

    try {
      const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: params.configuration.providerProjectId,
          target: params.configuration.targetEnvironment === 'production' ? 'production' : undefined,
          gitSource: {
            type: 'github',
            ref: params.configuration.sourceBranch,
            sha: params.sourceRevision
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          status: 'failed',
          errorMessage: `Vercel API error (${response.status}): ${errorBody?.error?.message || response.statusText}`
        };
      }

      const data = await response.json();
      return {
        status: 'queued',
        providerDeploymentId: data.id,
        deploymentUrl: data.url ? `https://${data.url}` : undefined,
        rawResponse: { id: data.id, readyState: data.readyState }
      };
    } catch (err: any) {
      return {
        status: 'unknown',
        errorMessage: `Network error communicating with Vercel API: ${err?.message || String(err)}`
      };
    }
  }

  async pollDeploymentStatus(
    providerDeploymentId: string,
    _config: DeploymentConfiguration,
    authToken?: string
  ): Promise<DeploymentStatusPollResult> {
    const token = authToken || (typeof process !== 'undefined' ? process.env?.VERCEL_TOKEN : undefined);
    if (!token) {
      return {
        status: 'unknown',
        errorMessage: 'Cannot query Vercel status: Missing authorization token'
      };
    }

    try {
      const response = await fetch(`https://api.vercel.com/v13/deployments/${providerDeploymentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return {
          status: 'unknown',
          errorMessage: `Vercel status check returned HTTP ${response.status}`
        };
      }

      const data = await response.json();
      let status: DeploymentStatus = 'unknown';

      switch (data.readyState) {
        case 'QUEUED':
          status = 'queued';
          break;
        case 'BUILDING':
        case 'INITIALIZING':
          status = 'building';
          break;
        case 'READY':
          status = 'succeeded';
          break;
        case 'ERROR':
          status = 'failed';
          break;
        case 'CANCELED':
          status = 'cancelled';
          break;
      }

      return {
        status,
        providerStatusRaw: data.readyState,
        deploymentUrl: data.url ? `https://${data.url}` : undefined
      };
    } catch (err: any) {
      return {
        status: 'unknown',
        errorMessage: `Polling error: ${err?.message || String(err)}`
      };
    }
  }

  async cancelDeployment(
    providerDeploymentId: string,
    _config: DeploymentConfiguration,
    authToken?: string
  ): Promise<{ cancelled: boolean; message: string }> {
    const token = authToken || (typeof process !== 'undefined' ? process.env?.VERCEL_TOKEN : undefined);
    if (!token) {
      return { cancelled: false, message: 'Missing token for cancellation' };
    }

    try {
      const response = await fetch(`https://api.vercel.com/v12/deployments/${providerDeploymentId}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return {
        cancelled: response.ok,
        message: response.ok ? 'Vercel deployment cancelled' : `Cancellation failed with HTTP ${response.status}`
      };
    } catch (e: any) {
      return { cancelled: false, message: `Cancellation exception: ${e?.message || String(e)}` };
    }
  }
}

/**
 * GitHub Actions Workflow Deployment Adapter
 */
export class GitHubActionsDeploymentAdapter implements IDeploymentProviderAdapter {
  readonly providerId: DeploymentProviderId = 'github_actions';

  async getConnectionStatus(): Promise<ProviderConnectionStatus> {
    const hasServerToken = typeof process !== 'undefined' && Boolean(process.env?.GITHUB_TOKEN);
    return {
      providerId: 'github_actions',
      name: 'GitHub Actions Workflow Dispatch',
      version: 'v3',
      isConfigured: hasServerToken,
      isLiveVerified: false,
      supportedEnvironments: ['preview', 'staging', 'production'],
      supportedOperations: ['deploy_preview', 'deploy_production', 'poll_status', 'cancel'],
      authMechanism: 'server_env_token',
      credentialStatus: hasServerToken ? 'configured' : 'missing',
      diagnosticMessage: hasServerToken
        ? 'Server-side GITHUB_TOKEN configured.'
        : 'Missing GITHUB_TOKEN in server environment. Workflow dispatch disabled.'
    };
  }

  async dispatchDeployment(params: DispatchDeploymentParams): Promise<DeploymentDispatchResult> {
    const token = params.authToken || (typeof process !== 'undefined' ? process.env?.GITHUB_TOKEN : undefined);
    if (!token) {
      return {
        status: 'failed',
        errorMessage: 'GitHub Actions deployment requires a server-side GITHUB_TOKEN.'
      };
    }

    const repo = params.configuration.providerProjectId; // e.g. "octocat/hello-world"
    if (!repo || !repo.includes('/')) {
      return {
        status: 'failed',
        errorMessage: "GitHub repository must be specified in format 'owner/repo'."
      };
    }

    const workflow = params.configuration.workflowFileName || 'deploy.yml';

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: params.configuration.sourceBranch,
          inputs: {
            environment: params.configuration.targetEnvironment,
            revision: params.sourceRevision,
            idempotency_key: params.idempotencyKey
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'failed',
          errorMessage: `GitHub Actions dispatch rejected (${response.status}): ${errorText.slice(0, 200)}`
        };
      }

      // GitHub returns 204 No Content for workflow dispatch
      return {
        status: 'queued',
        providerDeploymentId: `gha-${Date.now()}-${params.idempotencyKey.slice(0, 8)}`,
        rawResponse: { dispatched: true, workflow }
      };
    } catch (err: any) {
      return {
        status: 'unknown',
        errorMessage: `Network error dispatching GitHub Actions: ${err?.message || String(err)}`
      };
    }
  }

  async pollDeploymentStatus(
    _providerDeploymentId: string,
    config: DeploymentConfiguration,
    authToken?: string
  ): Promise<DeploymentStatusPollResult> {
    const token = authToken || (typeof process !== 'undefined' ? process.env?.GITHUB_TOKEN : undefined);
    if (!token) {
      return {
        status: 'unknown',
        errorMessage: 'Missing GITHUB_TOKEN to poll workflow status'
      };
    }

    const repo = config.providerProjectId;
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return { status: 'unknown', errorMessage: `Failed to list runs: HTTP ${response.status}` };
      }

      const data = await response.json();
      const runs = data.workflow_runs || [];
      if (runs.length === 0) {
        return { status: 'queued', providerStatusRaw: 'waiting' };
      }

      const latestRun = runs[0];
      let status: DeploymentStatus = 'unknown';

      if (latestRun.status === 'queued') status = 'queued';
      else if (latestRun.status === 'in_progress') status = 'building';
      else if (latestRun.status === 'completed') {
        if (latestRun.conclusion === 'success') status = 'succeeded';
        else if (latestRun.conclusion === 'failure') status = 'failed';
        else if (latestRun.conclusion === 'cancelled') status = 'cancelled';
      }

      return {
        status,
        providerStatusRaw: `${latestRun.status}:${latestRun.conclusion || 'pending'}`,
        deploymentUrl: latestRun.html_url
      };
    } catch (e: any) {
      return { status: 'unknown', errorMessage: `Poll exception: ${e?.message || String(e)}` };
    }
  }
}

/**
 * Netlify Deployment API Adapter
 */
export class NetlifyDeploymentAdapter implements IDeploymentProviderAdapter {
  readonly providerId: DeploymentProviderId = 'netlify';

  async getConnectionStatus(): Promise<ProviderConnectionStatus> {
    const hasServerToken = typeof process !== 'undefined' && Boolean(process.env?.NETLIFY_AUTH_TOKEN || process.env?.NETLIFY_TOKEN);
    return {
      providerId: 'netlify',
      name: 'Netlify Edge Platform',
      version: 'v1',
      isConfigured: hasServerToken,
      isLiveVerified: false,
      supportedEnvironments: ['preview', 'production'],
      supportedOperations: ['deploy_preview', 'deploy_production', 'poll_status', 'cancel'],
      authMechanism: 'server_env_token',
      credentialStatus: hasServerToken ? 'configured' : 'missing',
      diagnosticMessage: hasServerToken
        ? 'Server-side NETLIFY_AUTH_TOKEN detected.'
        : 'Missing NETLIFY_AUTH_TOKEN in server environment. Deployments will require server configuration.'
    };
  }

  async dispatchDeployment(params: DispatchDeploymentParams): Promise<DeploymentDispatchResult> {
    const token = params.authToken || (typeof process !== 'undefined' ? (process.env?.NETLIFY_AUTH_TOKEN || process.env?.NETLIFY_TOKEN) : undefined);
    if (!token) {
      return {
        status: 'failed',
        errorMessage: 'Netlify personal access token missing. Privileged operations are restricted to secure server environments.'
      };
    }

    const siteId = params.configuration.providerProjectId;
    if (!siteId) {
      return {
        status: 'failed',
        errorMessage: 'Netlify site ID (or site name) is required in deployment configuration.'
      };
    }

    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/builds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clear_cache: false
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          status: 'failed',
          errorMessage: `Netlify API error (${response.status}): ${errorBody?.message || response.statusText}`
        };
      }

      const data = await response.json();
      return {
        status: 'queued',
        providerDeploymentId: data.id || data.deploy_id,
        deploymentUrl: data.deploy_ssl_url || data.ssl_url || undefined,
        rawResponse: { id: data.id, deploy_id: data.deploy_id }
      };
    } catch (err: any) {
      return {
        status: 'unknown',
        errorMessage: `Network error communicating with Netlify API: ${err?.message || String(err)}`
      };
    }
  }

  async pollDeploymentStatus(
    providerDeploymentId: string,
    _config: DeploymentConfiguration,
    authToken?: string
  ): Promise<DeploymentStatusPollResult> {
    const token = authToken || (typeof process !== 'undefined' ? (process.env?.NETLIFY_AUTH_TOKEN || process.env?.NETLIFY_TOKEN) : undefined);
    if (!token) {
      return {
        status: 'unknown',
        errorMessage: 'Cannot query Netlify status: Missing authorization token'
      };
    }

    try {
      const response = await fetch(`https://api.netlify.com/api/v1/deploys/${providerDeploymentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return {
          status: 'unknown',
          errorMessage: `Netlify status check returned HTTP ${response.status}`
        };
      }

      const data = await response.json();
      let status: DeploymentStatus = 'unknown';

      switch (data.state) {
        case 'enqueued':
        case 'processing':
          status = 'queued';
          break;
        case 'building':
        case 'uploading':
          status = 'building';
          break;
        case 'ready':
          status = 'succeeded';
          break;
        case 'error':
          status = 'failed';
          break;
        case 'canceled':
        case 'skipped':
          status = 'cancelled';
          break;
      }

      return {
        status,
        providerStatusRaw: data.state,
        deploymentUrl: data.ssl_url || data.url
      };
    } catch (err: any) {
      return {
        status: 'unknown',
        errorMessage: `Polling error: ${err?.message || String(err)}`
      };
    }
  }

  async cancelDeployment(
    providerDeploymentId: string,
    _config: DeploymentConfiguration,
    authToken?: string
  ): Promise<{ cancelled: boolean; message: string }> {
    const token = authToken || (typeof process !== 'undefined' ? (process.env?.NETLIFY_AUTH_TOKEN || process.env?.NETLIFY_TOKEN) : undefined);
    if (!token) {
      return { cancelled: false, message: 'Missing token for cancellation' };
    }

    try {
      const response = await fetch(`https://api.netlify.com/api/v1/deploys/${providerDeploymentId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return {
        cancelled: response.ok,
        message: response.ok ? 'Netlify deployment cancelled' : `Cancellation failed with HTTP ${response.status}`
      };
    } catch (e: any) {
      return { cancelled: false, message: `Cancellation exception: ${e?.message || String(e)}` };
    }
  }
}

/**
 * Provider Adapter Registry
 */
class DeploymentProviderRegistry {
  private adapters = new Map<DeploymentProviderId, IDeploymentProviderAdapter>();

  constructor() {
    this.register(new VercelDeploymentAdapter());
    this.register(new NetlifyDeploymentAdapter());
    this.register(new GitHubActionsDeploymentAdapter());
  }

  register(adapter: IDeploymentProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: DeploymentProviderId): IDeploymentProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  list(): IDeploymentProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const deploymentProviderRegistry = new DeploymentProviderRegistry();
