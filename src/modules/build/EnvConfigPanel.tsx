import React, { useState } from "react";
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  Copy,
  Check,
  Link2,
  Save,
  CheckCheck,
  Eye,
  EyeOff,
  Database,
  Bot,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ProjectEnvironmentReport } from "@/lib/build/envConfigService";
import type { TargetProjectVarStatus } from "@/lib/storage/targetProjectEnvStorage";

interface EnvConfigPanelProps {
  report: ProjectEnvironmentReport;
  projectId?: string;
  onOpenSettings?: () => void;
  onUpdateTargetVariable?: (varName: string, value: string, status?: TargetProjectVarStatus) => void;
  onApplyProviderMapping?: (provider: "supabase" | "gemini") => void;
}

export const EnvConfigPanel: React.FC<EnvConfigPanelProps> = ({
  report,
  onOpenSettings,
  onUpdateTargetVariable,
  onApplyProviderMapping,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);

  // Dedicated Target Project Credential Inputs
  const [targetSupabaseUrl, setTargetSupabaseUrl] = useState<string>("");
  const [targetSupabaseKey, setTargetSupabaseKey] = useState<string>("");
  const [targetGeminiKey, setTargetGeminiKey] = useState<string>("");
  const [showSupabaseKey, setShowSupabaseKey] = useState<boolean>(false);
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [credSaveNotice, setCredSaveNotice] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveEdit = (varName: string) => {
    if (onUpdateTargetVariable) {
      const trimmed = editValue.trim();
      const status: TargetProjectVarStatus = trimmed ? "CONFIGURED" : "MISSING";
      onUpdateTargetVariable(varName, trimmed, status);
    }
    setEditingVar(null);
    setEditValue("");
  };

  const handleSaveTargetCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateTargetVariable) return;

    let savedCount = 0;
    if (targetSupabaseUrl.trim()) {
      onUpdateTargetVariable("VITE_SUPABASE_URL", targetSupabaseUrl.trim(), "CONFIGURED");
      savedCount++;
    }
    if (targetSupabaseKey.trim()) {
      onUpdateTargetVariable("VITE_SUPABASE_ANON_KEY", targetSupabaseKey.trim(), "CONFIGURED");
      savedCount++;
    }
    if (targetGeminiKey.trim()) {
      onUpdateTargetVariable("GEMINI_API_KEY", targetGeminiKey.trim(), "CONFIGURED");
      savedCount++;
    }

    if (savedCount > 0) {
      setCredSaveNotice(`Saved ${savedCount} target credential(s) for this project.`);
      setTimeout(() => setCredSaveNotice(null), 4000);
      setTargetSupabaseUrl("");
      setTargetSupabaseKey("");
      setTargetGeminiKey("");
    }
  };

  const handleTriggerMapping = (provider: "supabase" | "gemini") => {
    if (onApplyProviderMapping) {
      onApplyProviderMapping(provider);
      setMappingNotice(`Mapped available ${provider.toUpperCase()} credentials into target project.`);
      setTimeout(() => setMappingNotice(null), 3500);
    }
  };

  const getStatusBadge = (status: TargetProjectVarStatus) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
            <CheckCheck className="w-3 h-3 text-emerald-600" />
            VERIFIED
          </span>
        );
      case "CONFIGURED":
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            CONFIGURED
          </span>
        );
      case "EXAMPLE ONLY":
        return (
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-500" />
            EXAMPLE ONLY
          </span>
        );
      case "MISSING":
      default:
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            MISSING
          </span>
        );
    }
  };

  // Find existing values to display placeholders
  const currentSupabaseUrl = report.variables.find((v) => v.name === "VITE_SUPABASE_URL")?.actualConfiguredValue;
  const currentSupabaseKey = report.variables.find((v) => v.name === "VITE_SUPABASE_ANON_KEY")?.actualConfiguredValue;
  const currentGeminiKey = report.variables.find((v) => v.name === "GEMINI_API_KEY")?.actualConfiguredValue;

  return (
    <Card className="bg-surface border-2 border-border p-4 shadow-hard">
      {/* Header bar */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-tactile-sm bg-[#FAF7ED] border border-border text-foreground">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-sm text-foreground">
                Target Project Environment ({report.totalConfigured}/{report.totalRequired} Configured)
              </h3>
              {report.missingRequiredCount === 0 ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ALL REQUIRED SET
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  {report.missingRequiredCount} REQUIRED MISSING
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5">
              Isolated target configuration for <strong className="text-foreground">{report.projectName}</strong>. ProjectNova host keys are kept separate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              className="text-xs font-mono font-semibold px-2 py-1 bg-[#FAF7ED] border border-border rounded hover:bg-black/5 flex items-center gap-1 text-foreground"
            >
              <span>Provider Settings</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-foreground-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-foreground-muted" />
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 pt-3 border-t border-border/10">
          {/* SECTION 1: Direct Target Credential Input Form */}
          <div className="p-4 bg-white border border-border/30 rounded-tactile shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/10 pb-2">
              <div className="space-y-0.5">
                <span className="font-display font-bold text-xs text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  Target Project Credentials Setup (For Configured ZIP Export)
                </span>
                <p className="text-[11px] text-foreground-muted">
                  Enter explicit keys for this target project. Values will be written to <code className="font-mono bg-[#FAF7ED] px-1 py-0.5 rounded">.env</code> when you download a <strong>Configured ZIP</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerMapping("supabase")}
                  className="px-2 py-1 bg-[#FAF7ED] border border-border text-[10px] font-mono font-bold text-emerald-900 rounded hover:bg-emerald-50 flex items-center gap-1 transition-all"
                  title="Copy available host Supabase keys into this target project"
                >
                  <Link2 className="w-3 h-3 text-emerald-600" />
                  Map Host Supabase
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerMapping("gemini")}
                  className="px-2 py-1 bg-[#FAF7ED] border border-border text-[10px] font-mono font-bold text-indigo-900 rounded hover:bg-indigo-50 flex items-center gap-1 transition-all"
                  title="Configure target project AI provider to Gemini"
                >
                  <Link2 className="w-3 h-3 text-indigo-600" />
                  Map Host Gemini
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTargetCredentials} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Supabase Project URL */}
                <div>
                  <label className="text-[11px] font-bold text-foreground block mb-1 flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" />
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={targetSupabaseUrl}
                    onChange={(e) => setTargetSupabaseUrl(e.target.value)}
                    placeholder={currentSupabaseUrl || "https://your-project.supabase.co"}
                    className="w-full px-2.5 py-1.5 bg-[#FAF7ED] border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[9px] font-mono text-foreground-muted mt-0.5 block truncate">
                    Var: VITE_SUPABASE_URL (Client)
                  </span>
                </div>

                {/* 2. Supabase Publishable / Anon Key */}
                <div>
                  <label className="text-[11px] font-bold text-foreground block mb-1 flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" />
                    Supabase Anon Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSupabaseKey ? "text" : "password"}
                      value={targetSupabaseKey}
                      onChange={(e) => setTargetSupabaseKey(e.target.value)}
                      placeholder={currentSupabaseKey ? "•••••••••••••••• (Configured)" : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
                      className="w-full pl-2.5 pr-8 py-1.5 bg-[#FAF7ED] border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                      className="absolute right-2 top-2 text-foreground-muted hover:text-foreground"
                    >
                      {showSupabaseKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-foreground-muted mt-0.5 block truncate">
                    Var: VITE_SUPABASE_ANON_KEY (Client)
                  </span>
                </div>

                {/* 3. Google Gemini API Key */}
                <div>
                  <label className="text-[11px] font-bold text-foreground block mb-1 flex items-center gap-1">
                    <Bot className="w-3 h-3 text-indigo-600" />
                    Google Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? "text" : "password"}
                      value={targetGeminiKey}
                      onChange={(e) => setTargetGeminiKey(e.target.value)}
                      placeholder={currentGeminiKey ? "•••••••••••••••• (Configured)" : "AIzaSy..."}
                      className="w-full pl-2.5 pr-8 py-1.5 bg-[#FAF7ED] border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2 top-2 text-foreground-muted hover:text-foreground"
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-foreground-muted mt-0.5 block truncate">
                    Var: GEMINI_API_KEY (Server Only)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-foreground-muted">
                  {credSaveNotice ? (
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {credSaveNotice}
                    </span>
                  ) : mappingNotice ? (
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {mappingNotice}
                    </span>
                  ) : (
                    <span>Values are stored strictly for this target project only.</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!targetSupabaseUrl.trim() && !targetSupabaseKey.trim() && !targetGeminiKey.trim()}
                  className="px-4 py-1.5 bg-[#153A52] text-[#F4F1DF] text-xs font-bold rounded hover:bg-[#1f4e6d] disabled:opacity-40 flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Target Credentials
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 2: Variables Table */}
          <div className="border border-border/20 rounded-tactile overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#FAF7ED] font-mono font-bold text-[10px] uppercase text-foreground-muted border-b border-border/20">
              <div className="col-span-3">Variable Name</div>
              <div className="col-span-4">Purpose & Setup</div>
              <div className="col-span-2">Scope</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Action / Value</div>
            </div>

            <div className="divide-y divide-border/10 text-xs font-sans">
              {report.variables.map((v) => (
                <div key={v.name} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-[#FAF7ED]/50 transition-colors">
                  {/* Name */}
                  <div className="col-span-3 font-mono font-bold text-foreground truncate flex items-center gap-1.5">
                    <span className="truncate" title={v.name}>
                      {v.name}
                    </span>
                    {v.isRequired && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-100 text-red-800 font-semibold shrink-0">
                        REQ
                      </span>
                    )}
                  </div>

                  {/* Purpose & Setup Instructions */}
                  <div className="col-span-4 space-y-0.5">
                    <p className="text-foreground leading-tight text-xs font-medium">{v.purpose}</p>
                    <p className="text-[10px] font-mono text-foreground-muted">{v.setupInstructions}</p>
                  </div>

                  {/* Scope */}
                  <div className="col-span-2">
                    <Badge variant={v.scope === "client" ? "blue" : "yellow"}>
                      {v.scope === "client" ? "Client (Vite)" : "Server Only"}
                    </Badge>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-1">
                    {getStatusBadge(v.status)}
                  </div>

                  {/* Action / Value */}
                  <div className="col-span-2 text-right flex items-center justify-end gap-1">
                    {editingVar === v.name ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="value..."
                          className="w-24 px-1.5 py-0.5 bg-white border border-border text-[10px] font-mono rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(v.name)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Save"
                        >
                          <Save className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVar(v.name);
                            setEditValue(v.actualConfiguredValue || "");
                          }}
                          className="px-1.5 py-0.5 bg-[#FAF7ED] border border-border/50 text-[10px] font-mono rounded hover:bg-surface text-foreground"
                          title="Edit target value"
                        >
                          {v.actualConfiguredValue ? "Edit" : "Configure"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${v.name}=${v.actualConfiguredValue || v.safeExampleValue}`, v.name)}
                          className="p-1 rounded hover:bg-black/5 text-foreground-muted hover:text-foreground"
                          title="Copy template line"
                        >
                          {copiedKey === v.name ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
