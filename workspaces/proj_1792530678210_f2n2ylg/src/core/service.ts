/**
 * PortfolioHub Core Service
 * 
 * Provides core business logic, state management triggers, and service orchestration
 * for the PortfolioHub application adhering to strict TypeScript standards.
 */

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class PortfolioService {
  private items: Map<string, PortfolioItem>;

  constructor(initialItems: PortfolioItem[] = []) {
    this.items = new Map<string, PortfolioItem>();
    initialItems.forEach(item => this.items.set(item.id, item));
  }

  /**
   * Retrieves all portfolio items.
   */
  public getAllItems(): ServiceResult<PortfolioItem[]> {
    try {
      const data = Array.from(this.items.values());
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
    }
  }

  /**
   * Retrieves a single portfolio item by its unique identifier.
   */
  public getItemById(id: string): ServiceResult<PortfolioItem> {
    try {
      const item = this.items.get(id);
      if (!item) {
        return { success: false, error: `Item with id ${id} not found.` };
      }
      return { success: true, data: item };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
    }
  }

  /**
   * Creates and registers a new portfolio item.
   */
  public createItem(input: Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>): ServiceResult<PortfolioItem> {
    try {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      const now = new Date();
      const newItem: PortfolioItem = {
        id,
        ...input,
        createdAt: now,
        updatedAt: now,
      };

      this.items.set(id, newItem);
      return { success: true, data: newItem };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
    }
  }

  /**
   * Updates an existing portfolio item.
   */
  public updateItem(id: string, updates: Partial<Omit<PortfolioItem, 'id' | 'createdAt'>>): ServiceResult<PortfolioItem> {
    try {
      const existing = this.items.get(id);
      if (!existing) {
        return { success: false, error: `Item with id ${id} not found for update.` };
      }

      const updatedItem: PortfolioItem = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      this.items.set(id, updatedItem);
      return { success: true, data: updatedItem };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
    }
  }

  /**
   * Deletes a portfolio item by its unique identifier.
   */
  public deleteItem(id: string): ServiceResult<boolean> {
    try {
      if (!this.items.has(id)) {
        return { success: false, error: `Item with id ${id} not found for deletion.` };
      }
      const deleted = this.items.delete(id);
      return { success: true, data: deleted };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
    }
  }
}

export const defaultPortfolioService = new PortfolioService();
