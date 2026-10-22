import React, { useState } from "react";
import { Copy, Check, WrapText } from "lucide-react";

interface CodeDiffViewProps {
  originalContent?: string;
  proposedContent: string;
  filePath: string;
  action: "create" | "modify" | "delete";
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  originalLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Computes a clean, line-by-line diff between original and proposed content using Myers-like LCS.
 */
function computeLineDiff(original: string = "", proposed: string = ""): DiffLine[] {
  const origLines = original ? original.split("\n") : [];
  const propLines = proposed ? proposed.split("\n") : [];

  if (origLines.length === 0) {
    return propLines.map((text, idx) => ({
      type: "added",
      text,
      newLineNumber: idx + 1,
    }));
  }

  if (propLines.length === 0) {
    return origLines.map((text, idx) => ({
      type: "removed",
      text,
      originalLineNumber: idx + 1,
    }));
  }

  // Fast path for exact match
  if (original === proposed) {
    return origLines.map((text, idx) => ({
      type: "unchanged",
      text,
      originalLineNumber: idx + 1,
      newLineNumber: idx + 1,
    }));
  }

  // Compute LCS table
  const n = origLines.length;
  const m = propLines.length;
  
  // Guard against massive files (> 2000 lines) by falling back to chunked or slice diff
  if (n * m > 1_000_000) {
    // Large file fallback
    const result: DiffLine[] = [];
    origLines.forEach((text, i) => {
      result.push({ type: "removed", text, originalLineNumber: i + 1 });
    });
    propLines.forEach((text, i) => {
      result.push({ type: "added", text, newLineNumber: i + 1 });
    });
    return result;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1) as any);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (origLines[i] === propLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to find diff
  const diff: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === propLines[j - 1]) {
      diff.unshift({
        type: "unchanged",
        text: origLines[i - 1],
        originalLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: "added",
        text: propLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({
        type: "removed",
        text: origLines[i - 1],
        originalLineNumber: i,
      });
      i--;
    }
  }

  return diff;
}

export const CodeDiffView: React.FC<CodeDiffViewProps> = ({
  originalContent = "",
  proposedContent,
  filePath,
  action,
}) => {
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const diffLines = React.useMemo(
    () => computeLineDiff(originalContent, proposedContent),
    [originalContent, proposedContent]
  );

  const stats = React.useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const l of diffLines) {
      if (l.type === "added") additions++;
      else if (l.type === "removed") deletions++;
    }
    return { additions, deletions };
  }, [diffLines]);

  const handleCopy = () => {
    navigator.clipboard.writeText(proposedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col border border-white/10 rounded bg-[#0b0f19] text-slate-100 font-mono text-[11px] overflow-hidden shadow-xs">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#131b2e] border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-200 truncate">{filePath}</span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded font-bold bg-[#15181f]/10 text-slate-300">
            {action}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-emerald-400">+{stats.additions}</span>
            <span className="text-rose-400">-{stats.deletions}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            className={`p-1 rounded text-[10px] flex items-center gap-1 transition-colors ${
              wrapLines ? "bg-primary/20 text-primary-300" : "text-slate-400 hover:text-slate-200"
            }`}
            title={wrapLines ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText className="w-3 h-3" />
            <span className="hidden sm:inline">Wrap</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[10px] flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy proposed code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Diff Lines Table */}
      <div className="max-h-80 overflow-y-auto overflow-x-auto select-text divide-y divide-slate-800/20">
        {diffLines.map((line, idx) => {
          let rowBg = "bg-transparent";
          let prefix = " ";
          let prefixColor = "text-slate-600";
          let textColor = "text-slate-300";
          let lineNumBg = "text-slate-600";

          if (line.type === "added") {
            rowBg = "bg-emerald-950/40 hover:bg-emerald-950/60";
            prefix = "+";
            prefixColor = "text-emerald-400 font-bold";
            textColor = "text-emerald-200";
            lineNumBg = "text-emerald-500/70";
          } else if (line.type === "removed") {
            rowBg = "bg-rose-950/40 hover:bg-rose-950/60";
            prefix = "-";
            prefixColor = "text-rose-400 font-bold";
            textColor = "text-rose-300/80 line-through decoration-rose-500/50";
            lineNumBg = "text-rose-500/70";
          }

          return (
            <div
              key={idx}
              className={`flex items-start text-[11px] leading-5 font-mono ${rowBg} transition-colors min-w-full`}
            >
              {/* Line Numbers */}
              <div className="flex select-none shrink-0 text-[10px] bg-slate-950/80 px-2 border-r border-slate-800/50 font-mono w-16 text-right justify-between">
                <span className={`w-6 ${lineNumBg}`}>{line.originalLineNumber ?? ""}</span>
                <span className={`w-6 ${lineNumBg}`}>{line.newLineNumber ?? ""}</span>
              </div>

              {/* Marker (+ / -) */}
              <span className={`w-5 text-center select-none shrink-0 ${prefixColor}`}>
                {prefix}
              </span>

              {/* Line Content */}
              <div
                className={`flex-1 pr-3 ${textColor} ${
                  wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-visible"
                }`}
              >
                {line.text || " "}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
