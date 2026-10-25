import React, { useState } from 'react';
import { ProjectIdea, ProjectBlueprint } from '../../types/domain';
import { BlueprintEngine } from '../../lib/intelligence/blueprintEngine';
import { StorageService } from '../../lib/storage/storageService';
import { FileCode2, Copy, Check, Database, Network, Server, Download } from 'lucide-react';

interface BlueprintStudioModuleProps {
  selectedProject?: ProjectIdea;
  onProceedToRoadmap: () => void;
}

export const BlueprintStudioModule: React.FC<BlueprintStudioModuleProps> = ({
  selectedProject,
  onProceedToRoadmap,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'architecture' | 'schema' | 'api'>('architecture');

  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea first to generate its engineering blueprint.
      </div>
    );
  }

  let blueprint = StorageService.getBlueprint(selectedProject.id);
  if (!blueprint) {
    blueprint = BlueprintEngine.generateBlueprint(selectedProject);
    StorageService.saveBlueprint(blueprint);
  }

  const handleCopySql = () => {
    navigator.clipboard.writeText(blueprint.ddlSchemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBlueprintJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(blueprint, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedProject.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_blueprint.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <FileCode2 className="w-5 h-5 text-[#10B981]" />
            <span>Module 8: Project Blueprint Intelligence</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Implementation-ready technical specification: decoupled system architecture, relational DDL schema, and API contracts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownloadBlueprintJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1C2420] hover:bg-[#242E28] border border-[#303A34] text-xs font-medium text-[#F5F7F5] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Export JSON Blueprint</span>
          </button>
        </div>
      </div>

      {/* Blueprint Navigation Tabs */}
      <div className="flex space-x-2 border-b border-[#303A34] pb-2 text-xs">
        <button
          onClick={() => setActiveView('architecture')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            activeView === 'architecture'
              ? 'bg-[#10B981] text-[#101713] font-semibold'
              : 'text-[#A5B0A8] hover:text-[#F5F7F5]'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System Architecture & Modules</span>
        </button>

        <button
          onClick={() => setActiveView('schema')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            activeView === 'schema'
              ? 'bg-[#10B981] text-[#101713] font-semibold'
              : 'text-[#A5B0A8] hover:text-[#F5F7F5]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>PostgreSQL DDL Schema</span>
        </button>

        <button
          onClick={() => setActiveView('api')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            activeView === 'api'
              ? 'bg-[#10B981] text-[#101713] font-semibold'
              : 'text-[#A5B0A8] hover:text-[#F5F7F5]'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>REST & Event API Contracts</span>
        </button>
      </div>

      {/* View 1: Architecture */}
      {activeView === 'architecture' && (
        <div className="space-y-6">
          <div className="p-4 bg-[#1C2420] border border-[#303A34] rounded-xl text-xs text-[#A5B0A8]">
            <strong className="text-[#F5F7F5] block mb-1">Architecture Overview:</strong>
            {blueprint.systemArchitectureOverview}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blueprint.modules.map((mod: any, i: number) => (
              <div
                key={i}
                className="p-5 bg-[#1C2420] border border-[#303A34] rounded-xl space-y-3 text-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#303A34]">
                  <span className="font-bold text-[#F5F7F5] text-sm flex items-center space-x-2">
                    <span className="w-5 h-5 rounded bg-[#10B981]/20 text-[#10B981] flex items-center justify-center text-[10px] font-mono">
                      0{i + 1}
                    </span>
                    <span>{mod.name}</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {mod.technologies.map((t: string, idx: number) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-[#101713] text-[#10B981] font-mono text-[10px] border border-[#303A34]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-[#A5B0A8] leading-relaxed">{mod.role}</p>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#A5B0A8]">
                  <div className="p-2 bg-[#101713] rounded border border-[#303A34]">
                    <span className="text-[#F5F7F5] block mb-0.5 font-semibold">Inputs:</span>
                    {mod.inputs.join(', ')}
                  </div>
                  <div className="p-2 bg-[#101713] rounded border border-[#303A34]">
                    <span className="text-[#F5F7F5] block mb-0.5 font-semibold">Outputs:</span>
                    {mod.outputs.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: SQL DDL Schema */}
      {activeView === 'schema' && (
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
                <Database className="w-4 h-4 text-[#10B981]" />
                <span>Ready-to-Execute PostgreSQL DDL Script</span>
              </h3>
              <p className="text-xs text-[#A5B0A8] mt-0.5">
                Paste into Supabase SQL Editor or local Postgres instance to scaffold schema.
              </p>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#101713] hover:bg-[#242E28] border border-[#303A34] text-xs font-mono text-[#F5F7F5] transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-[#10B981] font-sans">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#A5B0A8]" />
                  <span className="font-sans">Copy SQL</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 bg-[#101713] border border-[#303A34] rounded-lg text-xs font-mono text-[#10B981] overflow-x-auto leading-relaxed max-h-[380px]">
            {blueprint.ddlSchemaSql}
          </pre>
        </div>
      )}

      {/* View 3: API Contracts */}
      {activeView === 'api' && (
        <div className="space-y-4">
          {blueprint.apiContracts.map((api: any, i: number) => (
            <div
              key={i}
              className="p-4 bg-[#1C2420] border border-[#303A34] rounded-xl space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    api.method === 'GET' ? 'bg-[#101713] text-[#10B981] border border-[#303A34]' :
                    api.method === 'POST' ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40' :
                    'bg-[#101713] text-[#A5B0A8] border border-[#303A34]'
                  }`}>
                    {api.method}
                  </span>
                  <span className="font-mono text-[#F5F7F5] text-sm font-semibold">{api.path}</span>
                </div>
                <span className="text-[#A5B0A8]">{api.description}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {api.requestPayload && (
                  <div className="space-y-1">
                    <span className="text-[#A5B0A8] font-semibold block text-[11px]">Request Payload:</span>
                    <pre className="p-2.5 bg-[#101713] rounded border border-[#303A34] font-mono text-[11px] text-[#A5B0A8] overflow-x-auto">
                      {api.requestPayload}
                    </pre>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[#A5B0A8] font-semibold block text-[11px]">Response Signature:</span>
                  <pre className="p-2.5 bg-[#101713] rounded border border-[#303A34] font-mono text-[11px] text-[#10B981] overflow-x-auto">
                    {api.responsePayload}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToRoadmap}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Generate Adaptive Learning Roadmap →</span>
        </button>
      </div>
    </div>
  );
};
