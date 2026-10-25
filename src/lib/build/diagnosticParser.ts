import type { DiagnosticProblem } from "@/components/build/IDEBottomPanel";

/**
 * Parses compiler/linter error output (such as TypeScript tsc, ESLint, or Vite)
 * into structured IDE DiagnosticProblem items.
 *
 * Example TSC format:
 * src/app/App.tsx(100,37): error TS2345: Argument of type 'CanvasGradient' is not assignable to parameter of type 'string'.
 */
export function parseCompilerDiagnostics(rawLogs: string[]): DiagnosticProblem[] {
  const problems: DiagnosticProblem[] = [];
  const tscRegex = /^([a-zA-Z0-9_\-\.\/]+)\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+):\s*(.+)$/;

  for (const chunk of rawLogs) {
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(tscRegex);
      if (match) {
        const [, file, lineStr, colStr, severityStr, code, message] = match;
        problems.push({
          id: `diag_${file}_${lineStr}_${colStr}_${code}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          file: file.replace(/\\/g, "/"),
          line: parseInt(lineStr, 10),
          column: parseInt(colStr, 10),
          severity: severityStr.toLowerCase() === "warning" ? "warning" : "error",
          message: `${code}: ${message}`,
          source: "TypeScript Compiler (tsc)",
        });
      }
    }
  }

  return problems;
}
