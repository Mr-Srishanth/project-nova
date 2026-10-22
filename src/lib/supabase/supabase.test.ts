import { describe, it, expect, beforeEach } from 'vitest';
import { getSupabaseStatus, getSupabaseClient } from './supabaseClient';
import { supabaseProjectStorage } from './supabaseProjectStorage';

describe('Post-Roadmap Infrastructure: Supabase Integration & Offline Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('detects Supabase configuration structure honestly', () => {
    const status = getSupabaseStatus();
    expect(status).toBeDefined();
    expect(status).toHaveProperty('isConfigured');
    expect(status).toHaveProperty('mode');
    expect(['supabase_active', 'local_fallback']).toContain(status.mode);
  });

  it('provides safe access to client without throwing unhandled exceptions', () => {
    const client = getSupabaseClient();
    if (getSupabaseStatus().isConfigured) {
      expect(client).toBeDefined();
    } else {
      expect(client).toBeNull();
    }
  });

  it('persists and retrieves projects reliably across storage adapters', async () => {
    const proj = await supabaseProjectStorage.create({
      name: 'Supabase Offline Test Project',
      description: 'Testing graceful local storage fallback',
      objective: 'Verify persistence without remote DB',
      category: 'Developer Tool',
      technologies: ['TypeScript', 'Supabase']
    });

    expect(proj).toBeDefined();
    expect(proj.name).toBe('Supabase Offline Test Project');

    // Retrieve via adapter
    const list = await supabaseProjectStorage.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list.find(p => p.id === proj.id)).toBeDefined();

    // Verify retrieval by ID
    const retrieved = await supabaseProjectStorage.getById(proj.id);
    expect(retrieved?.id).toBe(proj.id);
    expect(retrieved?.objective).toBe('Verify persistence without remote DB');
  }, 15000);
});
