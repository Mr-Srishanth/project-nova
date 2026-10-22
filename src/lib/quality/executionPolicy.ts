import type { TestExecutionPolicy } from "@/types/quality";

/**
 * ProjectNova Controlled Test Execution Policy.
 *
 * In accordance with Section 5 of the Phase 6 specification:
 * If no isolated container or hypervisor-backed execution environment is available
 * in the client runtime, arbitrary test commands must NOT be executed blindly
 * in the browser process or unrestricted host OS.
 *
 * Any test execution requires:
 * 1. An explicit execution container / sandbox.
 * 2. Allowlisted test runners (e.g., 'vitest run', 'bun test').
 * 3. User verification and preflight approval.
 * 4. Network isolation and non-privileged credentials.
 */

export const DEFAULT_EXECUTION_POLICY: TestExecutionPolicy = {
  isSupported: false,
  reasonBlocked:
    "Direct browser host execution is blocked by security policy. Test execution requires an isolated container sandbox with restricted filesystem, process cleanup, and explicit user authorization.",
  requiredConfirmations: [
    "Verify target code has been reviewed and approved",
    "Authorize running only allowlisted test runner in sandboxed directory",
    "Confirm no environment secrets or production keys are accessible",
  ],
  allowlistedCommands: ["vitest run --reporter=verbose", "bun test", "npm test -- --watchAll=false"],
};

export function checkExecutionReadiness(
  command: string,
  userConfirmed: boolean
): { allowed: boolean; reason: string } {
  if (!userConfirmed) {
    return {
      allowed: false,
      reason: "Execution rejected: Explicit user confirmation was not provided.",
    };
  }

  const isAllowlisted = DEFAULT_EXECUTION_POLICY.allowlistedCommands.some(
    (allowed) => command.trim().startsWith(allowed.split(" ")[0])
  );

  if (!isAllowlisted) {
    return {
      allowed: false,
      reason: `Execution rejected: Command "${command}" is not on the ProjectNova safety allowlist.`,
    };
  }

  // Execution remains safely blocked in browser sandbox until an isolated container daemon is mounted
  return {
    allowed: false,
    reason: DEFAULT_EXECUTION_POLICY.reasonBlocked,
  };
}
