/**
 * ProjectNova AI - Verification Capability Registry
 * Phase 15: Test Automation & Verification Engine
 *
 * Deterministic internal capabilities.
 * Strictly avoids arbitrary shell execution or unsafe dynamic code execution.
 */

import { VerificationCapability, TestEvidenceItem, TestCaseAssertion } from '../../types/testing';
import { runStaticAnalysis } from '../quality/staticAnalysis';
import { runSecurityAnalysis } from '../quality/securityAnalysis';
import { detectArchitectureDrift } from '../repository/driftEngine';
import type { BuildArtifact } from '../../types/artifact';
import type { Blueprint } from '../../types/blueprint';
import type { RepositoryIndex } from '../../types/repository';

export interface ExecutionContext {
  projectId: string;
  targetPaths: string[];
  parameters: Record<string, any>;
  artifacts?: BuildArtifact[];
  blueprint?: Blueprint | null;
}

export interface CapabilityExecutionOutput {
  status: 'passed' | 'failed' | 'blocked';
  durationMs: number;
  outputSanitized: string;
  assertions: TestCaseAssertion[];
  evidence: TestEvidenceItem[];
  errorMessage?: string;
}

export interface RegisteredCapabilityDefinition extends VerificationCapability {
  execute: (context: ExecutionContext) => Promise<CapabilityExecutionOutput>;
}

/**
 * Sanitizes test output to prevent token leakage or runaway terminal output.
 */
export function sanitizeTestOutput(raw: string, maxChars: number = 3000): string {
  if (!raw) return '';
  // Redact potential API keys or tokens
  let cleaned = raw
    .replace(/(bearer\s+)[A-Za-z0-9_\-\.]{15,}/gi, '$1[REDACTED_TOKEN]')
    .replace(/(api[_-]?key\s*[:=]\s*['"]?)[A-Za-z0-9_\-\.]{15,}['"]?/gi, '$1[REDACTED_API_KEY]')
    .replace(/(password|secret|access_token)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, '$1=[REDACTED]');
  
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + '\n... [TRUNCATED FOR LENGTH]';
  }
  return cleaned;
}

export const CAPABILITY_STATIC_ANALYSIS: RegisteredCapabilityDefinition = {
  id: 'static_analysis_runner',
  name: 'Static Code & AST Analyzer',
  description: 'Evaluates AST patterns, line counts, duplicate tokens, and structural complexity across target files.',
  category: 'static_analysis',
  isRegistered: true,
  allowedTargetExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  parameterSchema: {
    maxFileLines: { type: 'number', required: false, description: 'Maximum permitted file line count' },
    checkNoAny: { type: 'boolean', required: false, description: 'Assert TypeScript code contains no explicit `any`' }
  },
  maxTimeoutMs: 5000,
  execute: async (context: ExecutionContext): Promise<CapabilityExecutionOutput> => {
    const start = Date.now();
    const artifacts = context.artifacts || [];
    const targetArtifacts = artifacts.filter(a => context.targetPaths.some(tp => a.path.endsWith(tp) || tp.endsWith(a.path)));

    if (targetArtifacts.length === 0) {
      return {
        status: 'blocked',
        durationMs: Date.now() - start,
        outputSanitized: `No matching artifacts found for target paths: ${context.targetPaths.join(', ')}`,
        assertions: [],
        evidence: [],
        errorMessage: 'Target artifacts not found in workspace'
      };
    }

    const assertions: TestCaseAssertion[] = [];
    const evidence: TestEvidenceItem[] = [];
    let hasFailures = false;

    // Run static analysis tool
    const findings = runStaticAnalysis({
      projectId: context.projectId,
      assessmentId: `test-eval-${Date.now()}`,
      artifacts: targetArtifacts
    });

    const errorFindings = findings.filter(f => f.severity === 'error');
    if (errorFindings.length > 0) {
      hasFailures = true;
    }

    for (const art of targetArtifacts) {
      const lines = art.content.split('\n').length;
      const maxLines = context.parameters.maxFileLines ?? 1000;
      const linesPass = lines <= maxLines;

      assertions.push({
        id: `lines-${art.id}`,
        description: `File line count for ${art.path} <= ${maxLines}`,
        target: art.path,
        expected: `<=${maxLines}`,
        actual: lines,
        passed: linesPass
      });
      if (!linesPass) hasFailures = true;

      if (context.parameters.checkNoAny) {
        const hasExplicitAny = art.content.includes(': any') || art.content.includes('as any');
        assertions.push({
          id: `no-any-${art.id}`,
          description: `No explicit 'any' in ${art.path}`,
          target: art.path,
          expected: false,
          actual: hasExplicitAny,
          passed: !hasExplicitAny
        });
        if (hasExplicitAny) hasFailures = true;
      }

      evidence.push({
        id: `evidence-${art.id}`,
        type: 'ast_metric',
        title: `Static Metrics for ${art.path}`,
        detail: `Lines: ${lines}, Size: ${art.content.length} chars`,
        rawPayload: { lines, size: art.content.length }
      });
    }

    return {
      status: hasFailures ? 'failed' : 'passed',
      durationMs: Date.now() - start,
      outputSanitized: sanitizeTestOutput(`Static Analysis completed for ${targetArtifacts.length} files. Findings: ${findings.length}, Passed: ${!hasFailures}`),
      assertions,
      evidence
    };
  }
};

export const CAPABILITY_SECURITY_ANALYSIS: RegisteredCapabilityDefinition = {
  id: 'security_analysis_runner',
  name: 'Security & Secret Hygiene Runner',
  description: 'Audits target code for hardcoded credentials, unsafe eval/Function constructor calls, and path traversal vulnerabilities.',
  category: 'security',
  isRegistered: true,
  allowedTargetExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.env'],
  parameterSchema: {
    disallowHighSeverity: { type: 'boolean', required: false, description: 'Fail if any high severity vulnerability detected' }
  },
  maxTimeoutMs: 5000,
  execute: async (context: ExecutionContext): Promise<CapabilityExecutionOutput> => {
    const start = Date.now();
    const artifacts = context.artifacts || [];
    const targetArtifacts = artifacts.filter(a => context.targetPaths.some(tp => a.path.endsWith(tp) || tp.endsWith(a.path)));

    if (targetArtifacts.length === 0) {
      return {
        status: 'blocked',
        durationMs: Date.now() - start,
        outputSanitized: `No artifacts found to run security analysis for: ${context.targetPaths.join(', ')}`,
        assertions: [],
        evidence: [],
        errorMessage: 'Target artifacts not found'
      };
    }

    const assertions: TestCaseAssertion[] = [];
    const evidence: TestEvidenceItem[] = [];

    const findings = runSecurityAnalysis({
      projectId: context.projectId,
      assessmentId: `test-sec-${Date.now()}`,
      artifacts: targetArtifacts
    });

    const criticalOrHigh = findings.filter(f => f.severity === 'error' || f.severity === 'warning');

    assertions.push({
      id: `sec-check`,
      description: `Zero critical or high security findings across ${targetArtifacts.length} files`,
      target: 'artifacts',
      expected: 0,
      actual: criticalOrHigh.length,
      passed: criticalOrHigh.length === 0
    });

    for (const finding of findings) {
      evidence.push({
        id: `sec-finding-${finding.id}`,
        type: 'security_alert',
        title: `[${finding.severity.toUpperCase()}] ${finding.title}`,
        detail: finding.message,
        rawPayload: finding as unknown as Record<string, any>
      });
    }

    return {
      status: criticalOrHigh.length > 0 ? 'failed' : 'passed',
      durationMs: Date.now() - start,
      outputSanitized: sanitizeTestOutput(`Security check inspected ${targetArtifacts.length} files. Vulnerabilities found: ${criticalOrHigh.length}`),
      assertions,
      evidence
    };
  }
};

export const CAPABILITY_DEPENDENCY_CYCLE: RegisteredCapabilityDefinition = {
  id: 'dependency_cycle_checker',
  name: 'Module Dependency Cycle Checker',
  description: 'Validates that internal imports form an acyclic directed graph and reports circular dependencies.',
  category: 'dependency_dag',
  isRegistered: true,
  allowedTargetExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  parameterSchema: {},
  maxTimeoutMs: 5000,
  execute: async (context: ExecutionContext): Promise<CapabilityExecutionOutput> => {
    const start = Date.now();
    const artifacts = context.artifacts || [];

    // Construct simple dependency map from local relative imports
    const depGraph: Record<string, string[]> = {};
    for (const art of artifacts) {
      const lines = art.content.split('\n');
      const deps: string[] = [];
      for (const line of lines) {
        const importMatch = line.match(/import\s+.*?from\s+['"](\..*?)['"]/);
        if (importMatch && importMatch[1]) {
          deps.push(importMatch[1]);
        }
      }
      depGraph[art.path] = deps;
    }

    // Detect cycles via DFS
    const visited: Record<string, boolean> = {};
    const recStack: Record<string, boolean> = {};
    const cycles: string[][] = [];

    function dfs(node: string, path: string[]) {
      visited[node] = true;
      recStack[node] = true;
      path.push(node);

      const neighbors = depGraph[node] || [];
      for (const dep of neighbors) {
        // Resolve simple relative match
        const matchedTarget = Object.keys(depGraph).find(p => p.includes(dep.replace(/^\.\//, '')));
        if (matchedTarget) {
          if (!visited[matchedTarget]) {
            dfs(matchedTarget, [...path]);
          } else if (recStack[matchedTarget]) {
            cycles.push([...path, matchedTarget]);
          }
        }
      }
      recStack[node] = false;
    }

    for (const node of Object.keys(depGraph)) {
      if (!visited[node]) {
        dfs(node, []);
      }
    }

    const assertions: TestCaseAssertion[] = [{
      id: 'no-circular-deps',
      description: 'Zero circular import cycles detected across workspace modules',
      target: 'workspace',
      expected: 0,
      actual: cycles.length,
      passed: cycles.length === 0
    }];

    const evidence: TestEvidenceItem[] = cycles.map((c, i) => ({
      id: `cycle-${i}`,
      type: 'cycle_path',
      title: `Circular Dependency Detected #${i + 1}`,
      detail: c.join(' -> ')
    }));

    return {
      status: cycles.length === 0 ? 'passed' : 'failed',
      durationMs: Date.now() - start,
      outputSanitized: sanitizeTestOutput(`Dependency DAG scan finished. Discovered ${cycles.length} circular cycles.`),
      assertions,
      evidence
    };
  }
};

export const CAPABILITY_DRIFT_VERIFICATION: RegisteredCapabilityDefinition = {
  id: 'drift_verification_runner',
  name: 'Architecture Drift & Route Verification',
  description: 'Verifies whether blueprint API routes and core components are implemented in workspace artifacts.',
  category: 'drift_verification',
  isRegistered: true,
  allowedTargetExtensions: ['.ts', '.tsx', '.json'],
  parameterSchema: {},
  maxTimeoutMs: 5000,
  execute: async (context: ExecutionContext): Promise<CapabilityExecutionOutput> => {
    const start = Date.now();
    const artifacts = context.artifacts || [];

    if (!context.blueprint) {
      return {
        status: 'blocked',
        durationMs: Date.now() - start,
        outputSanitized: 'No project blueprint available for drift verification.',
        assertions: [],
        evidence: [],
        errorMessage: 'Project blueprint missing'
      };
    }

    // Build synthetic minimal repository index for drift detector
    const repoIndex: RepositoryIndex = {
      id: `repo_${context.projectId}`,
      projectId: context.projectId,
      sourceType: 'project_artifacts',
      sourceName: 'Workspace Artifacts',
      indexedAt: new Date().toISOString(),
      totalFilesCount: artifacts.length,
      indexedFilesCount: artifacts.length,
      skippedFilesCount: 0,
      failedFilesCount: 0,
      detectedLanguages: { typescript: artifacts.length },
      projectType: 'React / Vite TypeScript Application',
      dependencyGraph: {
        nodes: artifacts.map(a => a.path),
        edges: [],
        unresolvedImports: [],
        cycles: []
      },
      files: artifacts.map(a => ({
        id: `file_${a.id}`,
        path: a.path,
        sizeBytes: a.content.length,
        lineCount: a.content.split('\n').length,
        language: a.language === 'json' ? ('json' as const) : ('typescript' as const),
        sha256: `hash_${a.id}`,
        lastModifiedAt: a.lastModifiedAt || new Date().toISOString(),
        isExcluded: false,
        parseStatus: 'parsed' as const,
        structure: {
          exports: [],
          imports: [],
          symbols: [],
          isEntryPointCandidate: false,
          analysisType: 'parser_verified' as const,
          apiRouteCandidates: a.content.match(/(get|post|put|delete|patch)\s*\(\s*['"](\/.*?)['"]/gi) || []
        }
      }))
    };

    const driftFindings = detectArchitectureDrift({
      index: repoIndex,
      blueprint: context.blueprint
    });

    const missingRouteFindings = driftFindings.filter(f => f.category === 'missing_api_route');

    const assertions: TestCaseAssertion[] = [{
      id: 'drift-routes',
      description: 'All Blueprint routes implemented in codebase',
      target: 'blueprint.api',
      expected: 0,
      actual: missingRouteFindings.length,
      passed: missingRouteFindings.length === 0
    }];

    const evidence: TestEvidenceItem[] = missingRouteFindings.map(f => ({
      id: `drift-${f.id}`,
      type: 'diff_verification',
      title: f.title,
      detail: f.explanation
    }));

    return {
      status: missingRouteFindings.length === 0 ? 'passed' : 'failed',
      durationMs: Date.now() - start,
      outputSanitized: sanitizeTestOutput(`Drift check complete. Missing routes: ${missingRouteFindings.length}.`),
      assertions,
      evidence
    };
  }
};

export const CAPABILITY_ARTIFACT_SYNTAX: RegisteredCapabilityDefinition = {
  id: 'artifact_syntax_validator',
  name: 'Artifact Syntax Validator',
  description: 'Performs syntax validation and balanced brace/bracket checking for target code and JSON artifacts.',
  category: 'artifact_syntax',
  isRegistered: true,
  allowedTargetExtensions: ['.json', '.ts', '.tsx', '.js', '.jsx'],
  parameterSchema: {},
  maxTimeoutMs: 3000,
  execute: async (context: ExecutionContext): Promise<CapabilityExecutionOutput> => {
    const start = Date.now();
    const artifacts = context.artifacts || [];
    const targetArtifacts = artifacts.filter(a => context.targetPaths.some(tp => a.path.endsWith(tp) || tp.endsWith(a.path)));

    if (targetArtifacts.length === 0) {
      return {
        status: 'blocked',
        durationMs: Date.now() - start,
        outputSanitized: `No artifacts matching ${context.targetPaths.join(', ')} found.`,
        assertions: [],
        evidence: [],
        errorMessage: 'Artifacts not found'
      };
    }

    const assertions: TestCaseAssertion[] = [];
    const evidence: TestEvidenceItem[] = [];
    let syntaxErrorFound = false;

    for (const art of targetArtifacts) {
      if (art.path.endsWith('.json')) {
        try {
          JSON.parse(art.content);
          assertions.push({
            id: `json-syntax-${art.id}`,
            description: `Valid JSON syntax for ${art.path}`,
            target: art.path,
            expected: true,
            actual: true,
            passed: true
          });
        } catch (err: any) {
          syntaxErrorFound = true;
          assertions.push({
            id: `json-syntax-${art.id}`,
            description: `Valid JSON syntax for ${art.path}`,
            target: art.path,
            expected: true,
            actual: false,
            passed: false
          });
          evidence.push({
            id: `syntax-err-${art.id}`,
            type: 'syntax_error',
            title: `JSON Parse Failure in ${art.path}`,
            detail: err?.message || String(err)
          });
        }
      } else {
        // Simple balanced delimiter validation for TS/JS files
        let openBraces = 0;
        let openParens = 0;
        let openBrackets = 0;
        let valid = true;

        for (let i = 0; i < art.content.length; i++) {
          const char = art.content[i];
          if (char === '{') openBraces++;
          else if (char === '}') openBraces--;
          else if (char === '(') openParens++;
          else if (char === ')') openParens--;
          else if (char === '[') openBrackets++;
          else if (char === ']') openBrackets--;

          if (openBraces < 0 || openParens < 0 || openBrackets < 0) {
            valid = false;
            break;
          }
        }

        if (openBraces !== 0 || openParens !== 0 || openBrackets !== 0) {
          valid = false;
        }

        assertions.push({
          id: `delimiters-${art.id}`,
          description: `Balanced syntax delimiters in ${art.path}`,
          target: art.path,
          expected: true,
          actual: valid,
          passed: valid
        });

        if (!valid) {
          syntaxErrorFound = true;
          evidence.push({
            id: `delimiter-err-${art.id}`,
            type: 'syntax_error',
            title: `Unbalanced syntax in ${art.path}`,
            detail: `Braces delta: ${openBraces}, Parens delta: ${openParens}, Brackets delta: ${openBrackets}`
          });
        }
      }
    }

    return {
      status: syntaxErrorFound ? 'failed' : 'passed',
      durationMs: Date.now() - start,
      outputSanitized: sanitizeTestOutput(`Artifact syntax validation tested ${targetArtifacts.length} files. Passed: ${!syntaxErrorFound}`),
      assertions,
      evidence
    };
  }
};

/**
 * Capability Registry singleton providing strict whitelist validation.
 */
class VerificationCapabilityRegistry {
  private capabilities: Map<string, RegisteredCapabilityDefinition> = new Map();

  constructor() {
    this.register(CAPABILITY_STATIC_ANALYSIS);
    this.register(CAPABILITY_SECURITY_ANALYSIS);
    this.register(CAPABILITY_DEPENDENCY_CYCLE);
    this.register(CAPABILITY_DRIFT_VERIFICATION);
    this.register(CAPABILITY_ARTIFACT_SYNTAX);
  }

  public register(cap: RegisteredCapabilityDefinition): void {
    this.capabilities.set(cap.id, cap);
  }

  public get(id: string): RegisteredCapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  public list(): VerificationCapability[] {
    return Array.from(this.capabilities.values()).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      isRegistered: c.isRegistered,
      allowedTargetExtensions: c.allowedTargetExtensions,
      parameterSchema: c.parameterSchema,
      maxTimeoutMs: c.maxTimeoutMs
    }));
  }

  public isRegistered(id: string): boolean {
    return this.capabilities.has(id);
  }
}

export const capabilityRegistry = new VerificationCapabilityRegistry();
