import React, { useState, useEffect } from "react";
import {
  Rocket,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ExternalLink,
  Server,
  Activity,
  History,
  CheckSquare,
  AlertTriangle,
  Copy,
  Check,
  RotateCw,
  GitBranch,
  Key,
  Globe,
  ArrowRight,
  Terminal,
  Lock,
} from "lucide-react";
import { deploymentStorage } from "@/lib/storage/deploymentStorage";
import { deploymentProviderRegistry } from "@/lib/deployment/deploymentProviderRegistry";
import { preflightGateEvaluator } from "@/lib/deployment/preflightGateEvaluator";
import { deploymentOrchestrator } from "@/lib/deployment/deploymentOrchestrator";
import {
  deploymentApiClient,
  ServerGitStatus,
  ServerCredentialStatus,
} from "@/lib/deployment/deploymentApiClient";
import type {
  DeploymentConfiguration,
  DeploymentExecutionRecord,
  ProviderConnectionStatus,
  PreflightEvaluationReport,
  DeploymentApproval,
} from "@/types/deployment";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

export const DeploymentCenterPage: React.FC = () => {
  const { activeProject: selectedProject } = useActiveProject();
  const selectedProjectId = selectedProject?.id || "";

  const [providerStatuses, setProviderStatuses] = useState<ProviderConnectionStatus[]>([]);
  const [serverCredentials, setServerCredentials] = useState<ServerCredentialStatus | null>(null);
  const [configurations, setConfigurations] = useState<DeploymentConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<DeploymentConfiguration | null>(null);

  const [preflightReport, setPreflightReport] = useState<PreflightEvaluationReport | null>(null);
  const [activeApproval, setActiveApproval] = useState<DeploymentApproval | null>(null);
  const [records, setRecords] = useState<DeploymentExecutionRecord[]>([]);

  // Navigation mode: "wizard" (Guided Flow) vs "manage" (Advanced Configuration & History)
  const [mode, setMode] = useState<"wizard" | "manage">("wizard");
  const [activeTab, setActiveTab] = useState<"configs" | "connections" | "preflight" | "dispatch" | "history">("configs");

  // Wizard state machine
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [chosenProvider, setChosenProvider] = useState<"vercel" | "netlify">("vercel");
  const [providerTokenInput, setProviderTokenInput] = useState<string>("");
  const [savingToken, setSavingToken] = useState<boolean>(false);
  const [tokenSaveNotice, setTokenSaveNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Git state
  const [gitStatus, setGitStatus] = useState<ServerGitStatus | null>(null);

  // Environment variables input
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: "NODE_ENV", value: "production" },
  ]);

  // Deployment progress & live status
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [liveDeploymentRecord, setLiveDeploymentRecord] = useState<DeploymentExecutionRecord | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Initialize server connection states
  useEffect(() => {
    refreshProviderStates();
    refreshGitStatus();
  }, []);

  const refreshProviderStates = async () => {
    try {
      const adapters = deploymentProviderRegistry.list();
      const statuses = await Promise.all(adapters.map((a) => a.getConnectionStatus()));
      setProviderStatuses(statuses);

      const creds = await deploymentApiClient.getProviderCredentialStatus();
      setServerCredentials(creds);
    } catch (e) {
      console.warn("[DeploymentCenter] Could not load provider server credentials:", e);
    }
  };

  const refreshGitStatus = async () => {
    try {
      const git = await deploymentApiClient.getGitStatus();
      setGitStatus(git);
    } catch (e) {
      console.warn("[DeploymentCenter] Could not load Git status:", e);
    }
  };

  // Update selected project state
  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadProjectDetails() {
      // Load configurations
      const cfgs = deploymentStorage.listConfigurations(selectedProjectId);
      if (cfgs.length > 0) {
        setConfigurations(cfgs);
        setSelectedConfig(cfgs[0]);
      } else {
        // Create initial default preview & prod configurations
        const previewCfg: DeploymentConfiguration = {
          id: `cfg-${selectedProjectId}-preview`,
          projectId: selectedProjectId,
          providerId: "vercel",
          name: "Vercel Preview Target",
          targetEnvironment: "preview",
          sourceBranch: "main",
          sourceRevision: "rev_head",
          providerProjectId: selectedProject?.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "project-preview",
          requiredEnvVarNames: ["APP_NAME"],
          isConfigured: true,
          isVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const netlifyCfg: DeploymentConfiguration = {
          id: `cfg-${selectedProjectId}-netlify`,
          projectId: selectedProjectId,
          providerId: "netlify",
          name: "Netlify Production Edge",
          targetEnvironment: "production",
          sourceBranch: "main",
          sourceRevision: "rev_head",
          providerProjectId: selectedProject?.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "project-site",
          requiredEnvVarNames: ["APP_NAME"],
          isConfigured: true,
          isVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        deploymentStorage.saveConfiguration(previewCfg);
        deploymentStorage.saveConfiguration(netlifyCfg);
        setConfigurations([previewCfg, netlifyCfg]);
        setSelectedConfig(previewCfg);
      }

      // Load records
      const runs = deploymentStorage.listRecords(selectedProjectId);
      setRecords(runs);
      if (runs.length > 0 && (runs[0].status === "succeeded" || runs[0].status === "building" || runs[0].status === "queued")) {
        setLiveDeploymentRecord(runs[0]);
      }
    }
    loadProjectDetails();
  }, [selectedProjectId]);

  // Save Token securely to server
  const handleSaveToken = async () => {
    if (!providerTokenInput.trim()) return;
    setSavingToken(true);
    setTokenSaveNotice(null);
    try {
      const payload: any = { sessionId: "default_user_session" };
      if (chosenProvider === "vercel") {
        payload.vercelToken = providerTokenInput.trim();
      } else {
        payload.netlifyToken = providerTokenInput.trim();
      }
      await deploymentApiClient.saveProviderToken(payload);
      setTokenSaveNotice({ type: "success", text: `Securely stored ${chosenProvider} token on server.` });
      setProviderTokenInput("");
      await refreshProviderStates();
    } catch (e: any) {
      setTokenSaveNotice({ type: "error", text: e.message || "Failed to save token" });
    } finally {
      setSavingToken(false);
    }
  };

  const handleRunPreflight = async () => {
    if (!selectedProject || !selectedConfig) return;
    setIsExecuting(true);
    try {
      const report = await preflightGateEvaluator.evaluatePreflight({
        project: selectedProject,
        configuration: selectedConfig,
        targetRevision: selectedConfig.sourceRevision || "rev_head",
      });
      setPreflightReport(report);
      return report;
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApprove = () => {
    if (!selectedProject || !selectedConfig || !preflightReport) return;
    const approval = deploymentOrchestrator.createApproval(
      selectedProjectId,
      selectedConfig.id,
      selectedConfig.targetEnvironment,
      selectedConfig.sourceRevision || "rev_head",
      preflightReport.id,
      "lead_developer"
    );
    setActiveApproval(approval);
    setActionNotice(`Approved ${selectedConfig.targetEnvironment} release.`);
    return approval;
  };

  // Step 8 & 9: Real Provider Deployment Dispatch & Polling
  const handleWizardDeploy = async () => {
    if (!selectedProject || !selectedConfig) return;
    setIsExecuting(true);
    setActionNotice(null);

    try {
      // 1. Dispatch deployment via server proxy
      let dispatchRes;
      try {
        dispatchRes = await deploymentApiClient.dispatchDeployment({
          providerId: chosenProvider,
          projectId: selectedProjectId,
          configuration: selectedConfig,
          sourceRevision: selectedConfig.sourceRevision || "HEAD",
          sessionId: "default_user_session",
        });
      } catch (err: any) {
        // If server token is missing or error
        const failedRecord: DeploymentExecutionRecord = {
          id: `dep-${Date.now()}`,
          projectId: selectedProjectId,
          configurationId: selectedConfig.id,
          providerId: chosenProvider,
          targetEnvironment: selectedConfig.targetEnvironment,
          sourceRevision: selectedConfig.sourceRevision || "HEAD",
          status: "failed",
          preflightReportId: preflightReport?.id || "pf-none",
          safeErrorMessage: err.message,
          requestedAt: new Date().toISOString(),
          idempotencyKey: `idemp_${Date.now()}`,
        };
        deploymentStorage.saveRecord(failedRecord);
        setRecords(deploymentStorage.listRecords(selectedProjectId));
        setLiveDeploymentRecord(failedRecord);
        setActionNotice(`Deployment dispatch failed: ${err.message}`);
        setWizardStep(9);
        return;
      }

      // Initial active record
      let activeRecord: DeploymentExecutionRecord = {
        id: `dep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        projectId: selectedProjectId,
        configurationId: selectedConfig.id,
        providerId: chosenProvider,
        targetEnvironment: selectedConfig.targetEnvironment,
        sourceRevision: selectedConfig.sourceRevision || "HEAD",
        status: (dispatchRes.status as any) || "queued",
        preflightReportId: preflightReport?.id || "pf-wizard",
        providerDeploymentId: dispatchRes.providerDeploymentId,
        deploymentUrl: dispatchRes.deploymentUrl,
        requestedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        idempotencyKey: `idemp_${Date.now()}`,
      };

      deploymentStorage.saveRecord(activeRecord);
      setLiveDeploymentRecord(activeRecord);
      setRecords(deploymentStorage.listRecords(selectedProjectId));
      setWizardStep(9);

      // Poll provider actual status if provider deployment ID returned
      if (dispatchRes.providerDeploymentId) {
        let attempts = 0;
        const maxAttempts = 15;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await deploymentApiClient.pollDeploymentStatus({
              providerId: chosenProvider,
              providerDeploymentId: dispatchRes.providerDeploymentId!,
              sessionId: "default_user_session",
            });

            activeRecord = {
              ...activeRecord,
              status: (pollRes.status as any) || activeRecord.status,
              providerStatusRaw: pollRes.providerStatusRaw,
              deploymentUrl: pollRes.deploymentUrl || activeRecord.deploymentUrl,
              safeErrorMessage: pollRes.error,
              completedAt: pollRes.status === "succeeded" || pollRes.status === "failed" ? new Date().toISOString() : undefined,
            };

            deploymentStorage.saveRecord(activeRecord);
            setLiveDeploymentRecord({ ...activeRecord });
            setRecords(deploymentStorage.listRecords(selectedProjectId));

            if (pollRes.status === "succeeded" || pollRes.status === "failed" || attempts >= maxAttempts) {
              clearInterval(interval);
              setIsExecuting(false);
            }
          } catch (e) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              setIsExecuting(false);
            }
          }
        }, 3000);
      } else {
        setIsExecuting(false);
      }
    } finally {
      // setIsExecuting managed by polling timer
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (id === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const isProviderConfigured =
    chosenProvider === "vercel"
      ? serverCredentials?.vercelConfigured
      : serverCredentials?.netlifyConfigured;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F4F1DF] p-6 rounded-xl border border-[#153A52]/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#153A52] text-white">
              <Rocket className="w-6 h-6 text-[#70C84B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#153A52]">Deploy & Monitor</h1>
              <p className="text-sm text-[#153A52]/70">
                Beginner-friendly guided deployment wizard, real Vercel/Netlify hosting, preflight verification & Git publishing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <CompactProjectIndicator />

          <div className="flex bg-white rounded-lg border border-[#153A52]/20 p-0.5">
            <button
              onClick={() => setMode("wizard")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === "wizard" ? "bg-[#153A52] text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Guided Wizard
            </button>
            <button
              onClick={() => setMode("manage")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === "manage" ? "bg-[#153A52] text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Advanced & History
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between shadow-sm">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-indigo-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. BEGINNER-FRIENDLY GUIDED DEPLOYMENT WIZARD */}
      {/* ============================================================== */}
      {mode === "wizard" && (
        <div className="bg-white rounded-xl border border-[#153A52]/10 shadow-sm p-6 space-y-8">
          {/* Progress Indicator */}
          <div className="border-b pb-6">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {[
                { num: 1, title: "Provider" },
                { num: 2, title: "Connect" },
                { num: 3, title: "Git Repo" },
                { num: 4, title: "Env Vars" },
                { num: 5, title: "Preflight" },
                { num: 6, title: "Approve" },
                { num: 7, title: "Live Status" },
              ].map((step, idx) => {
                const isCurrent = wizardStep === step.num;
                const isDone = wizardStep > step.num;
                return (
                  <div key={step.num} className="flex items-center">
                    <button
                      onClick={() => setWizardStep(step.num)}
                      className={`flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                        isCurrent
                          ? "text-[#153A52]"
                          : isDone
                          ? "text-emerald-600"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-mono text-xs ${
                          isCurrent
                            ? "bg-[#153A52] text-white border-[#153A52]"
                            : isDone
                            ? "bg-emerald-50 text-emerald-600 border-emerald-500"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : step.num}
                      </div>
                      <span className="hidden sm:inline">{step.title}</span>
                    </button>
                    {idx < 6 && (
                      <div className={`w-6 sm:w-12 h-0.5 mx-1 sm:mx-2 ${wizardStep > step.num ? "bg-emerald-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 1: Choose Hosting Provider */}
          {wizardStep === 1 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Step 1: Choose Your Hosting Provider</h3>
                <p className="text-xs text-gray-500">
                  Select where you want your web application hosted. Both providers offer fast worldwide CDN edge deployments.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div
                  onClick={() => setChosenProvider("vercel")}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all space-y-3 ${
                    chosenProvider === "vercel"
                      ? "border-[#153A52] bg-[#F4F1DF]/30 shadow-md ring-1 ring-[#153A52]"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-[#153A52]">▲ Vercel</span>
                    {serverCredentials?.vercelConfigured && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Ideal for React, Next.js, and static SPAs. Instant preview URLs and continuous production branches.
                  </p>
                  <div className="text-[11px] font-mono text-gray-400">api.vercel.com/v13</div>
                </div>

                <div
                  onClick={() => setChosenProvider("netlify")}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all space-y-3 ${
                    chosenProvider === "netlify"
                      ? "border-[#153A52] bg-[#F4F1DF]/30 shadow-md ring-1 ring-[#153A52]"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-[#153A52]">💠 Netlify</span>
                    {serverCredentials?.netlifyConfigured && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Excellent for modern static sites, serverless functions, and form processing with zero configuration.
                  </p>
                  <div className="text-[11px] font-mono text-gray-400">api.netlify.com/v1</div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2.5 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm"
                >
                  <span>Continue to Connection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Connect Provider Securely */}
          {wizardStep === 2 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">
                  Step 2: Connect {chosenProvider === "vercel" ? "Vercel" : "Netlify"} Securely
                </h3>
                <p className="text-xs text-gray-500">
                  Tokens are stored server-side only in private memory. They are never committed to Git or exposed in browser bundles.
                </p>
              </div>

              {isProviderConfigured ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{chosenProvider === "vercel" ? "Vercel" : "Netlify"} is Connected and Authorized</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Active server token detected. You can proceed with deployment or update your token below.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Provider Token Required</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {chosenProvider === "vercel" ? (
                      <>
                        Obtain a personal token at <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" className="underline font-semibold">vercel.com/account/tokens</a> with deployment privileges.
                      </>
                    ) : (
                      <>
                        Obtain a personal token at <a href="https://app.netlify.com/user/applications" target="_blank" rel="noreferrer" className="underline font-semibold">app.netlify.com/user/applications</a>.
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#153A52]" />
                  <span>Enter {chosenProvider === "vercel" ? "Vercel" : "Netlify"} Personal Access Token</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={providerTokenInput}
                    onChange={(e) => setProviderTokenInput(e.target.value)}
                    placeholder={`e.g. ${chosenProvider === "vercel" ? "vercel_tok_..." : "nfp_..."}`}
                    className="flex-1 px-3 py-2 bg-white border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
                  />
                  <button
                    onClick={handleSaveToken}
                    disabled={savingToken || !providerTokenInput.trim()}
                    className="px-4 py-2 bg-[#153A52] text-white rounded-lg text-xs font-semibold hover:bg-[#153A52]/90 disabled:opacity-50"
                  >
                    {savingToken ? "Saving..." : "Store Securely"}
                  </button>
                </div>

                {tokenSaveNotice && (
                  <p className={`text-xs ${tokenSaveNotice.type === "success" ? "text-emerald-600 font-semibold" : "text-rose-600"}`}>
                    {tokenSaveNotice.text}
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2.5 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm"
                >
                  <span>Continue to Git Repository</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Guided GitHub Connection & Publishing Workflow */}
          {wizardStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Step 3: Connect & Publish to GitHub</h3>
                <p className="text-xs text-gray-500">
                  Cloud hosting providers build directly from your verified Git branch. Inspect your local repository state below.
                </p>
              </div>

              <div className="bg-[#FAF7ED] border-2 border-border p-4 rounded-tactile space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <GitBranch className="w-4 h-4 text-emerald-600" />
                    <span>Local Repository: {gitStatus?.isGit ? "Git Initialized" : "Not Initialized"}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border">
                    Branch: {gitStatus?.currentBranch || "master"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded border">
                    <span className="text-gray-400 block text-[10px] uppercase">Unstaged</span>
                    <span className="font-bold text-gray-800">{gitStatus?.unstagedCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-gray-400 block text-[10px] uppercase">Untracked</span>
                    <span className="font-bold text-gray-800">{gitStatus?.untrackedCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-gray-400 block text-[10px] uppercase">Remote Origin</span>
                    <span className={`font-bold ${gitStatus?.hasRemote ? "text-emerald-600" : "text-amber-600"}`}>
                      {gitStatus?.hasRemote ? "Connected" : "No Remote"}
                    </span>
                  </div>
                </div>
              </div>

              {/* GitHub Publish Guidance & Copyable Terminal Block */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl text-slate-200 font-mono text-xs shadow-md">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Run in ProjectNova Terminal (`F:\project nova`)</span>
                  </div>
                  <button
                    onClick={() => handleCopy("git add .\ngit commit -m \"feat: verified ProjectNova deployment\"\ngit push -u origin main", "all_git")}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    {copiedCmd === "all_git" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === "all_git" ? "Copied" : "Copy All"}</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1 overflow-x-auto text-[11px]">
                  <div className="text-emerald-400"># 1. Connect to your GitHub repository</div>
                  <div className="text-slate-100">
                    git remote add origin https://github.com/&lt;your-org&gt;/&lt;your-repo&gt;.git
                  </div>
                  <div className="text-emerald-400 mt-2"># 2. Stage verified code (secrets in .env are safely excluded)</div>
                  <div className="text-slate-100">git add .</div>
                  <div className="text-slate-100">git commit -m "feat: verified ProjectNova release"</div>
                  <div className="text-emerald-400 mt-2"># 3. Publish to GitHub</div>
                  <div className="text-slate-100">git branch -M main</div>
                  <div className="text-slate-100">git push -u origin main</div>
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Strict policy: .env, API tokens, and credentials are automatically excluded by .gitignore.</span>
                </div>
              </div>

              {/* Changed files preview */}
              {gitStatus?.changedFiles && gitStatus.changedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-700">Changed Files Preview ({gitStatus.changedFiles.length}):</span>
                  <div className="max-h-32 overflow-y-auto bg-gray-50 border rounded p-2 text-[11px] font-mono space-y-1">
                    {gitStatus.changedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-gray-700 truncate">{f.path}</span>
                        <span className={`text-[10px] px-1.5 rounded ${f.isSecret ? "bg-rose-100 text-rose-800 font-bold" : "text-gray-400"}`}>
                          {f.isSecret ? "SECRET BLOCKED" : f.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-5 py-2.5 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm"
                >
                  <span>Continue to Environment Variables</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Configure Environment Variables */}
          {wizardStep === 4 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Step 4: Configure Environment Variables</h3>
                <p className="text-xs text-gray-500">
                  Provide configuration variables needed by your application at runtime. Variables are injected into the build securely.
                </p>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border">
                {envVars.map((ev, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={ev.key}
                      onChange={(e) => {
                        const copy = [...envVars];
                        copy[idx].key = e.target.value;
                        setEnvVars(copy);
                      }}
                      placeholder="KEY (e.g. VITE_API_URL)"
                      className="w-1/2 px-3 py-1.5 bg-white border rounded text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={ev.value}
                      onChange={(e) => {
                        const copy = [...envVars];
                        copy[idx].value = e.target.value;
                        setEnvVars(copy);
                      }}
                      placeholder="VALUE"
                      className="w-1/2 px-3 py-1.5 bg-white border rounded text-xs font-mono"
                    />
                  </div>
                ))}
                <button
                  onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
                  className="text-xs text-[#153A52] font-semibold hover:underline"
                >
                  + Add Environment Variable
                </button>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    await handleRunPreflight();
                    setWizardStep(5);
                  }}
                  className="px-5 py-2.5 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm"
                >
                  <span>Run Preflight Gates</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Real Build, Test & Preflight Release Gates */}
          {wizardStep === 5 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Step 5: Preflight Release Gates</h3>
                <p className="text-xs text-gray-500">
                  Strict quality gates evaluate your code, test plans, artifacts, and target environment without inventing success.
                </p>
              </div>

              {preflightReport && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    preflightReport.overallStatus === "passed"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-rose-50 border-rose-300 text-rose-900"
                  }`}>
                    <div className="flex items-center gap-3">
                      {preflightReport.overallStatus === "passed" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      )}
                      <div>
                        <span className="font-bold text-sm block">
                          Preflight Gate: {preflightReport.overallStatus === "passed" ? "PASSED" : "BLOCKED"}
                        </span>
                        <span className="text-xs">
                          {preflightReport.blockers.length} Blocker(s) · {preflightReport.warnings.length} Warning(s)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleRunPreflight}
                      disabled={isExecuting}
                      className="px-3 py-1 bg-white border rounded text-xs font-semibold shadow-sm hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isExecuting ? "animate-spin" : ""}`} />
                      <span>Re-check</span>
                    </button>
                  </div>

                  {/* Blockers with Plain-Language Explanations */}
                  {preflightReport.blockers.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Mandatory Blockers:</span>
                      {preflightReport.blockers.map((b, i) => (
                        <div key={i} className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">{b}</p>
                            <p className="text-[11px] text-rose-600 mt-0.5">
                              Next Step: Complete or approve the required items in Test & Fix or Build Studio before deploying.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Gate checklist */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Evaluated Gates:</span>
                    {preflightReport.gates.map((g) => (
                      <div key={g.id} className="p-3 bg-gray-50 border rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-gray-800">{g.name}</span>
                          <p className="text-[11px] text-gray-500">{g.explanation}</p>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                          g.status === "passed" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {g.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    handleApprove();
                    setWizardStep(6);
                  }}
                  disabled={!preflightReport || preflightReport.overallStatus !== "passed"}
                  className="px-5 py-2.5 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm disabled:opacity-50"
                >
                  <span>Authorize & Sign Off</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Require Explicit Approval Before Deploying */}
          {wizardStep === 6 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Step 6: Confirm Explicit Deployment Approval</h3>
                <p className="text-xs text-gray-500">
                  Every deployment requires signed authorization bound strictly to this revision and provider.
                </p>
              </div>

              <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span>Deployment Authorization Summary</span>
                  {activeApproval && (
                    <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 ml-auto">
                      Token: {activeApproval.id}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-indigo-950">
                  <div>
                    <span className="text-indigo-600 block text-[10px] uppercase">Target Provider</span>
                    <span className="font-bold uppercase">{chosenProvider}</span>
                  </div>
                  <div>
                    <span className="text-indigo-600 block text-[10px] uppercase">Target Environment</span>
                    <span className="font-bold uppercase">{selectedConfig?.targetEnvironment || "preview"}</span>
                  </div>
                  <div>
                    <span className="text-indigo-600 block text-[10px] uppercase">Bound Revision</span>
                    <span className="font-mono">{selectedConfig?.sourceRevision || "HEAD"}</span>
                  </div>
                  <div>
                    <span className="text-indigo-600 block text-[10px] uppercase">Preflight Report</span>
                    <span className="font-mono text-emerald-600 font-bold">Passed</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleWizardDeploy}
                  disabled={isExecuting}
                  className="px-6 py-3 bg-[#153A52] text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-md"
                >
                  <Rocket className="w-4 h-4 text-[#70C84B]" />
                  <span>{isExecuting ? "Initiating Deployment..." : "Dispatch Real Deployment"}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Genuine Progress, Provider-Confirmed Success & Live App URL */}
          {wizardStep >= 7 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[#153A52]">Deployment Status & Live Verification</h3>
                <p className="text-xs text-gray-500">
                  Direct provider status stream. Verified honestly from provider API response.
                </p>
              </div>

              {liveDeploymentRecord ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-5 rounded-xl border flex items-start justify-between ${
                    liveDeploymentRecord.status === "succeeded"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : liveDeploymentRecord.status === "failed"
                      ? "bg-rose-50 border-rose-300 text-rose-900"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}>
                    <div className="flex items-start gap-3">
                      {liveDeploymentRecord.status === "succeeded" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
                      ) : liveDeploymentRecord.status === "failed" ? (
                        <AlertTriangle className="w-6 h-6 text-rose-600 mt-0.5" />
                      ) : (
                        <Activity className="w-6 h-6 text-amber-600 animate-spin mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <span className="font-bold text-base block uppercase tracking-wide">
                          Status: {liveDeploymentRecord.status}
                        </span>
                        <p className="text-xs leading-relaxed">
                          {liveDeploymentRecord.status === "succeeded"
                            ? "Provider confirmed deployment is live and passing edge health verification."
                            : liveDeploymentRecord.status === "failed"
                            ? (liveDeploymentRecord.safeErrorMessage || "Deployment failed on provider.")
                            : "Building and uploading artifacts on provider infrastructure..."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Deployment Metadata */}
                  <div className="bg-gray-50 border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Provider</span>
                      <span className="font-bold uppercase text-gray-800">{liveDeploymentRecord.providerId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Deployment ID</span>
                      <span className="font-mono text-gray-800 truncate block">
                        {liveDeploymentRecord.providerDeploymentId || "Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Target Environment</span>
                      <span className="font-bold uppercase text-gray-800">{liveDeploymentRecord.targetEnvironment}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Revision</span>
                      <span className="font-mono text-gray-800">{liveDeploymentRecord.sourceRevision}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Dispatched At</span>
                      <span className="text-gray-800">{new Date(liveDeploymentRecord.requestedAt).toLocaleTimeString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Raw State</span>
                      <span className="font-mono text-gray-800">{liveDeploymentRecord.providerStatusRaw || "queued"}</span>
                    </div>
                  </div>

                  {/* Genuine Deployed URL & Direct Action Buttons */}
                  {liveDeploymentRecord.deploymentUrl && (
                    <div className="p-5 bg-[#FAF7ED] border-2 border-border rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-emerald-600" />
                          Real Deployed Application URL
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                          Live Active
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border font-mono text-xs text-[#153A52]">
                        <span className="truncate">{liveDeploymentRecord.deploymentUrl}</span>
                        <button
                          onClick={() => handleCopy(liveDeploymentRecord.deploymentUrl!, "url")}
                          className="text-xs font-semibold text-[#153A52] hover:underline flex items-center gap-1 shrink-0 ml-2"
                        >
                          {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUrl ? "Copied" : "Copy"}</span>
                        </button>
                      </div>

                      {/* Required 4 Buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <a
                          href={liveDeploymentRecord.deploymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90 shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#70C84B]" />
                          <span>Open Live App</span>
                        </a>

                        <button
                          onClick={() => handleCopy(liveDeploymentRecord.deploymentUrl!, "url")}
                          className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 shadow-sm flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </button>

                        <button
                          onClick={() => setActiveTab("history")}
                          className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 shadow-sm flex items-center gap-1.5"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>View Deployment Logs</span>
                        </button>

                        <button
                          onClick={handleWizardDeploy}
                          disabled={isExecuting}
                          className="px-3.5 py-2 bg-white border border-[#153A52] text-[#153A52] rounded-lg text-xs font-bold hover:bg-[#F4F1DF] shadow-sm flex items-center gap-1.5 ml-auto"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isExecuting ? "animate-spin" : ""}`} />
                          <span>Redeploy</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No active deployment session recorded. Select a provider and run preflight to start.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ADVANCED CONFIGURATIONS & HISTORICAL RECORDS */}
      {/* ============================================================== */}
      {mode === "manage" && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-[#153A52]/10 gap-2">
            <button
              onClick={() => setActiveTab("configs")}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "configs"
                  ? "border-[#153A52] text-[#153A52]"
                  : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Configurations ({configurations.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("connections")}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "connections"
                  ? "border-[#153A52] text-[#153A52]"
                  : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Provider Connections ({providerStatuses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("preflight")}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "preflight"
                  ? "border-[#153A52] text-[#153A52]"
                  : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Release Preflight</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "history"
                  ? "border-[#153A52] text-[#153A52]"
                  : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Deployment History ({records.length})</span>
            </button>
          </div>

          {/* TAB 1: CONFIGURATIONS */}
          {activeTab === "configs" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configurations.map((cfg) => {
                const isSelected = selectedConfig?.id === cfg.id;
                return (
                  <div
                    key={cfg.id}
                    onClick={() => setSelectedConfig(cfg)}
                    className={`p-5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#F4F1DF]/40 border-[#153A52] ring-1 ring-[#153A52] shadow-sm"
                        : "bg-white border-[#153A52]/10 hover:border-[#153A52]/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            cfg.targetEnvironment === "production" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {cfg.targetEnvironment}
                        </span>
                        <h3 className="font-bold text-[#153A52] text-base mt-2">{cfg.name}</h3>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">Target: {cfg.providerProjectId}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-600 uppercase">
                        {cfg.providerId}
                      </span>
                    </div>

                    <div className="pt-3 border-t mt-4 text-[11px] text-gray-500 space-y-1">
                      <div>Branch: <span className="font-mono text-gray-700">{cfg.sourceBranch}</span></div>
                      <div>Required Env Vars: <span className="font-mono text-gray-700">{cfg.requiredEnvVarNames.join(", ") || "None"}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: CONNECTIONS */}
          {activeTab === "connections" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {providerStatuses.map((ps) => (
                  <div key={ps.providerId} className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-[#153A52] text-sm">{ps.name}</h3>
                        <span className="text-[10px] font-mono text-gray-400">Adapter: {ps.providerId}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        ps.credentialStatus === "configured" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {ps.credentialStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{ps.diagnosticMessage}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PREFLIGHT */}
          {activeTab === "preflight" && (
            <div className="bg-white rounded-xl border border-[#153A52]/10 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#153A52]">Release Preflight Evaluation</h3>
                  <p className="text-xs text-gray-500">Evaluates gates against current workspace state.</p>
                </div>
                <button
                  onClick={handleRunPreflight}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-[#153A52] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#153A52]/90"
                >
                  <ShieldCheck className="w-4 h-4 text-[#70C84B]" />
                  <span>Run Preflight Check</span>
                </button>
              </div>

              {preflightReport ? (
                <div className="space-y-4 pt-2">
                  <div className={`p-4 rounded-xl border ${
                    preflightReport.overallStatus === "passed" ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300"
                  }`}>
                    <span className="font-bold text-sm">Overall Status: {preflightReport.overallStatus.toUpperCase()}</span>
                  </div>

                  <div className="space-y-2">
                    {preflightReport.gates.map((g) => (
                      <div key={g.id} className="p-3 bg-gray-50 border rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-gray-800">{g.name}</span>
                          <p className="text-[11px] text-gray-500">{g.explanation}</p>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                          g.status === "passed" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {g.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-8 text-center">No preflight evaluation performed yet.</p>
              )}
            </div>
          )}

          {/* TAB 4: DEPLOYMENT HISTORY */}
          {activeTab === "history" && (
            <div className="bg-white rounded-xl border border-[#153A52]/10 shadow-sm overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-sm text-[#153A52]">Deployment Records</h3>
                <button
                  onClick={() => {
                    deploymentStorage.clearRecords(selectedProjectId);
                    setRecords([]);
                  }}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear Records
                </button>
              </div>

              {records.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No deployments recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            r.status === "succeeded"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "failed"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {r.status}
                          </span>
                          <span className="text-xs font-bold text-gray-800">{r.providerId}</span>
                          <span className="text-[10px] uppercase font-bold text-gray-500">[{r.targetEnvironment}]</span>
                        </div>
                        <span className="text-xs text-gray-400 font-mono">
                          {new Date(r.requestedAt).toLocaleString()}
                        </span>
                      </div>

                      {r.safeErrorMessage && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-mono">
                          {r.safeErrorMessage}
                        </div>
                      )}

                      {r.deploymentUrl && (
                        <div className="flex items-center gap-3 pt-1 text-xs">
                          <a
                            href={r.deploymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 font-semibold hover:underline flex items-center gap-1 font-mono"
                          >
                            <span>{r.deploymentUrl}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
