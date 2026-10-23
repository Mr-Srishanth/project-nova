// Single source of truth for the AI gateway origin used by every frontend
// client. Production builds set VITE_AI_GATEWAY_URL to the hosted gateway
// origin (for example https://project-nova-gateway.onrender.com). When the
// variable is unset, the app talks to the local development gateway.
const configured = (import.meta.env.VITE_AI_GATEWAY_URL as string | undefined)?.trim();

export const GATEWAY_ORIGIN = (
  configured && configured.length > 0 ? configured : "http://localhost:4000"
).replace(/\/+$/, "");
