/**
 * ProjectNova AI — Auth panel (email + password, Supabase only).
 *
 * Placed in the AppShell top bar so it is visible on every page.
 * - Supabase not configured: shows a short note, no form.
 * - Signed out: email + password form, Sign in / Sign up buttons.
 *   Sign up may require email confirmation depending on the Supabase
 *   project's settings — that case is reported, not hidden.
 * - Signed in: shows the account email, a Sign out button, and a note
 *   that only this account's projects are shown. An optional one-time
 *   "Move my local projects to Supabase" button runs the local → Supabase
 *   migration and stamps those local projects with this account's id.
 *   It is deliberately manual: signing in must never silently claim
 *   another browser session's local projects.
 * - Forgot password: "Forgot password?" under the sign-in form emails a
 *   recovery link; clicking it returns to the app as a PASSWORD_RECOVERY
 *   session (or a URL with type=recovery), which shows a "Set new
 *   password" form instead of the normal signed-in panel until the new
 *   password is saved.
 *
 * Auth state changes dispatch the projectnova-auth-changed event, which
 * ActiveProjectContext listens to so project lists refresh on sign
 * in / sign out.
 */
import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  useSupabaseAuth,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  isPasswordRecoveryUrl,
  onAuthStateChange,
} from "@/lib/supabase/auth";
import { migrateLocalStorageToSupabase } from "@/lib/supabase/supabaseMigration";

export const AuthPanel: React.FC = () => {
  const { user, loading, configured } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Independent show/hide toggles, declared here (before the early
  // returns below) so hook order stays stable across renders.
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Detect a password-recovery redirect: either the URL hash carries
  // type=recovery, or supabase-js fires a PASSWORD_RECOVERY event.
  useEffect(() => {
    if (isPasswordRecoveryUrl()) setRecoveryMode(true);
    const unsubscribe = onAuthStateChange((_session, event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  if (loading) {
    return <span className="text-xs font-mono text-foreground-muted">Checking account…</span>;
  }

  if (!configured) {
    return (
      <span
        className="text-xs font-mono text-foreground-muted"
        title="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in"
      >
        Local Session Active
      </span>
    );
  }

  // Recovery takes precedence over the normal signed-in panel: a
  // recovery link signs the user in, but they must set a new password
  // before using the app normally.
  if (recoveryMode) {
    const handleSetNewPassword = async () => {
      setError(null);
      setMessage(null);
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setBusy(true);
      try {
        await updatePassword(newPassword);
        setRecoveryMode(false);
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {
          /* ignore: hash cleanup is cosmetic */
        }
        setMessage("Password updated. You are signed in.");
      } catch (err: any) {
        setError(err?.message || "Could not update password.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-mono">Set new password</span>
        <div className="relative w-full sm:w-28">
          <input
            type={showNewPassword ? "text" : "password"}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            aria-label="New password"
            className="text-xs px-2 py-1 pr-7 border border-border rounded-tactile-sm bg-surface w-full"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            aria-label={showNewPassword ? "Hide new password" : "Show new password"}
            title={showNewPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-foreground-muted hover:text-foreground"
          >
            {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="relative w-full sm:w-36">
          <input
            type={showConfirmPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            className="text-xs px-2 py-1 pr-7 border border-border rounded-tactile-sm bg-surface w-full"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            title={showConfirmPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-foreground-muted hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSetNewPassword()}
          className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-primary hover:opacity-90 disabled:opacity-50"
        >
          Update password
        </button>
        {message && <span className="text-[11px] text-emerald-700">{message}</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  if (user) {
    const handleSignOut = async () => {
      setBusy(true);
      setError(null);
      try {
        await signOut();
      } catch (err: any) {
        setError(err?.message || "Sign out failed.");
      } finally {
        setBusy(false);
      }
    };

    const handleMigrate = async () => {
      setMigrating(true);
      setError(null);
      setMessage(null);
      try {
        const summary = await migrateLocalStorageToSupabase();
        setMessage(
          `Moved ${summary.projectsMigrated} project(s) and ${summary.memoriesMigrated} memorie(s) to Supabase.` +
            (summary.errors.length > 0 ? ` ${summary.errors.join(" ")}` : "")
        );
      } catch (err: any) {
        setError(err?.message || "Migration failed.");
      } finally {
        setMigrating(false);
      }
    };

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-foreground truncate max-w-[180px]" title={user.email || user.id}>
          {user.email || "Signed in"}
        </span>
        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
          Your projects only
        </span>
        <button
          type="button"
          onClick={handleMigrate}
          disabled={migrating}
          className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-surface hover:bg-muted disabled:opacity-50"
          title="One-time: copy this browser's local projects into your Supabase account"
        >
          {migrating ? "Moving…" : "Move local to cloud"}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-surface hover:bg-muted disabled:opacity-50"
        >
          Sign out
        </button>
        {message && <span className="text-[11px] text-emerald-700">{message}</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(email.trim());
      setMessage("Reset link sent to your email. Check inbox (and spam).");
    } catch (err: any) {
      setError(err?.message || "Could not send reset link.");
    } finally {
      setBusy(false);
    }
  };

  const handleAuth = async (mode: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
        setMessage("Signed in. Showing only your projects.");
      } else {
        const { needsConfirmation } = await signUpWithEmail(email.trim(), password);
        setMessage(
          needsConfirmation
            ? "Account created. Check your email to confirm, then sign in."
            : "Account created and signed in."
        );
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-surface hover:bg-muted"
        >
          Sign in / Sign up
        </button>
      ) : (
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAuth("signin");
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-surface w-full sm:w-36"
          />
          <div className="relative w-full sm:w-28">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              className="text-xs px-2 py-1 pr-7 border border-border rounded-tactile-sm bg-surface w-full"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-foreground-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-primary hover:opacity-90 disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAuth("signup")}
            className="text-xs px-2 py-1 border border-border rounded-tactile-sm bg-surface hover:bg-muted disabled:opacity-50"
          >
            Sign up
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleForgotPassword()}
            className="text-xs underline text-foreground-muted hover:text-foreground disabled:opacity-50"
          >
            Forgot password?
          </button>
        </form>
      )}
      {message && <span className="text-[11px] text-emerald-700">{message}</span>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
};
