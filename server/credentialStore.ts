export interface ProviderCredentials {
  geminiApiKey?: string;
  geminiModel?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  vercelToken?: string;
  netlifyToken?: string;
  githubToken?: string;
  updatedAt: string;
}

export interface CredentialStatusResponse {
  gemini: {
    isConfigured: boolean;
    model: string;
    source: "server_env" | "user_session" | "none";
  };
  supabase: {
    isConfigured: boolean;
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    source: "server_env" | "user_session" | "none";
  };
  vercel: {
    isConfigured: boolean;
    source: "server_env" | "user_session" | "none";
  };
  netlify: {
    isConfigured: boolean;
    source: "server_env" | "user_session" | "none";
  };
  github: {
    isConfigured: boolean;
    source: "server_env" | "user_session" | "none";
  };
}

class ServerCredentialStore {
  // In-memory session store keyed by sessionId
  private sessions: Map<string, ProviderCredentials> = new Map();

  // Master server env defaults
  private envGeminiKey = process.env.GEMINI_API_KEY || "";
  private envGeminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  private envSupabaseUrl = process.env.VITE_SUPABASE_URL || "";
  private envSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  private envVercelToken = process.env.VERCEL_TOKEN || "";
  private envNetlifyToken = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || "";
  private envGithubToken = process.env.GITHUB_TOKEN || "";

  /**
   * Sets or updates credentials for a specific session/user.
   */
  setSessionCredentials(
    sessionId: string,
    creds: Partial<ProviderCredentials>
  ): ProviderCredentials {
    const existing = this.sessions.get(sessionId) || {
      updatedAt: new Date().toISOString(),
    };

    const updated: ProviderCredentials = {
      ...existing,
      ...creds,
      updatedAt: new Date().toISOString(),
    };

    // Trim strings if provided
    if (updated.geminiApiKey !== undefined) updated.geminiApiKey = updated.geminiApiKey.trim();
    if (updated.geminiModel !== undefined) updated.geminiModel = updated.geminiModel.trim();
    if (updated.supabaseUrl !== undefined) updated.supabaseUrl = updated.supabaseUrl.trim();
    if (updated.supabaseAnonKey !== undefined) updated.supabaseAnonKey = updated.supabaseAnonKey.trim();
    if (updated.vercelToken !== undefined) updated.vercelToken = updated.vercelToken.trim();
    if (updated.netlifyToken !== undefined) updated.netlifyToken = updated.netlifyToken.trim();
    if (updated.githubToken !== undefined) updated.githubToken = updated.githubToken.trim();

    this.sessions.set(sessionId, updated);
    return updated;
  }

  /**
   * Clears specific session credentials.
   */
  clearSessionCredentials(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getVercelToken(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const token = this.sessions.get(sessionId)?.vercelToken;
      if (token) return token;
    }
    return this.envVercelToken;
  }

  getNetlifyToken(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const token = this.sessions.get(sessionId)?.netlifyToken;
      if (token) return token;
    }
    return this.envNetlifyToken;
  }

  getGithubToken(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const token = this.sessions.get(sessionId)?.githubToken;
      if (token) return token;
    }
    return this.envGithubToken;
  }

  /**
   * Resolves the active Gemini API key for a session.
   * Priority: Session Key > Server Environment Key
   */
  getGeminiApiKey(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const sessionKey = this.sessions.get(sessionId)?.geminiApiKey;
      if (sessionKey) return sessionKey;
    }
    return this.envGeminiKey;
  }

  /**
   * Resolves the active Gemini model for a session.
   */
  getGeminiModel(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const sessionModel = this.sessions.get(sessionId)?.geminiModel;
      if (sessionModel) return sessionModel;
    }
    return this.envGeminiModel;
  }

  /**
   * Resolves the active Supabase URL for a session.
   */
  getSupabaseUrl(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const url = this.sessions.get(sessionId)?.supabaseUrl;
      if (url) return url;
    }
    return this.envSupabaseUrl;
  }

  /**
   * Resolves the active Supabase Anon Key for a session.
   */
  getSupabaseAnonKey(sessionId?: string): string {
    if (sessionId && this.sessions.has(sessionId)) {
      const key = this.sessions.get(sessionId)?.supabaseAnonKey;
      if (key) return key;
    }
    return this.envSupabaseAnonKey;
  }

  /**
   * Returns a sanitized status report WITHOUT leaking actual secret values.
   */
  getStatus(sessionId?: string): CredentialStatusResponse {
    const session = sessionId ? this.sessions.get(sessionId) : undefined;

    let geminiConfigured = false;
    let geminiSource: "server_env" | "user_session" | "none" = "none";
    let model = this.envGeminiModel;

    if (session?.geminiApiKey) {
      geminiConfigured = true;
      geminiSource = "user_session";
      if (session.geminiModel) model = session.geminiModel;
    } else if (this.envGeminiKey) {
      geminiConfigured = true;
      geminiSource = "server_env";
    }

    let supabaseUrlConfigured = false;
    let supabaseAnonKeyConfigured = false;
    let supabaseSource: "server_env" | "user_session" | "none" = "none";

    if (session?.supabaseUrl || session?.supabaseAnonKey) {
      supabaseUrlConfigured = Boolean(session.supabaseUrl && session.supabaseUrl.startsWith("http"));
      supabaseAnonKeyConfigured = Boolean(session.supabaseAnonKey && session.supabaseAnonKey.length > 20);
      supabaseSource = "user_session";
    } else if (this.envSupabaseUrl || this.envSupabaseAnonKey) {
      supabaseUrlConfigured = Boolean(this.envSupabaseUrl && this.envSupabaseUrl.startsWith("http"));
      supabaseAnonKeyConfigured = Boolean(this.envSupabaseAnonKey && this.envSupabaseAnonKey.length > 20);
      supabaseSource = "server_env";
    }

    let vercelConfigured = false;
    let vercelSource: "server_env" | "user_session" | "none" = "none";
    if (session?.vercelToken) {
      vercelConfigured = true;
      vercelSource = "user_session";
    } else if (this.envVercelToken) {
      vercelConfigured = true;
      vercelSource = "server_env";
    }

    let netlifyConfigured = false;
    let netlifySource: "server_env" | "user_session" | "none" = "none";
    if (session?.netlifyToken) {
      netlifyConfigured = true;
      netlifySource = "user_session";
    } else if (this.envNetlifyToken) {
      netlifyConfigured = true;
      netlifySource = "server_env";
    }

    let githubConfigured = false;
    let githubSource: "server_env" | "user_session" | "none" = "none";
    if (session?.githubToken) {
      githubConfigured = true;
      githubSource = "user_session";
    } else if (this.envGithubToken) {
      githubConfigured = true;
      githubSource = "server_env";
    }

    return {
      gemini: {
        isConfigured: geminiConfigured,
        model,
        source: geminiSource,
      },
      supabase: {
        isConfigured: supabaseUrlConfigured && supabaseAnonKeyConfigured,
        urlConfigured: supabaseUrlConfigured,
        anonKeyConfigured: supabaseAnonKeyConfigured,
        source: supabaseSource,
      },
      vercel: {
        isConfigured: vercelConfigured,
        source: vercelSource,
      },
      netlify: {
        isConfigured: netlifyConfigured,
        source: netlifySource,
      },
      github: {
        isConfigured: githubConfigured,
        source: githubSource,
      },
    };
  }

  /**
   * Returns the exact resolved configuration for an export package.
   * STRICT ACCESS ONLY: Used only during server-side ZIP packaging with user confirmation.
   */
  getResolvedConfigForExport(sessionId?: string): {
    geminiApiKey?: string;
    geminiModel?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  } {
    return {
      geminiApiKey: this.getGeminiApiKey(sessionId),
      geminiModel: this.getGeminiModel(sessionId),
      supabaseUrl: this.getSupabaseUrl(sessionId),
      supabaseAnonKey: this.getSupabaseAnonKey(sessionId),
    };
  }
}

export const serverCredentialStore = new ServerCredentialStore();
