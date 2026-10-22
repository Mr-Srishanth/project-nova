import React, { useState } from "react";
import { ShieldCheck, Download, Copy, Check } from "lucide-react";
import type { EnvVariableSpec } from "@/types/release";
import { generateSafeEnvExample } from "@/lib/release/envConfigManager";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface EnvConfigTabProps {
  envVariables: EnvVariableSpec[];
  onAddVariable: (variable: EnvVariableSpec) => void;
}

export const EnvConfigTab: React.FC<EnvConfigTabProps> = ({ envVariables, onAddVariable }) => {
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newRequired, setNewRequired] = useState(true);

  const envExampleContent = generateSafeEnvExample(envVariables);

  const handleCopy = () => {
    navigator.clipboard.writeText(envExampleContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([envExampleContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.example";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddVariable({
      name: newName.trim().toUpperCase(),
      description: newDesc.trim() || "Configured environment parameter",
      required: newRequired,
      exampleValue: newExample.trim() || "your_placeholder_value",
      status: "not_verified",
    });

    setNewName("");
    setNewDesc("");
    setNewExample("");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining safety policy */}
      <div className="p-4 bg-surface border-2 border-border rounded-tactile shadow-hard-sm space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-secondary" />
          <h3 className="font-bold text-sm text-foreground">
            Zero-Secret Environment Documentation Policy
          </h3>
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed">
          ProjectNova AI enforces strict secret isolation. Real secret values (API keys, database credentials) are <strong>never</strong> persisted in browser storage or checked into code. Document expected parameters and download safe, placeholder-only <code>.env.example</code> templates for deployment.
        </p>
      </div>

      {/* Grid: Left variables table, Right .env.example preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
            <h4 className="font-bold text-sm text-foreground">Documented Environment Variables</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/20 text-foreground-muted font-mono">
                    <th className="pb-2 font-bold">Variable Name</th>
                    <th className="pb-2 font-bold">Requirement</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10 font-mono">
                  {envVariables.map((v) => (
                    <tr key={v.name} className="py-2">
                      <td className="py-2 font-bold text-foreground">
                        {v.name}
                        <span className="block text-[11px] font-sans font-normal text-foreground-muted">
                          {v.description}
                        </span>
                      </td>
                      <td className="py-2">
                        {v.required ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded font-bold">
                            REQUIRED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] bg-surface-subtle text-foreground-muted rounded">
                            OPTIONAL
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                            v.status === "configured"
                              ? "bg-emerald-50 text-emerald-700"
                              : v.status === "missing"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {v.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Form to add custom variable */}
          <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
              Document Additional Parameter
            </h4>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-muted font-mono mb-1">Variable Name</label>
                  <input
                    type="text"
                    placeholder="e.g. STRIPE_PUBLIC_KEY"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block text-foreground-muted font-mono mb-1">Placeholder Example</label>
                  <input
                    type="text"
                    placeholder="pk_test_placeholder_key"
                    value={newExample}
                    onChange={(e) => setNewExample(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground-muted font-mono mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Purpose of this environment variable"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span>Mark as mandatory release requirement</span>
                </label>
                <Button type="submit" size="sm">
                  Add Parameter
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right side: .env.example live code view */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-foreground">
              Generated .env.example Template
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy} icon={copied ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Copy className="w-3.5 h-3.5" />}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
                Download
              </Button>
            </div>
          </div>

          <pre className="p-4 bg-navy-deep text-cream font-mono text-xs rounded-tactile border-2 border-border shadow-hard-sm overflow-x-auto whitespace-pre max-h-[480px]">
            {envExampleContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
