import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeString, sanitizeData, safeSummary } from "./sanitizer";
import { observabilityStorage, OBSERVABILITY_STORAGE_KEY, MAX_EVENTS_LIMIT } from "@/lib/storage/observabilityStorage";
import { activityLogger } from "./activityLogger";
import { assessSystemHealth } from "./healthEngine";
import type { ActivityEvent } from "@/types/observability";

describe("Phase 11: Observability, Privacy Redaction & System Health Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Privacy & Redaction Engine", () => {
    it("should redact Google/Gemini API keys matching AIzaSy... pattern", () => {
      const raw = "Error invoking Gemini: invalid key AIzaSyABC123456789012345678901234567 provided.";
      const sanitized = sanitizeString(raw);
      expect(sanitized).not.toContain("AIzaSyABC123456789012345678901234567");
      expect(sanitized).toContain("[REDACTED_SECRET]");
    });

    it("should redact Bearer authorization tokens", () => {
      const raw = "Request failed with header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
      const sanitized = sanitizeString(raw);
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz");
      expect(sanitized).toContain("[REDACTED]");
    });

    it("should redact sensitive fields in structured payload objects", () => {
      const input = {
        apiKey: "AIzaSySecretKeyValue1234567890123456",
        authorization: "Bearer secret-token-xyz123",
        password: "SuperSecretPassword123!",
        user: "test-user",
        details: {
          token: "nested-token-value",
          status: "active",
        },
      };

      const sanitized = sanitizeData(input);
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.user).toBe("test-user");
      expect(sanitized.details.token).toBe("[REDACTED]");
      expect(sanitized.details.status).toBe("active");
    });

    it("should bound summary strings safely", () => {
      const longText = "a".repeat(400);
      const summary = safeSummary(longText, 50);
      expect(summary.length).toBeLessThanOrEqual(50);
      expect(summary.endsWith("...")).toBe(true);
    });
  });

  describe("2. Event Storage & Project Isolation", () => {
    it("should record valid activity events with timestamp", async () => {
      const event: ActivityEvent = {
        id: "evt-1",
        timestamp: new Date().toISOString(),
        projectId: "proj-alpha",
        category: "ai_gateway",
        eventType: "discovery_request",
        severity: "info",
        outcome: "succeeded",
        sourceSubsystem: "ai_gateway",
        summary: "Discovery generated successfully",
      };

      await observabilityStorage.recordEvent(event);
      const list = await observabilityStorage.listEvents();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("evt-1");
      expect(list[0].summary).toBe("Discovery generated successfully");
    });

    it("should strictly enforce project isolation when listing events", async () => {
      await observabilityStorage.recordEvent({
        id: "evt-p1",
        timestamp: new Date().toISOString(),
        projectId: "proj-1",
        category: "execution_plan",
        eventType: "step_run",
        severity: "info",
        outcome: "succeeded",
        sourceSubsystem: "execution_engine",
        summary: "Step completed for Project 1",
      });

      await observabilityStorage.recordEvent({
        id: "evt-p2",
        timestamp: new Date().toISOString(),
        projectId: "proj-2",
        category: "execution_plan",
        eventType: "step_run",
        severity: "info",
        outcome: "succeeded",
        sourceSubsystem: "execution_engine",
        summary: "Step completed for Project 2",
      });

      const p1Events = await observabilityStorage.listEvents({ projectId: "proj-1" });
      const p2Events = await observabilityStorage.listEvents({ projectId: "proj-2" });
      const allEvents = await observabilityStorage.listEvents();

      expect(p1Events).toHaveLength(1);
      expect(p1Events[0].projectId).toBe("proj-1");

      expect(p2Events).toHaveLength(1);
      expect(p2Events[0].projectId).toBe("proj-2");

      expect(allEvents).toHaveLength(2);
    });

    it("should handle corrupted JSON in local storage safely without crashing", async () => {
      localStorage.setItem(OBSERVABILITY_STORAGE_KEY, "{bad-corrupted-json...");
      const list = await observabilityStorage.listEvents();
      expect(list).toEqual([]);
      // Confirmed recovery backup created
      const backupKeys = Object.keys(localStorage).filter((k) => k.startsWith(`${OBSERVABILITY_STORAGE_KEY}_backup_`));
      expect(backupKeys.length).toBeGreaterThan(0);
    });

    it("should bound retention and preserve errors when limit is reached", async () => {
      // Record 210 events, some errors, mostly infos
      for (let i = 0; i < 210; i++) {
        await observabilityStorage.recordEvent({
          id: `evt-${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          projectId: "proj-retention",
          category: "scheduler",
          eventType: "tick",
          severity: i % 20 === 0 ? "error" : "info",
          outcome: i % 20 === 0 ? "failed" : "succeeded",
          sourceSubsystem: "scheduler",
          summary: `Scheduled tick #${i}`,
        });
      }

      const list = await observabilityStorage.listEvents();
      expect(list.length).toBeLessThanOrEqual(MAX_EVENTS_LIMIT);

      // Errors must be preserved
      const errors = list.filter((e) => e.severity === "error");
      expect(errors.length).toBeGreaterThan(5);
    });
  });

  describe("3. Activity Logger Service", () => {
    it("should measure durationMs and record succeeded operation", async () => {
      const res = await activityLogger.trackOperation(
        {
          category: "quality_check",
          eventType: "static_scan",
          sourceSubsystem: "quality_lab",
          summary: "Running static code scan",
        },
        async () => {
          return { fileCount: 5 };
        }
      );

      expect(res.fileCount).toBe(5);

      const events = await observabilityStorage.listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].outcome).toBe("succeeded");
      expect(typeof events[0].durationMs).toBe("number");
    });

    it("should capture failed operation and record safe error details", async () => {
      await expect(
        activityLogger.trackOperation(
          {
            category: "ai_gateway",
            eventType: "blueprint_request",
            sourceSubsystem: "ai_gateway",
            summary: "Generating blueprint",
          },
          async () => {
            throw new Error("Connection timed out with API token secret123");
          }
        )
      ).rejects.toThrow();

      const events = await observabilityStorage.listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].outcome).toBe("failed");
      expect(events[0].severity).toBe("error");
      expect(events[0].summary).not.toContain("secret123");
    });
  });

  describe("4. Grounded System Health Engine", () => {
    it("should return grounded health results for observable subsystems", async () => {
      const results = await assessSystemHealth({ checkLiveGateway: false });
      expect(results.length).toBeGreaterThanOrEqual(6);

      const storageCheck = results.find((r) => r.subsystem === "local_storage");
      expect(storageCheck?.status).toBe("healthy");
      expect(storageCheck?.isLiveTested).toBe(true);

      const schedCheck = results.find((r) => r.subsystem === "scheduler");
      expect(schedCheck?.status).toBe("healthy");
      expect(schedCheck?.explanation).toContain("active-session mode");

      // Passive check must mark AI gateway as unverified/unknown rather than fabricating connection
      const aiCheck = results.find((r) => r.subsystem === "ai_gateway");
      expect(aiCheck?.status).toBe("unknown");
      expect(aiCheck?.isLiveTested).toBe(false);
    });

    it("should report AI gateway status accurately when live check is requested", async () => {
      const results = await assessSystemHealth({ checkLiveGateway: true });
      const aiCheck = results.find((r) => r.subsystem === "ai_gateway");
      expect(aiCheck?.isLiveTested).toBe(true);
      expect(["healthy", "unavailable"]).toContain(aiCheck?.status);
    });
  });
});
