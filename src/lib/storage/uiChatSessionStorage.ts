import type { AIConversationMessage } from "@/types/uiStudio";

const SESSIONS_STORAGE_KEY = "projectnova_ui_studio_chat_sessions_v1";

export interface UIChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AIConversationMessage[];
}

export interface IUIChatSessionStorage {
  list(projectId: string): Promise<UIChatSession[]>;
  get(sessionId: string): Promise<UIChatSession | null>;
  save(session: UIChatSession): Promise<UIChatSession>;
  delete(sessionId: string): Promise<boolean>;
  clear(projectId: string): Promise<void>;
}

class LocalBrowserUIChatSessionStorage implements IUIChatSessionStorage {
  private getRaw(): UIChatSession[] {
    try {
      if (typeof window === "undefined" || !window.localStorage) return [];
      const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s) => s && typeof s === "object" && typeof s.id === "string" && typeof s.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[UI Studio Chat Storage] Failed to parse sessions:", err);
      return [];
    }
  }

  private saveRaw(sessions: UIChatSession[]): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      // Keep up to 50 historical chat sessions
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(-50)));
    } catch (err) {
      console.error("[UI Studio Chat Storage] Failed to save sessions to localStorage:", err);
    }
  }

  async list(projectId: string): Promise<UIChatSession[]> {
    const all = this.getRaw();
    return all
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(sessionId: string): Promise<UIChatSession | null> {
    const all = this.getRaw();
    return all.find((s) => s.id === sessionId) || null;
  }

  async save(session: UIChatSession): Promise<UIChatSession> {
    const all = this.getRaw();
    const idx = all.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      all[idx] = session;
    } else {
      all.push(session);
    }
    this.saveRaw(all);
    return session;
  }

  async delete(sessionId: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((s) => s.id !== sessionId);
    if (filtered.length !== all.length) {
      this.saveRaw(filtered);
      return true;
    }
    return false;
  }

  async clear(projectId: string): Promise<void> {
    const all = this.getRaw();
    const filtered = all.filter((s) => s.projectId !== projectId);
    this.saveRaw(filtered);
  }
}

export const uiChatSessionStorage = new LocalBrowserUIChatSessionStorage();
