/**
 * ProjectNova AI — Supabase Auth (email + password only)
 *
 * Small wrapper around supabase-js auth. No new provider is configured here:
 * no Google OAuth setup, no magic links, no extra Supabase project config.
 * Supabase must be configured via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * (env vars only — never hardcoded); when it is not, every helper below
 * returns null / a clear "not configured" error instead of throwing.
 *
 * Per-user isolation depends on this: project and memory storage filter by
 * the signed-in user's id (owner_id). Signed-out users get the local
 * browser fallback only — they never see another user's Supabase rows.
 */

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";

/** Event fired whenever the auth session changes, so project lists refresh. */
export const AUTH_CHANGED_EVENT = "projectnova-auth-changed";

function dispatchAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    /* non-browser / test environments: ignore */
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Signed-in user id for storage routing, robust to a transient
 * getUser() failure (offline / token-refresh in flight).
 *
 * getUser() validates the token against the server and returns null on
 * ANY error — including a network error for a user who is still signed
 * in. Treating that null as "signed out" used to route the storage
 * proxies and the Supabase adapters straight to local browser storage,
 * so a signed-in user silently saw a different (local) project list.
 * Falling back to the locally cached session (getSession) distinguishes
 * "no session at all" (null, correctly local) from "session cached but
 * not freshly validated" (id, correctly Supabase-routed; the adapter's
 * own remote calls then surface real failures instead of local data).
 * A truly expired/invalid refresh token clears the cached session, so
 * getSession also returns null and routing stays local / gated.
 */
export async function getSignedInUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) return data.user.id;
  } catch {
    /* fall through to the cached session below */
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function onAuthStateChange(
  callback: (session: Session | null, event?: string) => void
): (() => void) | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    dispatchAuthChanged();
    callback(session, event);
  });
  return () => data.subscription.unsubscribe();
}

function notConfiguredError(): Error {
  return new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then sign in."
  );
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; needsConfirmation: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw notConfiguredError();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  dispatchAuthChanged();
  // If email confirmation is on, Supabase returns no session yet.
  return { user: data.user ?? null, needsConfirmation: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw notConfiguredError();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  dispatchAuthChanged();
  return data.user ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
  dispatchAuthChanged();
}

/**
 * Forgot password, step 1: email Supabase's password-recovery link.
 * redirectTo is the app origin (no hardcoded URL) so the link returns
 * to the app; the app origin must be allowed in the Supabase dashboard
 * under Authentication → URL Configuration → Redirect URLs.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw notConfiguredError();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

/** Forgot password, step 2: set the new password for the recovery session. */
export async function updatePassword(newPassword: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw notConfiguredError();
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  dispatchAuthChanged();
  return data.user ?? null;
}

/** True when the current URL is a Supabase password-recovery redirect. */
export function isPasswordRecoveryUrl(): boolean {
  try {
    const hash = window.location.hash || "";
    return hash.includes("type=recovery");
  } catch {
    return false;
  }
}

/** React hook for the AuthPanel / AppShell: current session + loading state. */
export function useSupabaseAuth(): {
  user: User | null;
  loading: boolean;
  configured: boolean;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    setConfigured(Boolean(supabase));
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    }).catch(() => {
      // getSession rejecting (e.g. storage/network fault) must not leave
      // AppShell stuck on "Checking account…" forever; treat as no user
      // so the gate (or the local app, when unconfigured) renders.
      if (!cancelled) {
        setUser(null);
        setLoading(false);
      }
    });
    const unsubscribe = onAuthStateChange((session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { user, loading, configured };
}
