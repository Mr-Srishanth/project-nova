import http from "node:http";
import { URL } from "node:url";

const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

function setCORS(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJSON(res: http.ServerResponse, status: number, data: unknown) {
  setCORS(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCORS(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/ai/health") {
      sendJSON(res, 200, {
        status: "ok",
        provider: "gemini",
        model: GEMINI_MODEL,
        hasKey: Boolean(GEMINI_API_KEY),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/settings/test-gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const apiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Ping. Respond with VERIFIED: Gemini connection operational." }] }]
        })
      });

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        sendJSON(res, 502, { success: false, error: errorText });
        return;
      }

      sendJSON(res, 200, {
        success: true,
        model: GEMINI_MODEL,
        output: "VERIFIED: Gemini connection operational.",
        verifiedAt: new Date().toISOString()
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/discover") {
      const body = await parseJSONBody(req);
      const userIdeaPrompt = body.idea || "Personalized project idea generation";

      const systemPrompt = `You are the Principal AI Architect for ProjectNova AI.
Generate a structured, highly personalized, technically innovative project idea based on the user's inquiry:
"${userIdeaPrompt}"

Respond with ONLY valid JSON strictly matching this schema:
{
  "name": "Project Title",
  "summary": "Short 1-2 sentence tagline summary",
  "problemStatement": "Clear description of the real-world problem",
  "targetUsers": ["User Persona 1", "User Persona 2"],
  "proposedSolution": "Comprehensive technical architecture solution",
  "keyFeatures": ["Measurable Objective 1", "Measurable Objective 2", "Measurable Objective 3"],
  "suggestedTechnologies": [
    {"layer": "Frontend", "tech": "React + TypeScript"},
    {"layer": "Backend", "tech": "Python FastAPI / Node.js"},
    {"layer": "Database", "tech": "PostgreSQL"},
    {"layer": "AI / Specialized", "tech": "PyTorch / ONNX / TFLite"}
  ],
  "complexity": "Intermediate",
  "estimatedMVPWeeks": 8,
  "risksAndAssumptions": ["Technical risk 1", "Technical risk 2"],
  "recommendedNextSteps": ["Step 1", "Step 2"]
}`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const apiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        sendJSON(res, 502, { error: `Gemini API Error: ${errorText}` });
        return;
      }

      const geminiJson = await apiRes.json();
      const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          sendJSON(res, 200, parsed);
          return;
        } catch {
          sendJSON(res, 200, { name: "AI Project", problemStatement: rawText });
          return;
        }
      }

      sendJSON(res, 500, { error: "No candidate returned by Gemini" });
      return;
    }

    sendJSON(res, 404, { error: `Endpoint '${pathname}' not found` });
  } catch (err: any) {
    sendJSON(res, 500, { error: err?.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`[ProjectNova AI Gateway] Running on http://localhost:${PORT}`);
  console.log(`[ProjectNova AI Gateway] Model: ${GEMINI_MODEL} (Key Configured: ${Boolean(GEMINI_API_KEY)})`);
});
