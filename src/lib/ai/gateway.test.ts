import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createGatewayServer } from "../../../server/gateway";

describe("AI Provider Gateway Server Security & Validation", () => {
  let server: http.Server;
  const TEST_PORT = 4123;
  const BASE_URL = `http://localhost:${TEST_PORT}/api/ai`;
  const SETTINGS_URL = `http://localhost:${TEST_PORT}/api/settings`;

  beforeAll(() => {
    server = createGatewayServer();
    server.listen(TEST_PORT);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /health should return status and supported models without exposing raw secrets", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.provider).toBe("gemini");
    expect(typeof data.hasKey).toBe("boolean");
    expect(Array.isArray(data.supportedModels)).toBe(true);
    expect(data.supportedModels.length).toBeGreaterThan(0);
    expect(data.credentials).toBeDefined();
    // Verify no secret leak
    expect(data.geminiApiKey).toBeUndefined();
    expect(data.supabaseAnonKey).toBeUndefined();
  });

  it("POST /discover should reject invalid or missing idea body with HTTP 400", async () => {
    const res = await fetch(`${BASE_URL}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "  " }), // too short
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request");
  });

  it("POST /blueprint should reject request missing projectName with HTTP 400", async () => {
    const res = await fetch(`${BASE_URL}/blueprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "Build app" }), // missing projectName
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("POST /assist should reject empty question with HTTP 400", async () => {
    const res = await fetch(`${BASE_URL}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: 12345 }), // invalid type
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Question must be provided as a string");
  });

  it("POST /generate-file should reject path traversal with HTTP 400", async () => {
    const res = await fetch(`${BASE_URL}/generate-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "Test Project",
        purpose: "Authentication service",
        filePath: "../etc/passwd",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Path traversal and absolute paths are prohibited");
  });

  it("POST /generate-file should reject absolute paths with HTTP 400", async () => {
    const res = await fetch(`${BASE_URL}/generate-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "Test Project",
        purpose: "Authentication service",
        filePath: "/root/secret.ts",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Path traversal and absolute paths are prohibited");
  });

  it("GET /unknown-route should return HTTP 404 with error message", async () => {
    const res = await fetch(`${BASE_URL}/unknown-route`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Endpoint '/api/ai/unknown-route' not found");
  });

  describe("Provider Settings & Secure Credential Storage Endpoints", () => {
    const sessionId = "session_test_xyz";

    it("POST /api/settings/credentials validates format and stores session credentials securely", async () => {
      // Rejects invalid Gemini key format
      const invalidRes = await fetch(`${SETTINGS_URL}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          geminiApiKey: "short", // too short
        }),
      });
      expect(invalidRes.status).toBe(400);
      const invalidData = await invalidRes.json();
      expect(invalidData.error).toContain("Invalid Gemini API Key format");

      // Accepts valid custom credentials
      const validRes = await fetch(`${SETTINGS_URL}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          geminiApiKey: "AIzaSyCustomUserTestKeyValidFormat99",
          geminiModel: "gemini-2.0-flash",
          supabaseUrl: "https://my-custom-project.supabase.co",
          supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_custom_anon_key_test_token",
        }),
      });

      expect(validRes.status).toBe(200);
      const data = await validRes.json();
      expect(data.success).toBe(true);
      expect(data.status.gemini.isConfigured).toBe(true);
      expect(data.status.gemini.source).toBe("user_session");
      expect(data.status.gemini.model).toBe("gemini-2.0-flash");
      expect(data.status.supabase.isConfigured).toBe(true);
      expect(data.status.supabase.source).toBe("user_session");
      // CRITICAL: Ensure raw keys are NEVER in response
      expect(data.geminiApiKey).toBeUndefined();
      expect(data.supabaseAnonKey).toBeUndefined();
    });

    it("POST /api/settings/credentials/clear resets session credentials safely", async () => {
      const res = await fetch(`${SETTINGS_URL}/credentials/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Reverted to server_env or none
      expect(data.status.gemini.source).not.toBe("user_session");
    });

    it("POST /api/settings/test-supabase rejects invalid formats and missing params", async () => {
      const res = await fetch(`${SETTINGS_URL}/test-supabase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "not-a-url",
          anonKey: "short",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid URL format");
    });
  });
});
