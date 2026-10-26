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
