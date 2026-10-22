import React, { useState, useEffect } from "react";
import {
  Settings,
  Database,
  Bot,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Server,
  Zap,
} from "lucide-react";
import { aiClient } from "@/lib/ai/client";
import type { GatewayHealthResponse, SupportedGeminiModel } from "@/lib/ai/types";
import { getOrCreateSessionId } from "@/lib/storage/userSession";

interface ServiceStatus {
  state: "unconfigured" | "configured" | "testing" | "connected" | "error";
  label: string;
  detail: string;
  lastChecked?: string;
}

export const SettingsPage: React.FC = () => {
  const sessionId = getOrCreateSessionId();

  // Supabase State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>("");
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState<string>("");
  const [showSupabaseKey, setShowSupabaseKey] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<ServiceStatus>({
    state: "unconfigured",
    label: "Not Configured",
    detail: "Enter your Project URL and Publishable Anon Key.",
  });
  const [isProcessingSupabase, setIsProcessingSupabase] = useState(false);

  // Gemini State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash-lite");
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [geminiStatus, setGeminiStatus] = useState<ServiceStatus>({
    state: "unconfigured",
    label: "Not Configured",
    detail: "Enter your Gemini API Key to enable AI generation.",
  });
  const [isProcessingGemini, setIsProcessingGemini] = useState(false);
  const [inferenceSnippet, setInferenceSnippet] = useState<string | null>(null);

  // Advanced Drawer & Health
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealthResponse | null>(null);
  const [localStorageCount, setLocalStorageCount] = useState<number>(0);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const [supportedModels, setSupportedModels] = useState<SupportedGeminiModel[]>([
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (Default)", description: "Ultra-fast code generation & architecture synthesis" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Next-gen multimodal workhorse model" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Complex systems reasoning & enterprise design" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast, versatile inference" },
  ]);

  useEffect(() => {
    checkLocalStorage();
    probeGateway();
  }, []);

  const checkLocalStorage = () => {
    try {
      setLocalStorageCount(localStorage.length);
    } catch {
      setLocalStorageCount(0);
    }
  };

  const probeGateway = async () => {
    setIsRefreshingAll(true);
    try {
      const health = await aiClient.checkHealth();
      setGatewayHealth(health);

      if (health.supportedModels && health.supportedModels.length > 0) {
        setSupportedModels(health.supportedModels);
      }
      if (health.model) {
        setSelectedModel(health.model);
      }

      // Evaluate Gemini initial status
      if (health.hasKey) {
        const sourceLabel = health.credentials?.geminiSource === "user_session"
          ? "User Session Key"
          : "Server Environment Key";

        setGeminiStatus((prev) => {
          // If already successfully tested / connected, preserve 'connected'
          if (prev.state === "connected") return prev;
          return {
            state: "configured",
            label: "Saved / Ready to Test",
            detail: `Active on server via ${sourceLabel}. Click 'Save & Test Connection' to verify live tokens.`,
            lastChecked: new Date().toLocaleTimeString(),
          };
        });
      } else {
        setGeminiStatus({
          state: "unconfigured",
          label: "Not Configured",
          detail: "No active API key detected on port 4000 gateway.",
          lastChecked: new Date().toLocaleTimeString(),
        });
      }

      // Evaluate Supabase initial status
      if (health.credentials?.supabaseUrlConfigured && health.credentials?.supabaseAnonKeyConfigured) {
        setSupabaseStatus((prev) => {
          if (prev.state === "connected") return prev;
          return {
            state: "configured",
            label: "Saved / Ready to Test",
            detail: `Credentials detected on server (${health.credentials?.supabaseSource === "user_session" ? "User Session" : "Server Environment"}). Click 'Save & Test Connection' to verify PostgreSQL connection.`,
            lastChecked: new Date().toLocaleTimeString(),
          };
        });
      } else {
        setSupabaseStatus({
          state: "unconfigured",
          label: "Not Configured",
          detail: "Supabase credentials are not set on server.",
          lastChecked: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setGatewayHealth(null);
      setGeminiStatus({
        state: "error",
        label: "Gateway Offline",
        detail: "Cannot reach AI Gateway on port 4000. Start using 'bun run server'.",
      });
      setSupabaseStatus({
        state: "error",
        label: "Gateway Offline",
        detail: "AI Gateway port 4000 unreachable for credential handling.",
      });
    } finally {
      setIsRefreshingAll(false);
    }
  };

  /* =========================================================================
     SUPABASE: SAVE & TEST COMBINED ACTION
     ========================================================================= */
  const handleSaveAndTestSupabase = async () => {
    // 1. Validation if new input is typed
    if (supabaseUrlInput.trim() && !supabaseUrlInput.trim().startsWith("http")) {
      setSupabaseStatus({
        state: "error",
        label: "Invalid URL",
        detail: "Project URL must begin with https:// or http://",
      });
      return;
    }

    if (supabaseAnonKeyInput.trim() && supabaseAnonKeyInput.trim().length < 15) {
      setSupabaseStatus({
        state: "error",
        label: "Invalid Anon Key",
        detail: "Publishable anon key must be at least 15 characters long.",
      });
      return;
    }

    setIsProcessingSupabase(true);
    setSupabaseStatus({
      state: "testing",
      label: "Saving & Testing...",
      detail: "Updating credentials on server and executing connection handshake...",
    });

    try {
      // Save credentials if user entered new values
      if (supabaseUrlInput.trim() || supabaseAnonKeyInput.trim()) {
        await aiClient.updateCredentials({
          sessionId,
          supabaseUrl: supabaseUrlInput.trim() || undefined,
          supabaseAnonKey: supabaseAnonKeyInput.trim() || undefined,
        });
        setSupabaseUrlInput("");
        setSupabaseAnonKeyInput("");
        setShowSupabaseKey(false);
      }

      // Execute live connection test
      const res = await aiClient.testSupabaseConnection({
        sessionId,
      });

      if (res && res.success) {
        setSupabaseStatus({
          state: "connected",
          label: "Connected & Verified",
          detail: res.message || "Successfully connected to Supabase PostgreSQL (HTTP 200).",
          lastChecked: new Date().toLocaleTimeString(),
        });
      } else {
        setSupabaseStatus({
          state: "error",
          label: "Connection Failed",
          detail: res.error || "Supabase returned an authentication or network error.",
          lastChecked: new Date().toLocaleTimeString(),
        });
      }

      // Refresh gateway diagnostics
      await probeGateway();
    } catch (err: any) {
      setSupabaseStatus({
        state: "error",
        label: "Connection Failed",
        detail: err.message || "Failed to reach Supabase API.",
        lastChecked: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsProcessingSupabase(false);
    }
  };

  const handleClearSupabase = async () => {
    setIsProcessingSupabase(true);
    try {
      await aiClient.updateCredentials({
        sessionId,
        supabaseUrl: "",
        supabaseAnonKey: "",
      });
      setSupabaseUrlInput("");
      setSupabaseAnonKeyInput("");
      setSupabaseStatus({
        state: "unconfigured",
        label: "Not Configured",
        detail: "Supabase credentials removed for this session.",
        lastChecked: new Date().toLocaleTimeString(),
      });
      await probeGateway();
    } catch (err: any) {
      setSupabaseStatus({
        state: "error",
        label: "Removal Failed",
        detail: err.message || "Could not clear session credentials.",
      });
    } finally {
      setIsProcessingSupabase(false);
    }
  };

  /* =========================================================================
     GEMINI: SAVE & TEST COMBINED ACTION
     ========================================================================= */
  const handleSaveAndTestGemini = async () => {
    if (geminiKeyInput.trim() && geminiKeyInput.trim().length < 10) {
      setGeminiStatus({
        state: "error",
        label: "Invalid API Key",
        detail: "Gemini API key must be at least 10 characters long.",
      });
      return;
    }

    setIsProcessingGemini(true);
    setInferenceSnippet(null);
    setGeminiStatus({
      state: "testing",
      label: "Saving & Testing...",
      detail: `Updating server session and testing live inference on model ${selectedModel}...`,
    });

    try {
      // Save credentials if key entered or model changed
      if (geminiKeyInput.trim() || selectedModel !== gatewayHealth?.model) {
        await aiClient.updateCredentials({
          sessionId,
          geminiApiKey: geminiKeyInput.trim() || undefined,
          geminiModel: selectedModel,
        });
        setGeminiKeyInput("");
        setShowGeminiKey(false);
      }

      // Test live token generation
      const res = await aiClient.testGeminiInference({
        model: selectedModel,
        sessionId,
      });

      if (res && res.output) {
        setInferenceSnippet(res.output);
        setGeminiStatus({
          state: "connected",
          label: "Connected & Verified",
          detail: `Model '${res.model}' responded successfully. Live token inference confirmed.`,
          lastChecked: new Date().toLocaleTimeString(),
        });
      } else {
        setGeminiStatus({
          state: "error",
          label: "Verification Failed",
          detail: "AI gateway did not return a valid completion output.",
          lastChecked: new Date().toLocaleTimeString(),
        });
      }

      await probeGateway();
    } catch (err: any) {
      setGeminiStatus({
        state: "error",
        label: "Test Failed",
        detail: err.message || "Failed to complete AI model inference probe.",
        lastChecked: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsProcessingGemini(false);
    }
  };

  const handleClearGemini = async () => {
    setIsProcessingGemini(true);
    try {
      await aiClient.clearCredentials(sessionId);
      setGeminiKeyInput("");
      setInferenceSnippet(null);
      setGeminiStatus({
        state: "unconfigured",
        label: "Not Configured",
        detail: "Session API key cleared. Gateway reverted to server defaults if present.",
        lastChecked: new Date().toLocaleTimeString(),
      });
      await probeGateway();
    } catch (err: any) {
      setGeminiStatus({
        state: "error",
        label: "Reset Failed",
        detail: err.message || "Could not reset credentials.",
      });
    } finally {
      setIsProcessingGemini(false);
    }
  };

  /* =========================================================================
     STATUS BADGE HELPER (Strict distinction: Saved vs Connected)
     ========================================================================= */
  const renderStatusBadge = (status: ServiceStatus) => {
    switch (status.state) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#70C84B]/20 text-[#153A52] border border-[#70C84B]/50 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#70C84B]" />
            Connected
          </span>
        );
      case "configured":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Saved (Untested)
          </span>
        );
      case "testing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#153A52] border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            Testing...
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Connection Error
          </span>
        );
      case "unconfigured":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            Not Configured
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1DF] text-[#153A52] p-6 md:p-10 space-y-8">
      {/* Scope Separation Banner */}
      <div className="p-3.5 bg-[#FAF7ED] border border-[#153A52]/15 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#153A52] text-[#F4F1DF]">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-[#153A52] block font-bold">
              ProjectNova Host Provider Credentials
            </strong>
            <span className="text-[#153A52]/70 text-[11px]">
              These credentials power ProjectNova's own runtime. Selected target-project environment variables in Build Studio remain strictly isolated.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#153A52]/70 shrink-0">
          <span>Session: {sessionId.slice(0, 10)}...</span>
          <button
            type="button"
            onClick={probeGateway}
            disabled={isRefreshingAll}
            className="px-2.5 py-1 bg-white border border-[#153A52]/20 rounded-md font-bold text-[#153A52] hover:bg-black/5 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingAll ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#153A52]">
          Provider Setup
        </h1>
        <p className="text-sm text-[#153A52]/75 max-w-2xl font-medium">
          Configure Supabase PostgreSQL for cloud synchronization and Google Gemini for AI-driven code generation.
        </p>
      </div>

      {/* Two Premium Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* =========================================================================
            CARD 1: SUPABASE POSTGRESQL
            ========================================================================= */}
        <div className="bg-white rounded-2xl border-2 border-[#153A52]/15 p-6 md:p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#153A52]/10">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Database className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#153A52]">Supabase</h2>
                <p className="text-xs text-[#153A52]/70 font-medium">
                  Cloud database storage & multi-device project sync
                </p>
              </div>
            </div>
            {renderStatusBadge(supabaseStatus)}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Project URL */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70 block mb-1.5">
                Project URL
              </label>
              <input
                type="text"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                placeholder={
                  gatewayHealth?.credentials?.supabaseUrlConfigured
                    ? "Configured on server (leave blank to keep unchanged)"
                    : "https://your-project.supabase.co"
                }
                className="w-full px-3.5 py-2.5 bg-[#FAF7ED] border border-[#153A52]/20 rounded-xl text-xs font-mono text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
              />
            </div>

            {/* Publishable Anon Key */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70 block mb-1.5">
                Publishable / Anon Key
              </label>
              <div className="relative">
                <input
                  type={showSupabaseKey ? "text" : "password"}
                  value={supabaseAnonKeyInput}
                  onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                  placeholder={
                    gatewayHealth?.credentials?.supabaseAnonKeyConfigured
                      ? "•••••••••••••••••••••••• (Leave blank to keep unchanged)"
                      : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  }
                  className="w-full pl-3.5 pr-11 py-2.5 bg-[#FAF7ED] border border-[#153A52]/20 rounded-xl text-xs font-mono text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  className="absolute right-3 top-3 text-[#153A52]/50 hover:text-[#153A52]"
                  title={showSupabaseKey ? "Hide key" : "Show key"}
                >
                  {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Status Message / Error Banner */}
            <div
              className={`p-3 rounded-xl text-xs font-mono transition-colors ${
                supabaseStatus.state === "error"
                  ? "bg-rose-50 border border-rose-200 text-rose-900"
                  : supabaseStatus.state === "connected"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                  : "bg-[#FAF7ED] border border-[#153A52]/10 text-[#153A52]/80"
              }`}
            >
              <div className="font-sans font-bold mb-0.5 text-[11px] uppercase tracking-wider">
                Status Details:
              </div>
              <p className="text-[11px] leading-relaxed break-words">{supabaseStatus.detail}</p>
            </div>

            {/* Action Row */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {gatewayHealth?.credentials?.supabaseSource === "user_session" ? (
                <button
                  type="button"
                  onClick={handleClearSupabase}
                  disabled={isProcessingSupabase}
                  className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleSaveAndTestSupabase}
                disabled={isProcessingSupabase}
                className="px-5 py-2.5 bg-[#153A52] hover:bg-[#1f4e6d] text-[#F4F1DF] text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {isProcessingSupabase ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#70C84B]" />
                ) : (
                  <Zap className="w-4 h-4 text-[#70C84B]" />
                )}
                Save & Test Connection
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CARD 2: GOOGLE GEMINI AI
            ========================================================================= */}
        <div className="bg-white rounded-2xl border-2 border-[#153A52]/15 p-6 md:p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#153A52]/10">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-800 border border-indigo-200">
                <Bot className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#153A52]">Google Gemini</h2>
                <p className="text-xs text-[#153A52]/70 font-medium">
                  Autonomous code generation & intelligent pipeline orchestration
                </p>
              </div>
            </div>
            {renderStatusBadge(geminiStatus)}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Gemini API Key */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70 block mb-1.5">
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={
                    gatewayHealth?.hasKey
                      ? "•••••••••••••••••••••••• (Leave blank to keep unchanged)"
                      : "AIzaSy..."
                  }
                  className="w-full pl-3.5 pr-11 py-2.5 bg-[#FAF7ED] border border-[#153A52]/20 rounded-xl text-xs font-mono text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-3 text-[#153A52]/50 hover:text-[#153A52]"
                  title={showGeminiKey ? "Hide key" : "Show key"}
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#153A52]/60 mt-1 font-sans">
                Keys remain server-only in loopback memory on port 4000. Never exposed to browser bundles.
              </p>
            </div>

            {/* Model Selector */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70 block mb-1.5">
                Supported Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF7ED] border border-[#153A52]/20 rounded-xl text-xs font-medium text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
              >
                {supportedModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Message / Error Banner */}
            <div
              className={`p-3 rounded-xl text-xs font-mono transition-colors ${
                geminiStatus.state === "error"
                  ? "bg-rose-50 border border-rose-200 text-rose-900"
                  : geminiStatus.state === "connected"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                  : "bg-[#FAF7ED] border border-[#153A52]/10 text-[#153A52]/80"
              }`}
            >
              <div className="font-sans font-bold mb-0.5 text-[11px] uppercase tracking-wider">
                Status Details:
              </div>
              <p className="text-[11px] leading-relaxed break-words">{geminiStatus.detail}</p>
            </div>

            {/* Live Inference Snippet Verified */}
            {inferenceSnippet && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Live Token Output Verified ({selectedModel}):
                </div>
                <div className="italic font-mono text-[11px] bg-white/80 p-2 rounded border border-emerald-100">
                  "{inferenceSnippet}"
                </div>
              </div>
            )}

            {/* Action Row */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {gatewayHealth?.credentials?.geminiSource === "user_session" ? (
                <button
                  type="button"
                  onClick={handleClearGemini}
                  disabled={isProcessingGemini}
                  className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleSaveAndTestGemini}
                disabled={isProcessingGemini}
                className="px-5 py-2.5 bg-[#153A52] hover:bg-[#1f4e6d] text-[#F4F1DF] text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {isProcessingGemini ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#70C84B]" />
                ) : (
                  <Zap className="w-4 h-4 text-[#70C84B]" />
                )}
                Save & Test Connection
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          COLLAPSIBLE ADVANCED SETTINGS & SERVER DIAGNOSTICS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#153A52]/15 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#FAF7ED]/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-[#153A52]/70" />
            <span className="font-bold text-sm text-[#153A52]">
              Advanced Settings & Diagnostics
            </span>
          </div>
          {isAdvancedOpen ? (
            <ChevronDown className="w-4 h-4 text-[#153A52]/60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#153A52]/60" />
          )}
        </button>

        {isAdvancedOpen && (
          <div className="p-6 border-t border-[#153A52]/10 space-y-6 bg-[#FAF7ED]/20 text-xs">
            {/* Diagnostics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#153A52]/60">
                    AI Gateway Loopback
                  </span>
                  <Server className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="font-bold text-sm text-[#153A52]">
                  {gatewayHealth ? "Port 4000 Connected" : "Port 4000 Offline"}
                </div>
                <div className="text-[11px] font-mono text-[#153A52]/70 mt-1">
                  Provider: {gatewayHealth?.provider || "none"}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#153A52]/60">
                    Local Storage Sandbox
                  </span>
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="font-bold text-sm text-[#153A52]">
                  Isolated Browser Storage
                </div>
                <div className="text-[11px] font-mono text-[#153A52]/70 mt-1">
                  {localStorageCount} keys stored locally
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#153A52]/10 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#153A52]/60">
                    Active Session ID
                  </span>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="font-mono text-xs font-bold text-[#153A52] truncate">
                  {sessionId}
                </div>
                <div className="text-[11px] text-[#153A52]/70 mt-1">
                  Isolates credentials in server memory
                </div>
              </div>
            </div>

            {/* Architecture Details */}
            <div className="p-4 bg-white rounded-xl border border-[#153A52]/10 space-y-2">
              <span className="font-bold text-[#153A52] block">
                Security Architecture & Secret Isolation Policy:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[#153A52]/80 leading-relaxed text-[11px]">
                <li>
                  <strong>Gemini Keys:</strong> Processed exclusively through the backend gateway at <code className="font-mono bg-[#FAF7ED] px-1 py-0.5 rounded">http://localhost:4000</code> and never bundled into client JavaScript.
                </li>
                <li>
                  <strong>Supabase Anon Keys:</strong> Restricted to publishable client scopes governed by Row Level Security (RLS). High-privilege service roles are strictly banned.
                </li>
                <li>
                  <strong>Target Project Independence:</strong> Target projects generated in Build Studio have their own dedicated <code className="font-mono bg-[#FAF7ED] px-1 py-0.5 rounded">.env.example</code> and isolated variables.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
