import type { EnvVariableSpec } from "@/types/release";

/**
 * Generates safe .env.example content containing ONLY documentation and placeholders.
 * Strictly guarantees that no actual secret values or live credentials are ever exposed.
 */
export function generateSafeEnvExample(variables: EnvVariableSpec[]): string {
  const header = [
    "# =============================================================================",
    "# ProjectNova AI - Generated Environment Configuration Template",
    "# Notice: This template contains placeholders only. Never commit real secrets.",
    "# =============================================================================",
    "",
  ];

  const lines = variables.map((v) => {
    const comments = [
      `# ${v.description}`,
      `# Required: ${v.required ? "YES" : "NO (Optional)"}`,
      ...(v.format ? [`# Format: ${v.format}`] : []),
    ];
    const assignment = `${v.name}=${v.exampleValue}`;
    return [...comments, assignment, ""].join("\n");
  });

  return header.join("\n") + lines.join("\n");
}

/**
 * Default standard environment variables derived from architecture specs.
 */
export function getDefaultProjectEnvSpecs(hasDatabase: boolean, hasApi: boolean): EnvVariableSpec[] {
  const specs: EnvVariableSpec[] = [
    {
      name: "NODE_ENV",
      description: "Application runtime environment mode",
      required: true,
      format: "development | production | test",
      exampleValue: "production",
      status: "configured",
    },
    {
      name: "PORT",
      description: "Network listening port",
      required: false,
      format: "numeric port number",
      exampleValue: "3000",
      status: "configured",
    },
  ];

  if (hasApi) {
    specs.push({
      name: "API_BASE_URL",
      description: "Public or internal backend API base endpoint",
      required: true,
      format: "valid URL with protocol",
      exampleValue: "https://api.example.com",
      status: "configured",
    });
    specs.push({
      name: "JWT_SECRET",
      description: "Cryptographic secret used to sign session tokens",
      required: true,
      format: "high-entropy string (min 32 chars)",
      exampleValue: "your-jwt-secret-placeholder-min-32-chars",
      status: "not_verified",
    });
  }

  if (hasDatabase) {
    specs.push({
      name: "DATABASE_URL",
      description: "Connection URI for database persistence",
      required: true,
      format: "postgres://user:pass@host:port/dbname",
      exampleValue: "postgres://postgres:placeholder_password@localhost:5432/app_db",
      status: "not_verified",
    });
  }

  return specs;
}
