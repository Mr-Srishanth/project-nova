/**
 * ProjectNova AI — Supabase Client Configuration & Session Gateway
 * Phase 20 Post-Roadmap Infrastructure Integration
 *
 * Implements:
 * - Environment detection: reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * - Safe fallback: if unconfigured, returns typed unconfigured state rather than throwing
 * - Client singleton for auth and database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables injected via Vite (client-safe publishable anon key only)
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  urlConfigured: boolean;
  anonKeyConfigured: boolean;
  mode: 'supabase_active' | 'local_fallback';
}

export function getSupabaseStatus(): SupabaseConfigStatus {
  const urlConfigured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith('http'));
  const anonKeyConfigured = Boolean(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20);
  const isConfigured = urlConfigured && anonKeyConfigured;

  return {
    isConfigured,
    urlConfigured,
    anonKeyConfigured,
    mode: isConfigured ? 'supabase_active' : 'local_fallback',
  };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const status = getSupabaseStatus();
  if (!status.isConfigured) {
    return null;
  }

  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('[ProjectNova Supabase] Failed to initialize Supabase client:', err);
    return null;
  }
}
