import React from "react";
import { ArchNode, ArchEdge, NodeKind } from "@/types/blueprint";

interface Props {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

const KIND_METADATA: Record<NodeKind, { color: string; label: string; bg: string }> = {
  client: { color: "#5CB7D8", label: "Client", bg: "#EBF7FC" },
  frontend: { color: "#5CB7D8", label: "Frontend", bg: "#EBF7FC" },
  api: { color: "#1976D2", label: "API / Gateway", bg: "#E3F2FD" },
  backend: { color: "#8E24AA", label: "Backend Core", bg: "#F3E5F5" },
  ai: { color: "#D81B60", label: "AI Engine", bg: "#FCE4EC" },
  database: { color: "#43A047", label: "Database", bg: "#E8F5E9" },
  storage: { color: "#FB8C00", label: "Object Storage", bg: "#FFF3E0" },
  auth: { color: "#3949AB", label: "Authentication", bg: "#E8EAF6" },
  deployment: { color: "#00897B", label: "Infrastructure", bg: "#E0F2F1" },
  external: { color: "#757575", label: "External Service", bg: "#EEEEEE" },
};

export const ArchitectureDiagram: React.FC<Props> = ({ nodes, edges }) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-border rounded-tactile bg-[#FAF7ED]">
        <p className="text-sm font-mono text-foreground-muted">No architecture nodes specified in blueprint.</p>
      </div>
    );
  }

  const W = 680;
  const boxW = 280;
  const boxH = 64;
  const gapY = 48;
  const x = (W - boxW) / 2;
  const H = nodes.length * boxH + (nodes.length - 1) * gapY + 36;

  const yOf = (i: number) => 16 + i * (boxH + gapY);
  const indexOf = (id: string) => nodes.findIndex((n) => n.id === id);

  return (
    <div className="w-full overflow-x-auto p-4 flex flex-col items-center bg-[#FAF7ED] border-2 border-border rounded-tactile shadow-hard">
      <div className="w-full flex items-center justify-between mb-3 px-2 border-b border-border/20 pb-2">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
          System Topology ({nodes.length} Components, {edges.length} Data Flows)
        </span>
        <span className="text-[11px] font-mono text-foreground-muted">Interactive Vector Architecture</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, minWidth: 440 }}
        role="img"
        aria-label="System architecture diagram"
        className="select-none"
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill="#153A52" />
          </marker>
        </defs>

        {/* Connection Edges */}
        {edges?.map((e, i) => {
          const a = indexOf(e.from);
          const b = indexOf(e.to);
          if (a < 0 || b < 0) return null;

          const y1 = yOf(a) + boxH;
          const y2 = yOf(b);
          const straight = Math.abs(b - a) === 1 && b > a;
          const midX = W / 2;

          const path = straight
            ? `M ${midX} ${y1} L ${midX} ${y2}`
            : `M ${x + boxW} ${yOf(a) + boxH / 2} C ${W - 20} ${yOf(a) + boxH / 2}, ${W - 20} ${yOf(b) + boxH / 2}, ${x + boxW} ${yOf(b) + boxH / 2}`;

          return (
            <g key={`edge-${i}`}>
              <path
                d={path}
                fill="none"
                stroke="#153A52"
                strokeWidth={2}
                strokeDasharray={straight ? undefined : "4,4"}
                markerEnd="url(#arrow)"
              />
              {straight && e.label && (
                <g transform={`translate(${midX + 12}, ${(y1 + y2) / 2 + 4})`}>
                  <rect
                    x="-4"
                    y="-11"
                    width={e.label.length * 6.5 + 8}
                    height="16"
                    fill="#FFFFFF"
                    stroke="#153A52"
                    strokeWidth="1"
                    rx="3"
                  />
                  <text
                    fontSize="9"
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight="600"
                    fill="#153A52"
                  >
                    {e.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const meta = KIND_METADATA[n.kind] || KIND_METADATA.external;
          const y = yOf(i);

          return (
            <g key={n.id} className="transition-transform duration-150">
              {/* Drop Shadow Card */}
              <rect
                x={x + 3}
                y={y + 3}
                width={boxW}
                height={boxH}
                rx={8}
                fill="#153A52"
              />

              {/* Main Card */}
              <rect
                x={x}
                y={y}
                width={boxW}
                height={boxH}
                rx={8}
                fill="#FFFFFF"
                stroke="#153A52"
                strokeWidth={2}
              />

              {/* Color Stripe Tag */}
              <rect
                x={x + 2}
                y={y + 2}
                width={8}
                height={boxH - 4}
                rx={4}
                fill={meta.color}
              />

              {/* Node Title */}
              <text
                x={x + 20}
                y={y + 24}
                fontSize="13"
                fontWeight="700"
                fontFamily="Space Grotesk, sans-serif"
                fill="#153A52"
              >
                {n.label}
              </text>

              {/* Kind Badge Pill */}
              <rect
                x={x + boxW - 85}
                y={y + 12}
                width={72}
                height={16}
                rx={4}
                fill={meta.bg}
                stroke="#153A52"
                strokeWidth="1"
              />
              <text
                x={x + boxW - 49}
                y={y + 23}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="600"
                fontFamily="IBM Plex Mono, monospace"
                fill="#153A52"
              >
                {meta.label}
              </text>

              {/* Subtitle / Details */}
              <text
                x={x + 20}
                y={y + 44}
                fontSize="11"
                fontFamily="Inter, sans-serif"
                fill="#536B78"
              >
                {n.detail.length > 34 ? `${n.detail.slice(0, 32)}…` : n.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
