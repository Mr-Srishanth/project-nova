import type { OperationHistoryEntry } from "@/types/uiStudioHistory";

const HISTORY_STORAGE_KEY = "projectnova_ui_studio_operations_v1";

export interface IUIStudioHistoryStorage {
  list(projectId?: string): Promise<OperationHistoryEntry[]>;
  get(operationId: string): Promise<OperationHistoryEntry | null>;
  save(entry: OperationHistoryEntry): Promise<OperationHistoryEntry>;
  updateStatus(
    operationId: string,
    status: OperationHistoryEntry["status"],
    validationError?: string
  ): Promise<OperationHistoryEntry | null>;
  delete(operationId: string): Promise<boolean>;
  clear(projectId?: string): Promise<void>;
}

class LocalBrowserUIStudioHistoryStorage implements IUIStudioHistoryStorage {
  private getRaw(): OperationHistoryEntry[] {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[UI Studio History] Failed to parse history:", err);
      return [];
    }
  }

  private saveRaw(entries: OperationHistoryEntry[]): void {
    try {
      // Keep up to 100 historical operations
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(-100)));
    } catch (err) {
      console.error("[UI Studio History] Failed to save history to localStorage:", err);
    }
  }

  async list(projectId?: string): Promise<OperationHistoryEntry[]> {
    const all = this.getRaw();
    if (!projectId) return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return all
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async get(operationId: string): Promise<OperationHistoryEntry | null> {
    const all = this.getRaw();
    return all.find((e) => e.id === operationId) || null;
  }

  async save(entry: OperationHistoryEntry): Promise<OperationHistoryEntry> {
    const all = this.getRaw();
    const idx = all.findIndex((e) => e.id === entry.id);

    // Sanitize any secret patterns before persisting
    const sanitizedEntry: OperationHistoryEntry = {
      ...entry,
      items: entry.items.map((item) => ({
        ...item,
        proposedContent: item.proposedContent
          .replace(/GEMINI_API_KEY\s*=\s*['"][^'"]+['"]/gi, 'GEMINI_API_KEY="[REDACTED]"')
          .replace(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/gi, 'SUPABASE_SERVICE_ROLE_KEY="[REDACTED]"'),
      })),
    };

    if (idx >= 0) {
      all[idx] = sanitizedEntry;
    } else {
      all.push(sanitizedEntry);
    }

    this.saveRaw(all);
    return sanitizedEntry;
  }

  async updateStatus(
    operationId: string,
    status: OperationHistoryEntry["status"],
    validationError?: string
  ): Promise<OperationHistoryEntry | null> {
    const all = this.getRaw();
    const entry = all.find((e) => e.id === operationId);
    if (!entry) return null;

    entry.status = status;
    if (validationError !== undefined) {
      entry.validationError = validationError;
    }

    this.saveRaw(all);
    return entry;
  }

  async delete(operationId: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((e) => e.id !== operationId);
    if (filtered.length === all.length) return false;
    this.saveRaw(filtered);
    return true;
  }

  async clear(projectId?: string): Promise<void> {
    if (!projectId) {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return;
    }
    const all = this.getRaw();
    const filtered = all.filter((e) => e.projectId !== projectId);
    this.saveRaw(filtered);
  }
}

export const uiStudioHistoryStorage: IUIStudioHistoryStorage = new LocalBrowserUIStudioHistoryStorage();
