import type { BuildArtifact } from "@/types/artifact";
import type { QualityFinding } from "@/types/quality";
import { generateId } from "@/lib/utils";

export interface SecurityAnalysisOptions {
  projectId: string;
  assessmentId: string;
  artifacts: BuildArtifact[];
}

export function redactSecretSnippet(snippet: string): string {
  // Redact potential secret values from patterns like key = "..." or password = "..."
  return snippet
    .replace(/(api[_-]?key\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED_SECRET]$3')
    .replace(/(secret\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED_SECRET]$3')
    .replace(/(password\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED_SECRET]$3')
    .replace(/(token\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED_SECRET]$3')
    .replace(/(bearer\s+)([A-Za-z0-9_\-\.]{15,})/gi, '$1[REDACTED_TOKEN]')
    .replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_GEMINI_KEY]')
    .replace(/(sk-[a-zA-Z0-9]{32,})/g, '[REDACTED_API_KEY]');
}

export function runSecurityAnalysis(options: SecurityAnalysisOptions): QualityFinding[] {
  const { projectId, assessmentId, artifacts } = options;
  const findings: QualityFinding[] = [];

  for (const art of artifacts) {
    const lines = art.content.split("\n");

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmedLine = lineText.trim();

      // Rule 1: Hardcoded credentials or API tokens
      if (
        /(?:apiKey|api_key|secret|password|authToken|access_token)\s*[:=]\s*["'][A-Za-z0-9_\-\.]{8,}["']/i.test(
          trimmedLine
        ) ||
        /AIza[0-9A-Za-z-_]{35}/.test(trimmedLine) ||
        /sk-[a-zA-Z0-9]{32,}/.test(trimmedLine)
      ) {
        // Exclude dummy test placeholders or environment variable references
        if (!/(process\.env|your[-_]api[-_]key|dummy|placeholder|example|<.*>)/i.test(trimmedLine)) {
          findings.push({
            id: generateId("qa_sec_"),
            projectId,
            assessmentId,
            category: "security",
            severity: "error",
            title: "Potential Hardcoded Credential Detected",
            message: `File appears to declare a plaintext secret or credential token. Secrets must be loaded via secure environment variables.`,
            filePath: art.path,
            lineNumber: lineNum,
            snippet: redactSecretSnippet(trimmedLine),
            suggestedFix: "Move secret token to process.env or secret manager.",
            ruleId: "SEC001_HARDCODED_SECRET",
            status: "open",
            isAiGenerated: false,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Rule 2: Dangerous dynamic evaluation (`eval(...)`, `new Function(...)`)
      if (/\beval\s*\(/.test(trimmedLine) || /\bnew\s+Function\s*\(/.test(trimmedLine)) {
        findings.push({
          id: generateId("qa_sec_"),
          projectId,
          assessmentId,
          category: "security",
          severity: "error",
          title: "Unsafe Dynamic Code Execution (eval)",
          message: `Dynamic evaluation via eval() or new Function() allows arbitrary code execution and injection attacks.`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: redactSecretSnippet(trimmedLine),
          suggestedFix: "Refactor to use structured object parsing or deterministic dispatch maps.",
          ruleId: "SEC002_DYNAMIC_EVAL",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Rule 3: Risky child_process execution (`exec(variable)`)
      if (
        /\b(?:exec|execSync)\s*\(\s*(?!\s*['"`][a-zA-Z0-9\s_-]+['"`]\s*\))/i.test(trimmedLine) &&
        !/\bexecFile\b/.test(trimmedLine)
      ) {
        findings.push({
          id: generateId("qa_sec_"),
          projectId,
          assessmentId,
          category: "security",
          severity: "warning",
          title: "Potentially Dangerous Shell Execution",
          message: `Command invocation using shell exec() with dynamic arguments is vulnerable to command injection.`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: redactSecretSnippet(trimmedLine),
          suggestedFix: "Use execFile or spawn with explicit argument arrays instead of shell command strings.",
          ruleId: "SEC003_SHELL_INJECTION_RISK",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Rule 4: Risky HTML injection (`dangerouslySetInnerHTML`)
      if (/dangerouslySetInnerHTML\s*=/.test(trimmedLine)) {
        findings.push({
          id: generateId("qa_sec_"),
          projectId,
          assessmentId,
          category: "security",
          severity: "warning",
          title: "Raw HTML Injection (dangerouslySetInnerHTML)",
          message: `Direct injection of unescaped HTML can lead to Cross-Site Scripting (XSS) vulnerabilities.`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: redactSecretSnippet(trimmedLine),
          suggestedFix: "Ensure input is sanitized via DOMPurify or use standard React text nodes.",
          ruleId: "SEC004_RAW_HTML_XSS",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Rule 5: Path traversal risk in filesystem operations (`fs.readFile(req.query.path)`)
      if (
        /fs\.(?:readFile|writeFile|readFileSync|writeFileSync)\s*\([^)]*(?:req\.|params\.|query\.)/i.test(
          trimmedLine
        )
      ) {
        findings.push({
          id: generateId("qa_sec_"),
          projectId,
          assessmentId,
          category: "security",
          severity: "error",
          title: "Unvalidated Filesystem Path Parameter",
          message: `Filesystem access directly consuming request parameters is vulnerable to directory traversal attacks.`,
          filePath: art.path,
          lineNumber: lineNum,
          snippet: redactSecretSnippet(trimmedLine),
          suggestedFix: "Validate path against an allowlist and ensure it resolves inside a sandboxed root directory.",
          ruleId: "SEC005_PATH_TRAVERSAL_RISK",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  return findings;
}
