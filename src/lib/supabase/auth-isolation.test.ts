/**
 * Guards for Supabase Auth + per-user isolation.
 *
 * These tests run without a live Supabase project and without node_modules
 * installs beyond the project's own dev setup:
 * - When Supabase is unconfigured, the project proxy must behave exactly
 *   like local storage (signed-out behaviour is unchanged).
 * - The RLS SQL the user is asked to run must actually enforce
 *   owner_id = auth.uid() on both tables, for all four operations, and
 *   must grant access to anon/authenticated — otherwise the app would
 *   either leak rows or hit permission-denied after the 2026-10-30 change.
 * - The RLS file must contain no keys or passwords.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectStorage } from "../storage/projectStorage";
import { brainStorage } from "../storage/brainStorage";

describe("AUTH/SYNC audit fixes (2026-10-26, offline source guards)", () => {
  const readSrc = (rel: string) => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    return fs.readFileSync(path.join(testDir, rel), "utf-8");
  };

  it("migration aborts without a user, never inserts owner_id = null", () => {
    const src = readSrc("supabaseMigration.ts");
    expect(src).not.toContain("user?.id || null");
    expect(src).toContain("owner_id: user.id");
    expect(src).toMatch(/if \(!user\)[\s\S]*?Migration aborted/);
  });

  it("migration scopes the project existence check by owner_id and migrates memories for skipped projects too", () => {
    const src = readSrc("supabaseMigration.ts");
    // Owner-scoped existence check on projects.
    expect(src).toMatch(/from\('projects'\)[\s\S]*?eq\('owner_id', user\.id\)/);
    // Memories migrate via a helper called for skipped projects as well,
    // not only inside the just-inserted branch.
    expect(src).toContain("migrateMemoriesForProject");
    expect(src).toMatch(/if \(projectInCloud\)[\s\S]*?migrateMemoriesForProject/);
    // Dedupe memories by (id, owner_id).
    expect(src).toMatch(/from\('project_memories'\)[\s\S]*?eq\('owner_id', user\.id\)/);
  });

  it("migration records memory insert failures instead of swallowing them", () => {
    const src = readSrc("supabaseMigration.ts");
    expect(src).toMatch(/Failed to migrate memory.*memErr\.message/);
    expect(src).toContain("memoriesSkipped");
  });

  it("auth exposes a cached-session fallback for signed-in routing and never hangs the gate on getSession rejection", () => {
    const src = readSrc("auth.ts");
    expect(src).toContain("getSignedInUserId");
    expect(src).toMatch(/getSession\(\)[\s\S]*?\.catch/);
    const proj = readSrc("supabaseProjectStorage.ts");
    const brain = readSrc("supabaseBrainStorage.ts");
    expect(proj).toContain("getSignedInUserId");
    expect(brain).toContain("getSignedInUserId");
  });

  it("signed-in read/delete paths never return local data on a network throw", () => {
    for (const file of ["supabaseProjectStorage.ts", "supabaseBrainStorage.ts"]) {
      const src = readSrc(file);
      // The list catch must return [] (the error-object path already did).
      expect(src).toMatch(/Network error[\s\S]*?return \[\]/);
      // The delete catch must report failure, not delete a local copy.
      expect(src).toMatch(/Network throw[\s\S]*?return false/);
    }
  });

  it("AuthPanel recovery dispatches the same event AppShell's gate listens for", () => {
    const panel = readSrc("../../components/auth/AuthPanel.tsx");
    expect(panel).toContain("PASSWORD_RECOVERED_EVENT");
    expect(panel).toMatch(/dispatchEvent\(new Event\(PASSWORD_RECOVERED_EVENT\)\)/);
  });
});

describe("Supabase Auth + per-user isolation (offline guards)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("project proxy falls back to local storage when Supabase is unconfigured", async () => {
    const created = await projectStorage.create({
      name: "Isolation Fallback Project",
      description: "local only",
      objective: "verify signed-out behaviour",
      category: "Developer Tool",
      technologies: ["TypeScript"],
    });
    const list = await projectStorage.list();
    expect(list.find((p) => p.id === created.id)).toBeDefined();
    expect(await projectStorage.getById(created.id)).not.toBeNull();
    expect(await projectStorage.delete(created.id)).toBe(true);
    expect(await projectStorage.getById(created.id)).toBeNull();
  });

  it("brain proxy falls back to local storage when Supabase is unconfigured", async () => {
    const created = await brainStorage.create({
      projectId: "proj_local",
      type: "decision",
      title: "Local memory",
      content: "stays local when signed out",
      source: "user",
    });
    expect((await brainStorage.list("proj_local")).find((m) => m.id === created.id)).toBeDefined();
    expect(await brainStorage.delete(created.id)).toBe(true);
  });

  it("RLS SQL enforces owner-only access and grants, and contains no secrets", () => {
    // RLS file lives next to the clean/ source tree, not inside it.
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const sqlPath = path.join(testDir, "..", "..", "..", "..", "supabase-rls.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    for (const table of ["public.projects", "public.project_memories"]) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
    for (const op of ["FOR SELECT", "FOR INSERT", "FOR UPDATE", "FOR DELETE"]) {
      expect(sql).toContain(op);
    }
    expect(sql).toContain("auth.uid() = owner_id");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_memories TO authenticated");
    expect(sql).not.toMatch(/sb_publishable_|sb_secret_|eyJhbGciOi|password\s*=/i);
  });

  it("schema-fix SQL adds every previously-missing column idempotently, and contains no secrets", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const sqlPath = path.join(testDir, "..", "..", "..", "..", "supabase-schema-fix.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    // Every new column must be added with IF NOT EXISTS (safe to run twice).
    for (const col of [
      "verification_state",
      "version",
      "rationale",
      "related_memory_ids",
      "related_entity_ref",
      "superseded_by",
      "initial_prompt",
      "generation_status",
    ]) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    }
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_memories_project_owner");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_memories TO authenticated");
    // Existing policies are not dropped/recreated by the fix file.
    expect(sql).not.toContain("DROP POLICY");
    expect(sql).not.toMatch(/sb_publishable_|sb_secret_|eyJhbGciOi|password\s*=/i);
  });
});
