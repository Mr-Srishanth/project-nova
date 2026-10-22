import React from "react";
import {
  Layers,
  ArrowRight,
  ExternalLink,
  Cpu,
  Layout,
  Database,
  Terminal,
  FileCheck,
} from "lucide-react";
import type {
  RepoArchitectureLayer,
  RepoArchitectureNode,
} from "@/lib/repository/realFsClient";

interface RepoArchitectureMapProps {
  layers: RepoArchitectureLayer[];
  nodes: RepoArchitectureNode[];
  onSelectNode: (filePath: string) => void;
}

export const RepoArchitectureMapView: React.FC<RepoArchitectureMapProps> = ({
  layers,
  nodes,
  onSelectNode,
}) => {
  const getNodeIcon = (category: string) => {
    switch (category) {
      case "entrypoint":
      case "page":
        return <Layout className="w-4 h-4 text-sky-700" />;
      case "gateway":
        return <Terminal className="w-4 h-4 text-emerald-700" />;
      case "storage":
        return <Database className="w-4 h-4 text-purple-700" />;
      case "test":
        return <FileCheck className="w-4 h-4 text-primary" />;
      default:
        return <Cpu className="w-4 h-4 text-indigo-700" />;
    }
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="p-4 bg-surface border-2 border-border rounded-tactile shadow-hard-sm">
        <h3 className="font-display font-bold text-base text-foreground mb-1">
          End-to-End System Architecture Topology
        </h3>
        <p className="text-xs font-sans text-foreground-muted">
          Visualized from actual repository entry points, runtime modules, storage adapters, and local server gateways. Click any node to inspect its real implementation on disk.
        </p>
      </div>

      <div className="space-y-6">
        {layers.map((layer) => {
          const layerNodes = layer.nodeIds
            .map((id) => nodeMap.get(id))
            .filter((n): n is RepoArchitectureNode => Boolean(n));

          return (
            <div
              key={layer.id}
              className="bg-surface border-2 border-border rounded-tactile p-5 shadow-hard space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h4 className="font-display font-bold text-sm text-foreground">
                    {layer.title}
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-primary/20 text-[#153A52] border border-border">
                  {layer.badge}
                </span>
              </div>

              <p className="text-xs font-sans text-foreground-muted leading-relaxed">
                {layer.description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {layerNodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onSelectNode(node.path)}
                    className="p-3 bg-[#FAF7ED] border-2 border-border rounded-tactile hover:bg-surface hover:shadow-hard-sm transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-display font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          {getNodeIcon(node.category)}
                          <span className="truncate">{node.name}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <span className="text-[11px] font-mono text-foreground-muted block truncate">
                        {node.path}
                      </span>

                      <p className="text-[11px] font-sans text-foreground leading-snug">
                        {node.summary}
                      </p>
                    </div>

                    {node.dependencies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/10 flex items-center gap-1 text-[10px] font-mono text-foreground-muted">
                        <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">
                          Depends on: {node.dependencies.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
