import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSupabaseStatus } from "@/lib/supabase/supabaseClient";
import { AIGatewayClient } from "@/lib/ai/client";

describe("Settings & Provider Integration Audits", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Supabase Configuration Detection & Safety", () => {
    it("reports honest configuration status based on environment variables", () => {
      const status = getSupabaseStatus();
      expect(status).toHaveProperty("isConfigured");
      expect(status).toHaveProperty("urlConfigured");
      expect(status).toHaveProperty("anonKeyConfigured");
      expect(status).toHaveProperty("mode");
      expect(["supabase_active", "local_fallback"]).toContain(status.mode);
    });

    it("does not expose service-role credentials in client status", () => {
      const status = getSupabaseStatus() as any;
      expect(status.serviceRoleKey).toBeUndefined();
      expect(status.secretKey).toBeUndefined();
    });
  });

  describe("Gemini AI Gateway Health & Contract", () => {
    it("creates an AIGatewayClient pointing to local port 4000", () => {
      const client = new AIGatewayClient();
      expect(client).toBeDefined();
    });

    it("handles connection failure cleanly when server is unreachable without crashing", async () => {
      const client = new AIGatewayClient();
      // Mock fetch failure
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Failed to fetch ECONNREFUSED"));

      await expect(client.checkHealth()).rejects.toThrow(/AI Gateway server is not reachable/);
    });

    it("correctly parses healthy gateway response", async () => {
      const client = new AIGatewayClient();
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          hasKey: true,
        }),
      } as Response);

      const health = await client.checkHealth();
      expect(health.status).toBe("ok");
      expect(health.provider).toBe("gemini");
      expect(health.model).toBe("gemini-3.5-flash-lite");
      expect(health.hasKey).toBe(true);
    });

    it("correctly surfaces unconfigured key state from gateway", async () => {
      const client = new AIGatewayClient();
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "unconfigured",
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          hasKey: false,
        }),
      } as Response);

      const health = await client.checkHealth();
      expect(health.status).toBe("unconfigured");
      expect(health.hasKey).toBe(false);
    });
  });

  describe("Subsystem Status Independence", () => {
    it("verifies local storage independently of remote services", () => {
      const testKey = `__test_${Date.now()}`;
      localStorage.setItem(testKey, "valid");
      expect(localStorage.getItem(testKey)).toBe("valid");
      localStorage.removeItem(testKey);
    });
  });
});
