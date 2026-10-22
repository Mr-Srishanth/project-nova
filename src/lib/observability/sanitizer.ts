/**
 * Privacy, Redaction and Sanitization Engine
 * Ensures secrets, keys, auth headers, and sensitive parameters are stripped
 * before observability events or diagnostic logs are persisted or displayed.
 */

// Common patterns for sensitive keys and tokens
const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /auth(orization)?/i,
  /bearer/i,
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /private[-_]?key/i,
  /access[-_]?token/i,
  /session[-_]?id/i,
  /cookie/i,
];

// Patterns for inline secrets like "AIzaSy...", "Bearer ey...", JWTs, etc.
const INLINE_SECRET_PATTERNS = [
  // Google / Gemini API Keys (AIzaSy...) - length 33 to 45 chars
  /\bAIzaSy[a-zA-Z0-9_\-]{30,45}\b/g,
  // Bearer tokens with word Bearer
  /\bBearer\s+[a-zA-Z0-9_\-\.]{10,}\b/gi,
  // Generic tokens with prefixes
  /\b(?:ghp|gho|xoxb|xoxp|sk_live|sk_test)_[a-zA-Z0-9]{15,}\b/g,
  // Basic passwords in URL format http://user:pass@host
  /:\/\/[^:\s]+:([^@\s]+)@/g,
];

/**
 * Sanitizes an error message or arbitrary string.
 */
export function sanitizeString(input: string): string {
  if (!input) return "";

  let result = input;

  // Mask inline secrets first
  for (const pattern of INLINE_SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED_SECRET]");
  }

  // Mask key=value or key: value where key is sensitive
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    const keyValRegex = new RegExp(`(${pattern.source})\\s*[:=\\s]\\s*['"]?([^'",\\s&]+)['"]?`, "gi");
    result = result.replace(keyValRegex, "$1=[REDACTED]");
  }

  return result;
}

/**
 * Recursively sanitizes an object or record, redacting sensitive keys and values.
 */
export function sanitizeData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeData(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitiveKey) {
        sanitizedObj[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        sanitizedObj[key] = sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitizedObj[key] = sanitizeData(value);
      } else {
        sanitizedObj[key] = value;
      }
    }

    return sanitizedObj as T;
  }

  return input;
}

/**
 * Formats a safe summary string with a bounded character length.
 */
export function safeSummary(text: string, maxLength = 250): string {
  const sanitized = sanitizeString(text);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength - 3) + "...";
}
