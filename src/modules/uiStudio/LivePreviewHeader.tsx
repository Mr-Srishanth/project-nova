import React from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  Square,
  Play,
  Maximize,
  Minimize,
  Sliders,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Loader2,
  FolderTree,
} from "lucide-react";
import type { ViewportMode, PreviewLifecycleStage } from "@/types/uiStudio";

interface LivePreviewHeaderProps {
  projectName: string;
  previewStage: PreviewLifecycleStage;
  viewport: ViewportMode;
  setViewport: (v: ViewportMode) => void;
  zoomLevel: number;
  setZoomLevel: (z: number | ((prev: number) => number)) => void;
  fitToWindow: boolean;
  setFitToWindow: (f: boolean | ((prev: boolean) => boolean)) => void;
  isRunning: boolean;
  setIsRunning: (r: boolean | ((prev: boolean) => boolean)) => void;
  onRefresh: () => void;
  isFocusPreview: boolean;
  setIsFocusPreview: (f: boolean | ((prev: boolean) => boolean)) => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  selectedRoute?: string;
  leftPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
}

export const LivePreviewHeader: React.FC<LivePreviewHeaderProps> = ({
  projectName,
  previewStage,
  viewport,
  setViewport,
  zoomLevel,
  setZoomLevel,
  fitToWindow,
  setFitToWindow,
  isRunning,
  setIsRunning,
  onRefresh,
  isFocusPreview,
  setIsFocusPreview,
  isInspectorOpen,
  onToggleInspector,
  selectedRoute = "/",
  leftPanelOpen,
  onToggleLeftPanel,
}) => {
  const zoomOptions = [50, 75, 100, 125, 150];

  return (
    <div className="h-11 border-b border-border bg-[#FFFDF5] px-3 flex items-center justify-between shrink-0 shadow-2xs gap-2 select-none">
      {/* Left: Left Panel Toggle, Project title & Sandbox status */}
      <div className="flex items-center gap-2 min-w-0">
        {onToggleLeftPanel && !isFocusPreview && (
          <button
            type="button"
            onClick={onToggleLeftPanel}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              leftPanelOpen
                ? "bg-stone-200/80 text-foreground border-border"
                : "bg-white text-muted-foreground hover:text-foreground border-border/80 shadow-2xs hover:bg-muted"
            }`}
            title={leftPanelOpen ? "Collapse Project Explorer" : "Expand Project Explorer"}
          >
            <FolderTree className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-xs font-bold text-foreground truncate max-w-[120px] sm:max-w-[180px]">
            {projectName}
          </span>
          <span className="hidden sm:inline-block font-mono text-[10px] text-muted-foreground bg-stone-100 px-1.5 py-0.5 rounded border border-border/40">
            {selectedRoute}
          </span>
        </div>

        {/* Live Status Pill */}
        <div
          className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full border shrink-0 transition-colors"
          style={{
            backgroundColor:
              previewStage === "ready"
                ? "rgba(16, 185, 129, 0.08)"
                : previewStage === "runtime_error" || previewStage === "build_failed"
                ? "rgba(239, 68, 68, 0.08)"
                : previewStage === "building" || previewStage === "loading"
                ? "rgba(14, 165, 233, 0.08)"
                : "rgba(245, 158, 11, 0.08)",
            borderColor:
              previewStage === "ready"
                ? "rgba(16, 185, 129, 0.3)"
                : previewStage === "runtime_error" || previewStage === "build_failed"
                ? "rgba(239, 68, 68, 0.3)"
                : previewStage === "building" || previewStage === "loading"
                ? "rgba(14, 165, 233, 0.3)"
                : "rgba(245, 158, 11, 0.3)",
          }}
        >
          {previewStage === "building" && (
            <>
              <Loader2 className="w-3 h-3 text-cyan-600 animate-spin" />
              <span className="text-cyan-700 font-semibold">Building</span>
            </>
          )}
          {previewStage === "loading" && (
            <>
              <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
              <span className="text-blue-700 font-semibold">Loading</span>
            </>
          )}
          {previewStage === "ready" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-bold">Ready</span>
            </>
          )}
          {previewStage === "runtime_error" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-700 font-bold">Runtime Error</span>
            </>
          )}
          {previewStage === "build_failed" && (
            <>
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-red-700 font-bold">Build Failed</span>
            </>
          )}
          {previewStage === "stale" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-amber-700 font-bold">Stale</span>
            </>
          )}
          {previewStage === "stopped" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-slate-600 font-medium">Stopped</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Device Breakpoint Controls */}
      <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-md border border-border/80">
        <button
          type="button"
          onClick={() => setViewport("desktop")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
            viewport === "desktop"
              ? "bg-white text-foreground shadow-2xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Desktop Mode (Full Available Width)"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Desktop</span>
        </button>
        <button
          type="button"
          onClick={() => setViewport("tablet")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
            viewport === "tablet"
              ? "bg-white text-foreground shadow-2xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Tablet Mode (768px Viewport)"
        >
          <Tablet className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Tablet</span>
        </button>
        <button
          type="button"
          onClick={() => setViewport("mobile")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
            viewport === "mobile"
              ? "bg-white text-foreground shadow-2xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Mobile Mode (375px Device Frame)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Mobile</span>
        </button>
      </div>

      {/* Right: Sizing & Zoom, Inspector, Fullscreen */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Zoom Selector */}
        <div className="hidden lg:flex items-center border border-border/80 rounded bg-white overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => {
              setFitToWindow(false);
              setZoomLevel((prev) => Math.max(50, prev - 25));
            }}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <select
            value={fitToWindow ? "fit" : zoomLevel}
            onChange={(e) => {
              if (e.target.value === "fit") {
                setFitToWindow(true);
                setZoomLevel(100);
              } else {
                setFitToWindow(false);
                setZoomLevel(parseInt(e.target.value, 10));
              }
            }}
            className="text-[11px] font-mono py-0.5 px-1 bg-transparent border-x border-border/60 focus:outline-none cursor-pointer"
          >
            <option value="fit">Fit</option>
            {zoomOptions.map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setFitToWindow(false);
              setZoomLevel((prev) => Math.min(200, prev + 25));
            }}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        {/* Refresh Preview */}
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
          title="Rebuild and Refresh Preview"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Start / Stop Sandbox */}
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRunning ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"
          }`}
          title={isRunning ? "Stop Preview Sandbox" : "Launch Preview Sandbox"}
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        {/* Visual Inspector Quick Toggle */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`p-1.5 rounded border transition-colors cursor-pointer ${
            isInspectorOpen
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border/80 bg-white text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Toggle Visual Inspector"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen / Focus Canvas Mode */}
        <button
          type="button"
          onClick={() => setIsFocusPreview(!isFocusPreview)}
          className={`p-1.5 rounded border transition-colors cursor-pointer ${
            isFocusPreview
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
              : "border-border/80 bg-white text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title={isFocusPreview ? "Exit Focus Canvas" : "Full Preview Focus Mode"}
        >
          {isFocusPreview ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
