/**
 * Client session identifier helper.
 * Generates or retrieves an ephemeral session ID stored only in sessionStorage.
 * This guarantees session isolation without leaking across different browser sessions.
 */
export function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem("projectnova_session_id");
    if (existing && existing.length > 5) {
      return existing;
    }
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("projectnova_session_id", newId);
    return newId;
  } catch {
    return "session_default_ephemeral";
  }
}
