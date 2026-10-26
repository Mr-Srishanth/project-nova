/**
 * ProjectNova AI — full-screen sign-in page (auth gate).
 *
 * Rendered by AppShell INSTEAD of the app (no sidebar, no Workspaces,
 * no app pages) when Supabase is configured and no user is signed in,
 * or when a password-recovery session is active. Once a session exists
 * (and recovery, if any, is finished) the gate opens and AppShell
 * renders the normal app.
 *
 * Reuses the same supabase-js helpers as the top-bar AuthPanel:
 * signInWithEmail, signUpWithEmail, sendPasswordResetEmail,
 * updatePassword, isPasswordRecoveryUrl. No URL, key, or password
 * is hardcoded here; Supabase config comes from env vars only.
 *
 * Mobile-first: a single centered card, full-width inputs, no
 * horizontal overflow on ~360px phone screens.
 */
import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
  updatePassword,
  isPasswordRecoveryUrl,
  onAuthStateChange,
} from "@/lib/supabase/auth";

/** Fired after a recovery password is saved, so AppShell's gate opens. */
export const PASSWORD_RECOVERED_EVENT = "projectnova-password-recovered";

type View = "signin" | "signup" | "forgot";

export const AuthPage: React.FC = () => {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Independent show/hide toggles: revealing one password field must
  // never reveal another (e.g. main password vs confirm password).
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  // Recovery detection: URL hash (type=recovery) or the supabase-js
  // PASSWORD_RECOVERY event — same signals as AuthPanel.
  useEffect(() => {
    if (isPasswordRecoveryUrl()) setRecoveryMode(true);
    const unsubscribe = onAuthStateChange((_session, event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleAuth = async (mode: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
        // No navigation needed: AppShell's gate re-renders the app
        // as soon as the session appears.
      } else {
        const { needsConfirmation } = await signUpWithEmail(email.trim(), password);
        if (needsConfirmation) {
          setMessage("Account created. Check your email to confirm, then sign in.");
        }
        // If no confirmation is required, the new session opens the app.
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

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
      try {
        window.dispatchEvent(new Event(PASSWORD_RECOVERED_EVENT));
      } catch {
        /* ignore */
      }
      // AppShell's gate now renders the app; the signed-in panel
      // there confirms the session.
    } catch (err: any) {
      setError(err?.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-8"
      style={{
        // CSS-ONLY Minecraft-inspired scene (no image assets, so the
        // snapshot push stays binary-free): day sky, blocky sun/clouds,
        // stepped hills and trees, grass + dirt ground along the bottom.
        background: "linear-gradient(180deg, #7ec8f7 0%, #a5dcf7 55%, #d8f0c0 100%)",
      }}
    >
      {/* Decorative scene only - aria-hidden, pointer-events off, and
          kept behind the card so the form stays fully readable. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Blocky square sun */}
        <div className="absolute right-[8%] top-[7%] h-12 w-12 bg-yellow-300 border-2 border-yellow-500 sm:h-14 sm:w-14" />
        {/* Pixel clouds: stepped white rectangles */}
        <div className="absolute left-[6%] top-[10%] hidden sm:block">
          <div className="ml-4 h-4 w-20 bg-white/90" />
          <div className="h-4 w-32 bg-white/90" />
        </div>
        <div className="absolute right-[22%] top-[22%]">
          <div className="ml-3 h-3 w-14 bg-white/80" />
          <div className="h-3 w-24 bg-white/80" />
        </div>
        {/* Stepped hills (blocky, no curves) */}
        <div className="absolute bottom-[96px] left-0 h-16 w-[38%] bg-[#6abe30]" />
        <div className="absolute bottom-[96px] left-[30%] h-10 w-[22%] bg-[#5aa82b]" />
        <div className="absolute bottom-[96px] right-0 h-20 w-[34%] bg-[#6abe30]" />
        {/* Blocky trees: square leaves + trunk */}
        <div className="absolute bottom-[96px] left-[10%] hidden sm:block">
          <div className="mx-auto h-8 w-8 bg-[#2f7a1e]" />
          <div className="mx-auto h-6 w-2 bg-[#7a4a21]" />
        </div>
        <div className="absolute bottom-[96px] right-[12%] hidden sm:block">
          <div className="mx-auto h-10 w-10 bg-[#2f7a1e]" />
          <div className="mx-auto h-6 w-2 bg-[#7a4a21]" />
        </div>
        {/* Ground: grass strip over dirt, with a pixel-speckled dirt band
            (repeating gradient, still pure CSS). */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-4 w-full bg-[#6abe30] border-t-2 border-[#4e8f22]" />
          <div
            className="h-20 w-full"
            style={{
              background:
                "repeating-linear-gradient(90deg, #8a5a2b 0 16px, #7a4a21 16px 32px)",
            }}
          />
        </div>
      </div>
      <div className="relative z-10 w-full max-w-sm bg-surface border-2 border-border rounded-tactile shadow-hard-sm p-5 sm:p-6">
        {/* Pixel accent strip matching the PPT/team Minecraft branding */}
        <div aria-hidden="true" className="mb-4 flex gap-1">
          {["#6abe30", "#4e8f22", "#8a5a2b", "#6abe30", "#4e8f22", "#8a5a2b", "#6abe30", "#4e8f22"].map(
            (color, i) => (
              <span key={i} className="h-2 w-2" style={{ backgroundColor: color }} />
            ),
          )}
        </div>
        {/* Branding */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-tactile bg-primary border-2 border-border flex items-center justify-center font-display font-bold text-lg text-foreground shadow-hard-sm shrink-0">
            N
          </div>
          <div>
            <div className="font-display font-bold text-xl text-foreground leading-tight">
              ProjectNova AI
            </div>
            <div className="text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-wider">
              Autonomous Project OS
            </div>
          </div>
        </div>
        <p className="text-xs text-foreground-muted mt-3 mb-5 leading-relaxed">
          {recoveryMode
            ? "Set a new password for your account."
            : "Sign in to your workspace. Your projects are private to your account."}
        </p>

        {recoveryMode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSetNewPassword();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="auth-new-password" className="block text-xs font-semibold text-foreground mb-1">
                New password
              </label>
              <div className="relative">
                <input
                  id="auth-new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="w-full text-sm px-3 py-2 pr-10 border-2 border-border rounded-tactile-sm bg-background text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  title={showNewPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground-muted hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-foreground mb-1">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="w-full text-sm px-3 py-2 pr-10 border-2 border-border rounded-tactile-sm bg-background text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground-muted hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full text-sm font-semibold px-3 py-2.5 border-2 border-border rounded-tactile-sm bg-primary text-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : view === "forgot" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleForgotPassword();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-foreground mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full text-sm px-3 py-2 border-2 border-border rounded-tactile-sm bg-background text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full text-sm font-semibold px-3 py-2.5 border-2 border-border rounded-tactile-sm bg-primary text-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setMessage(null);
                setView("signin");
              }}
              className="w-full text-xs text-foreground-muted hover:text-foreground underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAuth(view === "signup" ? "signup" : "signin");
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-foreground mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full text-sm px-3 py-2 border-2 border-border rounded-tactile-sm bg-background text-foreground"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={view === "signup" ? "new-password" : "current-password"}
                  className="w-full text-sm px-3 py-2 pr-10 border-2 border-border rounded-tactile-sm bg-background text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full text-sm font-semibold px-3 py-2.5 border-2 border-border rounded-tactile-sm bg-primary text-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Please wait…" : view === "signup" ? "Create account" : "Sign in"}
            </button>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setView(view === "signup" ? "signin" : "signup");
                }}
                className="text-xs text-foreground-muted hover:text-foreground underline"
              >
                {view === "signup" ? "Already have an account? Sign in" : "New here? Create account"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setView("forgot");
                }}
                className="text-xs text-foreground-muted hover:text-foreground underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="mt-4 text-xs text-emerald-700 leading-relaxed">{message}</p>
        )}
        {error && <p className="mt-4 text-xs text-red-600 leading-relaxed">{error}</p>}
      </div>
    </div>
  );
};
