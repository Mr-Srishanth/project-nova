import React, { useState, useEffect, useRef } from "react";
import {
  Sliders,
  Type,
  Maximize2,
  Palette,
  Sparkles,
  Link2,
  Undo2,
  Redo2,
  Save,
  Check,
  AlertCircle,
  MousePointerClick,
  ChevronRight,
  ChevronDown,
  Search,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import type { InspectedElementData, InspectorChange, StyleSectionTab } from "@/types/inspector";
import { validateCssValue } from "@/lib/uiStudio/inspectorEngine";

interface ElementInspectorProps {
  selectedElement: InspectedElementData | null;
  inspectMode: boolean;
  setInspectMode: (v: boolean) => void;
  identifiedSourceFile?: string | null;
  onApplyLiveStyle: (property: string, value: string) => void;
  onSaveStyleToSource: (property: string, value: string) => Promise<{ success: boolean; error?: string }>;
  recentChanges?: InspectorChange[];
  onUndoChange?: () => void;
  onRedoChange?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  viewport?: "desktop" | "tablet" | "mobile";
}

// -----------------------------------------------------------------------------
// Curated Real Fonts with Preview Meta
// -----------------------------------------------------------------------------
const GOOGLE_FONTS = [
  { name: "Inter", category: "Sans-Serif", family: "'Inter', sans-serif" },
  { name: "Roboto", category: "Sans-Serif", family: "'Roboto', sans-serif" },
  { name: "Poppins", category: "Geometric Sans", family: "'Poppins', sans-serif" },
  { name: "Open Sans", category: "Humanist Sans", family: "'Open Sans', sans-serif" },
  { name: "Montserrat", category: "Clean Sans", family: "'Montserrat', sans-serif" },
  { name: "Space Grotesk", category: "Display Sans", family: "'Space Grotesk', sans-serif" },
  { name: "Lato", category: "Neutral Sans", family: "'Lato', sans-serif" },
  { name: "Playfair Display", category: "Serif / Editorial", family: "'Playfair Display', serif" },
  { name: "IBM Plex Mono", category: "Monospace", family: "'IBM Plex Mono', monospace" },
  { name: "System Sans", category: "System Native", family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
];

// Curated Palettes for Instant Swatching
const THEME_SWATCHES = [
  "#ffffff",
  "#000000",
  "#0f172a", // Slate 900
  "#3b82f6", // Blue 500
  "#10b981", // Emerald 500
  "#8b5cf6", // Violet 500
  "#f59e0b", // Amber 500
  "#ef4444", // Rose/Red 500
  "#06b6d4", // Cyan 500
  "#64748b", // Slate 500
];

const HARMONIC_PALETTES = [
  { name: "Dark Surface", colors: ["#090d16", "#111827", "#1f2937", "#374151"] },
  { name: "Vibrant Accent", colors: ["#2563eb", "#06b6d4", "#10b981", "#8b5cf6"] },
  { name: "Warm Earth", colors: ["#78350f", "#b45309", "#f59e0b", "#fef3c7"] },
  { name: "Clean Monochrome", colors: ["#f8fafc", "#e2e8f0", "#94a3b8", "#1e293b"] },
];

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  selectedElement,
  inspectMode,
  setInspectMode,
  identifiedSourceFile,
  onApplyLiveStyle,
  onSaveStyleToSource,
  recentChanges = [],
  onUndoChange,
  onRedoChange,
  canUndo = false,
  canRedo = false,
  viewport = "desktop",
}) => {
  const [activeTab, setActiveTab] = useState<StyleSectionTab>("layout");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<{ field: string; message: string } | null>(null);
  const [liveSuccessField, setLiveSuccessField] = useState<string | null>(null);

  // Recent user colors across inspector session
  const [recentColors, setRecentColors] = useState<string[]>([
    "#3b82f6",
    "#10b981",
    "#ffffff",
    "#0f172a",
    "#f59e0b",
  ]);

  // Form states
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Collapsible section state for advanced raw overrides
  const [showAdvancedSection, setShowAdvancedSection] = useState<boolean>(false);

  // Synchronize when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const styles = selectedElement.styles || {};
      const attrs = selectedElement.attributes || {};
      setFormValues({
        // Layout
        display: styles.display || "block",
        position: styles.position || "static",
        width: styles.width || "auto",
        height: styles.height || "auto",
        padding: styles.padding || "0px",
        margin: styles.margin || "0px",
        gap: styles.gap || "normal",
        justifyContent: styles.justifyContent || "normal",
        alignItems: styles.alignItems || "normal",
        flexDirection: styles.flexDirection || "row",
        flexWrap: styles.flexWrap || "nowrap",
        // Typography
        fontFamily: styles.fontFamily || "sans-serif",
        fontSize: styles.fontSize || "16px",
        fontWeight: styles.fontWeight || "400",
        lineHeight: styles.lineHeight || "normal",
        letterSpacing: styles.letterSpacing || "normal",
        textAlign: styles.textAlign || "left",
        // Colors & Surfaces
        color: styles.color || "#ffffff",
        backgroundColor: styles.backgroundColor || "transparent",
        borderColor: styles.borderColor || "transparent",
        borderWidth: styles.borderWidth || "0px",
        borderStyle: styles.borderStyle || "none",
        borderRadius: styles.borderRadius || "0px",
        // Effects
        opacity: styles.opacity || "1",
        boxShadow: styles.boxShadow || "none",
        transform: styles.transform || "none",
        // Content & Attributes
        textContent: selectedElement.textContent || "",
        href: attrs.href || "",
        src: attrs.src || "",
        alt: attrs.alt || "",
        title: attrs.title || "",
      });
      setErrorMsg(null);
    }
  }, [selectedElement]);

  const handleFieldChange = (field: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [field]: val }));
    setErrorMsg(null);

    // Track recently selected colors
    if (
      (field === "color" || field === "backgroundColor" || field === "borderColor") &&
      val.startsWith("#") &&
      !recentColors.includes(val)
    ) {
      setRecentColors((prev) => [val, ...prev.filter((c) => c !== val)].slice(0, 8));
    }

    // Validate property before live preview
    const validation = validateCssValue(field, val);
    if (!validation.valid) {
      setErrorMsg({ field, message: validation.error || "Invalid property format" });
      return;
    }

    // Apply live style to iframe immediately
    onApplyLiveStyle(field, val);
    setLiveSuccessField(field);
    setTimeout(() => setLiveSuccessField((curr) => (curr === field ? null : curr)), 1200);
  };

  const handleSaveFieldToSource = async (field: string) => {
    const val = formValues[field] || "";
    const validation = validateCssValue(field, val);
    if (!validation.valid) {
      setErrorMsg({ field, message: validation.error || "Cannot save invalid value" });
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await onSaveStyleToSource(field, val);
      if (!res.success) {
        setErrorMsg({ field, message: res.error || "Failed to persist to source" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to extract numeric pixel values from string (e.g., "16px" -> 16)
  const parsePx = (val: string, fallback = 0) => {
    const matched = parseInt(val, 10);
    return isNaN(matched) ? fallback : matched;
  };

  // Helper to format float or number for opacity (0 to 1 -> 0% to 100%)
  const parseOpacityPercent = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 100;
    return Math.round(Math.min(Math.max(num, 0), 1) * 100);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#15181f] border border-white/10 rounded-md shadow-2xs overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div className="p-2.5 bg-[#15181f] flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-100 truncate">
            Visual Inspector Pro
          </span>
          {viewport !== "desktop" && (
            <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-amber-500/15 text-amber-300 rounded font-semibold">
              {viewport}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={onUndoChange}
            disabled={!canUndo}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
            title="Undo Last Visual Change"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedoChange}
            disabled={!canRedo}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
            title="Redo Visual Change"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-1" />

          {/* Inspect Mode Toggle */}
          <button
            type="button"
            onClick={() => setInspectMode(!inspectMode)}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border transition-colors ${
              inspectMode
                ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                : "bg-[#15181f] text-zinc-100 border-white/10 hover:bg-white/5"
            }`}
          >
            <MousePointerClick className="w-3 h-3" />
            <span>{inspectMode ? "Inspecting" : "Inspect"}</span>
          </button>
        </div>
      </div>

      {/* Selected Element Header & Breadcrumb */}
      {selectedElement ? (
        <div className="p-2.5 bg-white/5 border-b border-white/10 space-y-1.5 text-xs">
          {/* Element Tag & Source Location */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono font-bold text-primary text-[11px] px-1.5 py-0.5 bg-primary/10 rounded">
                &lt;{selectedElement.tagName}&gt;
              </span>
              {selectedElement.id && (
                <span className="text-zinc-400 font-mono font-semibold">#{selectedElement.id}</span>
              )}
            </div>

            <div className="text-[10px] font-mono shrink-0">
              {identifiedSourceFile ? (
                <span className="text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  {identifiedSourceFile}
                </span>
              ) : (
                <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                  Preview-Only (No source map)
                </span>
              )}
            </div>
          </div>

          {/* Hierarchy Breadcrumb */}
          {selectedElement.hierarchy && selectedElement.hierarchy.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 flex-wrap font-mono pt-0.5">
              {selectedElement.hierarchy.map((item, idx) => (
                <React.Fragment key={idx}>
                  <span className={idx === selectedElement.hierarchy!.length - 1 ? "font-bold text-zinc-100" : ""}>
                    {item.tagName}
                    {item.id ? `#${item.id}` : ""}
                  </span>
                  {idx < selectedElement.hierarchy!.length - 1 && (
                    <ChevronRight className="w-2.5 h-2.5 text-zinc-400/60" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-zinc-400 text-xs space-y-1.5">
          <p className="font-medium text-zinc-200">No element selected</p>
          <p className="text-[11px] text-zinc-400/80 leading-relaxed max-w-xs mx-auto">
            Click <strong>Inspect</strong> and click any element in the live preview to customize its layout, typography, colors, and spacing.
          </p>
        </div>
      )}

      {/* Editor Tabs & Controls */}
      {selectedElement && (
        <div className="flex flex-col flex-1 min-h-0 text-xs">
          {/* Section Navigation Tabs */}
          <div className="flex border-b border-white/10 bg-[#101318] p-1 gap-1 overflow-x-auto shrink-0">
            {(
              [
                { id: "layout", label: "Layout", icon: Maximize2 },
                { id: "typography", label: "Typography", icon: Type },
                { id: "colors", label: "Colors", icon: Palette },
                { id: "effects", label: "Effects", icon: Sparkles },
                { id: "attributes", label: "Content", icon: Link2 },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0 ${
                    activeTab === tab.id
                      ? "bg-[#1c212c] text-zinc-100 shadow-2xs font-semibold border border-white/15"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="m-2.5 p-2 bg-red-500/10 text-red-300 border border-red-500/30 rounded text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{errorMsg.field}:</strong> {errorMsg.message}
              </span>
            </div>
          )}

          {/* Form Properties Body */}
          <div className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {/* ============================================================= */}
            {/* 1. LAYOUT SECTION                                             */}
            {/* ============================================================= */}
            {activeTab === "layout" && (
              <div className="space-y-4">
                {/* Display Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Display Mode</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("display")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "display"}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "block", label: "Block" },
                      { id: "flex", label: "Flex" },
                      { id: "grid", label: "Grid" },
                      { id: "inline-block", label: "Inline" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleFieldChange("display", mode.id)}
                        className={`py-1.5 px-2 text-[11px] font-medium rounded border transition-all text-center ${
                          formValues.display === mode.id
                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                            : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100 hover:bg-white/5"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flex Direction & Alignment (Only if display is flex or inline-flex) */}
                {(formValues.display === "flex" || formValues.display === "inline-flex") && (
                  <div className="p-2.5 bg-black/25 rounded-md border border-white/10 space-y-3">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                      Flexbox Alignment
                    </span>

                    {/* Direction */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Direction</span>
                        <SaveButton
                          onSave={() => handleSaveFieldToSource("flexDirection")}
                          isSaving={isSaving}
                          isLive={liveSuccessField === "flexDirection"}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleFieldChange("flexDirection", "row")}
                          className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded border text-[11px] ${
                            formValues.flexDirection === "row"
                              ? "bg-primary text-white border-primary font-semibold"
                              : "bg-[#0b0d10] text-zinc-400 border-white/10 hover:text-zinc-100"
                          }`}
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Row (Horizontal)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFieldChange("flexDirection", "column")}
                          className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded border text-[11px] ${
                            formValues.flexDirection === "column"
                              ? "bg-primary text-white border-primary font-semibold"
                              : "bg-[#0b0d10] text-zinc-400 border-white/10 hover:text-zinc-100"
                          }`}
                        >
                          <ArrowDown className="w-3 h-3" />
                          <span>Column (Vertical)</span>
                        </button>
                      </div>
                    </div>

                    {/* Justify Content */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Justify Content (Main Axis)</span>
                        <SaveButton
                          onSave={() => handleSaveFieldToSource("justifyContent")}
                          isSaving={isSaving}
                          isLive={liveSuccessField === "justifyContent"}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: "flex-start", label: "Start" },
                          { id: "center", label: "Center" },
                          { id: "flex-end", label: "End" },
                          { id: "space-between", label: "Between" },
                        ].map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => handleFieldChange("justifyContent", j.id)}
                            className={`py-1 text-[10px] rounded border text-center transition-all ${
                              formValues.justifyContent === j.id
                                ? "bg-primary text-white border-primary font-semibold"
                                : "bg-[#0b0d10] text-zinc-400 border-white/10 hover:text-zinc-100"
                            }`}
                          >
                            {j.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Align Items */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Align Items (Cross Axis)</span>
                        <SaveButton
                          onSave={() => handleSaveFieldToSource("alignItems")}
                          isSaving={isSaving}
                          isLive={liveSuccessField === "alignItems"}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: "flex-start", label: "Start" },
                          { id: "center", label: "Center" },
                          { id: "flex-end", label: "End" },
                          { id: "stretch", label: "Stretch" },
                        ].map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => handleFieldChange("alignItems", a.id)}
                            className={`py-1 text-[10px] rounded border text-center transition-all ${
                              formValues.alignItems === a.id
                                ? "bg-primary text-white border-primary font-semibold"
                                : "bg-[#0b0d10] text-zinc-400 border-white/10 hover:text-zinc-100"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gap Slider */}
                    <SliderField
                      label="Item Gap"
                      value={parsePx(formValues.gap || "0px")}
                      min={0}
                      max={64}
                      unit="px"
                      onChange={(px) => handleFieldChange("gap", `${px}px`)}
                      onSave={() => handleSaveFieldToSource("gap")}
                      isLive={liveSuccessField === "gap"}
                      isSaving={isSaving}
                    />
                  </div>
                )}

                {/* Sizing (Width & Height) */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Sizing Dimensions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <PropertyInput
                      label="Width"
                      field="width"
                      value={formValues.width || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "width"}
                      isSaving={isSaving}
                      placeholder="auto, 100%, 320px"
                    />
                    <PropertyInput
                      label="Height"
                      field="height"
                      value={formValues.height || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "height"}
                      isSaving={isSaving}
                      placeholder="auto, 100vh, 240px"
                    />
                  </div>
                </div>

                {/* Positioning */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Position</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("position")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "position"}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {["static", "relative", "absolute", "fixed"].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleFieldChange("position", pos)}
                        className={`py-1 text-[11px] rounded border text-center capitalize transition-all ${
                          formValues.position === pos
                            ? "bg-primary text-white border-primary font-semibold"
                            : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* 2. TYPOGRAPHY SECTION (REAL FONT PREVIEWS)                     */}
            {/* ============================================================= */}
            {activeTab === "typography" && (
              <div className="space-y-4">
                {/* Visual Font Family Picker with Real Font Rendering */}
                <VisualFontPicker
                  value={formValues.fontFamily || "sans-serif"}
                  onChange={(fontFamily) => handleFieldChange("fontFamily", fontFamily)}
                  onSave={() => handleSaveFieldToSource("fontFamily")}
                  isSaving={isSaving}
                  isLive={liveSuccessField === "fontFamily"}
                />

                {/* Font Size Slider & Controls */}
                <SliderField
                  label="Font Size"
                  value={parsePx(formValues.fontSize || "16px", 16)}
                  min={10}
                  max={72}
                  unit="px"
                  onChange={(px) => handleFieldChange("fontSize", `${px}px`)}
                  onSave={() => handleSaveFieldToSource("fontSize")}
                  isLive={liveSuccessField === "fontSize"}
                  isSaving={isSaving}
                />

                {/* Font Weight Selector (Regular, Medium, Semibold, Bold) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Font Weight</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("fontWeight")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "fontWeight"}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "400", label: "Regular", styleClass: "font-normal" },
                      { id: "500", label: "Medium", styleClass: "font-medium" },
                      { id: "600", label: "Semibold", styleClass: "font-semibold" },
                      { id: "700", label: "Bold", styleClass: "font-bold" },
                    ].map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleFieldChange("fontWeight", w.id)}
                        className={`py-1.5 text-[11px] rounded border text-center transition-all ${
                          formValues.fontWeight === w.id
                            ? "bg-primary text-white border-primary font-bold shadow-2xs"
                            : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
                        } ${w.styleClass}`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Alignment */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Alignment</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("textAlign")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "textAlign"}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "left", label: "Left", icon: AlignLeft },
                      { id: "center", label: "Center", icon: AlignCenter },
                      { id: "right", label: "Right", icon: AlignRight },
                      { id: "justify", label: "Justify", icon: AlignJustify },
                    ].map((align) => {
                      const Icon = align.icon;
                      return (
                        <button
                          key={align.id}
                          type="button"
                          onClick={() => handleFieldChange("textAlign", align.id)}
                          className={`flex items-center justify-center gap-1 py-1.5 rounded border text-[11px] transition-all ${
                            formValues.textAlign === align.id
                              ? "bg-primary text-white border-primary font-semibold"
                              : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{align.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Line Height & Letter Spacing */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                  <PropertyInput
                    label="Line Height"
                    field="lineHeight"
                    value={formValues.lineHeight || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "lineHeight"}
                    isSaving={isSaving}
                    placeholder="1.5, 24px"
                  />
                  <PropertyInput
                    label="Letter Spacing"
                    field="letterSpacing"
                    value={formValues.letterSpacing || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "letterSpacing"}
                    isSaving={isSaving}
                    placeholder="normal, 0.5px"
                  />
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* 3. COLORS & SURFACES SECTION (SWATCHES & PALETTES)             */}
            {/* ============================================================= */}
            {activeTab === "colors" && (
              <div className="space-y-4">
                {/* Text Color Picker */}
                <VisualColorPickerCard
                  title="Text Color"
                  value={formValues.color || "#ffffff"}
                  recentColors={recentColors}
                  onChange={(col) => handleFieldChange("color", col)}
                  onSave={() => handleSaveFieldToSource("color")}
                  isLive={liveSuccessField === "color"}
                  isSaving={isSaving}
                />

                {/* Background Color Picker */}
                <VisualColorPickerCard
                  title="Background Color"
                  value={formValues.backgroundColor || "transparent"}
                  recentColors={recentColors}
                  allowTransparent
                  onChange={(col) => handleFieldChange("backgroundColor", col)}
                  onSave={() => handleSaveFieldToSource("backgroundColor")}
                  isLive={liveSuccessField === "backgroundColor"}
                  isSaving={isSaving}
                />

                {/* Border Color Picker & Border Styling */}
                <div className="space-y-3 p-3 bg-black/25 rounded-md border border-white/10">
                  <VisualColorPickerCard
                    title="Border Color"
                    value={formValues.borderColor || "transparent"}
                    recentColors={recentColors}
                    allowTransparent
                    onChange={(col) => handleFieldChange("borderColor", col)}
                    onSave={() => handleSaveFieldToSource("borderColor")}
                    isLive={liveSuccessField === "borderColor"}
                    isSaving={isSaving}
                  />

                  {/* Border Width & Style */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <SliderField
                      label="Border Width"
                      value={parsePx(formValues.borderWidth || "0px")}
                      min={0}
                      max={16}
                      unit="px"
                      onChange={(px) => handleFieldChange("borderWidth", `${px}px`)}
                      onSave={() => handleSaveFieldToSource("borderWidth")}
                      isLive={liveSuccessField === "borderWidth"}
                      isSaving={isSaving}
                    />

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Style</span>
                        <SaveButton
                          onSave={() => handleSaveFieldToSource("borderStyle")}
                          isSaving={isSaving}
                          isLive={liveSuccessField === "borderStyle"}
                        />
                      </div>
                      <select
                        value={formValues.borderStyle || "none"}
                        onChange={(e) => handleFieldChange("borderStyle", e.target.value)}
                        className="w-full text-xs p-1.5 border border-white/10 rounded bg-[#0b0d10] text-zinc-200"
                      >
                        <option value="none">none</option>
                        <option value="solid">solid</option>
                        <option value="dashed">dashed</option>
                        <option value="dotted">dotted</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Curated Harmonic Palettes */}
                <div className="p-2.5 bg-[#0e1117] rounded-md border border-white/10 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    Harmonious Preset Palettes
                  </span>
                  <div className="space-y-2">
                    {HARMONIC_PALETTES.map((palette) => (
                      <div key={palette.name} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400 font-medium">{palette.name}</span>
                        <div className="flex items-center gap-1.5">
                          {palette.colors.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleFieldChange("backgroundColor", c)}
                              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform shadow-2xs"
                              style={{ backgroundColor: c }}
                              title={`Set background to ${c}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* 4. SPACING & EFFECTS                                          */}
            {/* ============================================================= */}
            {activeTab === "effects" && (
              <div className="space-y-4">
                {/* Opacity with live percentage */}
                <SliderField
                  label={`Opacity (${parseOpacityPercent(formValues.opacity || "1")}%)`}
                  value={parseOpacityPercent(formValues.opacity || "1")}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(pct) => handleFieldChange("opacity", (pct / 100).toFixed(2))}
                  onSave={() => handleSaveFieldToSource("opacity")}
                  isLive={liveSuccessField === "opacity"}
                  isSaving={isSaving}
                />

                {/* Border Radius Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Corner Rounding (Radius)</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("borderRadius")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "borderRadius"}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: "0px", label: "None", preview: "rounded-none" },
                      { id: "4px", label: "Sm", preview: "rounded-sm" },
                      { id: "8px", label: "Md", preview: "rounded-md" },
                      { id: "16px", label: "Lg", preview: "rounded-xl" },
                      { id: "9999px", label: "Full", preview: "rounded-full" },
                    ].map((rad) => (
                      <button
                        key={rad.id}
                        type="button"
                        onClick={() => handleFieldChange("borderRadius", rad.id)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded border transition-all ${
                          formValues.borderRadius === rad.id
                            ? "bg-primary text-white border-primary font-bold shadow-2xs"
                            : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 border-2 border-current bg-white/10 ${rad.preview}`}
                        />
                        <span className="text-[10px]">{rad.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Box Shadow Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Elevation & Shadow</span>
                    <SaveButton
                      onSave={() => handleSaveFieldToSource("boxShadow")}
                      isSaving={isSaving}
                      isLive={liveSuccessField === "boxShadow"}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "none", label: "None", shadow: "none" },
                      { id: "0 1px 3px rgba(0,0,0,0.4)", label: "Subtle", shadow: "0 1px 3px rgba(0,0,0,0.5)" },
                      { id: "0 8px 16px rgba(0,0,0,0.4)", label: "Medium", shadow: "0 8px 16px rgba(0,0,0,0.5)" },
                      { id: "0 16px 32px rgba(0,0,0,0.6)", label: "Deep", shadow: "0 16px 32px rgba(0,0,0,0.7)" },
                    ].map((sh) => (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => handleFieldChange("boxShadow", sh.id)}
                        className={`py-2 px-1 text-[11px] rounded border text-center transition-all ${
                          formValues.boxShadow === sh.id
                            ? "bg-primary text-white border-primary font-semibold shadow-2xs"
                            : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
                        }`}
                        style={{ boxShadow: sh.shadow !== "none" ? sh.shadow : undefined }}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spacing Quick Sliders (Padding & Margin) */}
                <div className="p-3 bg-black/25 rounded-md border border-white/10 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                    Spacing Controls
                  </span>
                  <SliderField
                    label="Padding (Inner Spacing)"
                    value={parsePx(formValues.padding || "0px")}
                    min={0}
                    max={64}
                    unit="px"
                    onChange={(px) => handleFieldChange("padding", `${px}px`)}
                    onSave={() => handleSaveFieldToSource("padding")}
                    isLive={liveSuccessField === "padding"}
                    isSaving={isSaving}
                  />
                  <SliderField
                    label="Margin (Outer Spacing)"
                    value={parsePx(formValues.margin || "0px")}
                    min={0}
                    max={64}
                    unit="px"
                    onChange={(px) => handleFieldChange("margin", `${px}px`)}
                    onSave={() => handleSaveFieldToSource("margin")}
                    isLive={liveSuccessField === "margin"}
                    isSaving={isSaving}
                  />
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* 5. CONTENT & ATTRIBUTES                                       */}
            {/* ============================================================= */}
            {activeTab === "attributes" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-100">
                    <span>Text Content</span>
                    <button
                      type="button"
                      onClick={() => handleSaveFieldToSource("textContent")}
                      disabled={isSaving}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Save className="w-2.5 h-2.5" />
                      <span>Save to Source</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={formValues.textContent || ""}
                    onChange={(e) => handleFieldChange("textContent", e.target.value)}
                    className="w-full text-xs p-2 border border-white/10 rounded bg-[#0b0d10] text-zinc-200 focus:outline-none focus:border-primary"
                  />
                </div>

                {selectedElement.tagName === "a" && (
                  <PropertyInput
                    label="Link Destination (href)"
                    field="href"
                    value={formValues.href || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "href"}
                    isSaving={isSaving}
                  />
                )}

                {selectedElement.tagName === "img" && (
                  <>
                    <PropertyInput
                      label="Image Source (src)"
                      field="src"
                      value={formValues.src || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "src"}
                      isSaving={isSaving}
                    />
                    <PropertyInput
                      label="Alt Description"
                      field="alt"
                      value={formValues.alt || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "alt"}
                      isSaving={isSaving}
                    />
                  </>
                )}

                <PropertyInput
                  label="Title Attribute"
                  field="title"
                  value={formValues.title || ""}
                  onChange={handleFieldChange}
                  onSave={handleSaveFieldToSource}
                  isLive={liveSuccessField === "title"}
                  isSaving={isSaving}
                />
              </div>
            )}

            {/* Collapsible Advanced Raw CSS Panel */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAdvancedSection(!showAdvancedSection)}
                className="w-full flex items-center justify-between py-1 px-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 rounded hover:bg-white/5 transition-colors"
              >
                <span>Advanced Manual Values</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showAdvancedSection ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAdvancedSection && (
                <div className="pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <PropertyInput
                      label="Custom Transform"
                      field="transform"
                      value={formValues.transform || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "transform"}
                      isSaving={isSaving}
                      placeholder="scale(1.05)"
                    />
                    <PropertyInput
                      label="Custom Opacity"
                      field="opacity"
                      value={formValues.opacity || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "opacity"}
                      isSaving={isSaving}
                      placeholder="0.85"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Visual Changes History Footnote */}
          {recentChanges.length > 0 && (
            <div className="p-2 bg-[#101318] border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 shrink-0">
              <span>{recentChanges.length} visual change(s) this session</span>
              <span className="font-semibold text-emerald-300">Live preview synchronized</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

interface SaveButtonProps {
  onSave: () => void;
  isSaving: boolean;
  isLive: boolean;
}

const SaveButton: React.FC<SaveButtonProps> = ({ onSave, isSaving, isLive }) => (
  <div className="flex items-center gap-1">
    {isLive && <Check className="w-3 h-3 text-emerald-400 animate-fadeIn" />}
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      className="p-0.5 text-zinc-400 hover:text-primary transition-colors disabled:opacity-40"
      title="Save change to project source"
    >
      <Save className="w-3 h-3" />
    </button>
  </div>
);

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (val: number) => void;
  onSave: () => void;
  isLive: boolean;
  isSaving: boolean;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  onSave,
  isLive,
  isSaving,
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-zinc-200 text-[10px]">
            {value}
            {unit}
          </span>
          <SaveButton onSave={onSave} isSaving={isSaving} isLive={isLive} />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-primary h-1 bg-white/10 rounded-lg cursor-pointer"
      />
    </div>
  );
};

interface VisualFontPickerProps {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isLive: boolean;
}

const VisualFontPicker: React.FC<VisualFontPickerProps> = ({
  value,
  onChange,
  onSave,
  isSaving,
  isLive,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredFonts = GOOGLE_FONTS.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.category.toLowerCase().includes(query.toLowerCase())
  );

  const selectedFont = GOOGLE_FONTS.find(
    (f) => f.family.toLowerCase() === value.toLowerCase() || f.name.toLowerCase() === value.toLowerCase()
  ) || { name: value || "Inter", category: "Custom", family: value };

  return (
    <div className="space-y-1.5 relative" ref={dropdownRef}>
      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
        <span>Font Family</span>
        <SaveButton onSave={onSave} isSaving={isSaving} isLive={isLive} />
      </div>

      {/* Trigger Button with live rendered font name */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded border border-white/10 bg-[#0f1217] hover:border-white/20 text-left transition-colors"
      >
        <div className="truncate">
          <span className="text-xs font-semibold text-zinc-100 block" style={{ fontFamily: selectedFont.family }}>
            {selectedFont.name}
          </span>
          <span className="text-[10px] text-zinc-400 block" style={{ fontFamily: selectedFont.family }}>
            The quick brown fox jumps over the lazy dog
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-2" />
      </button>

      {/* Visual Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#15181f] border border-white/15 rounded-md shadow-xl overflow-hidden max-h-64 flex flex-col">
          {/* Search Header */}
          <div className="p-1.5 border-b border-white/10 bg-[#0d1015] flex items-center gap-1.5">
            <Search className="w-3 h-3 text-zinc-400 ml-1" />
            <input
              type="text"
              placeholder="Search fonts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-zinc-100 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Font List */}
          <div className="overflow-y-auto divide-y divide-white/5 py-1">
            {filteredFonts.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  onChange(f.family);
                  setIsOpen(false);
                }}
                className="w-full text-left p-2 hover:bg-white/5 transition-colors group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs text-zinc-100 font-medium group-hover:text-primary transition-colors"
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </span>
                    <span className="text-[9px] uppercase px-1 py-0.2 bg-white/5 text-zinc-400 rounded">
                      {f.category}
                    </span>
                  </div>
                  <p
                    className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[210px]"
                    style={{ fontFamily: f.family }}
                  >
                    The quick brown fox
                  </p>
                </div>
                {selectedFont.name === f.name && (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface VisualColorPickerCardProps {
  title: string;
  value: string;
  recentColors: string[];
  allowTransparent?: boolean;
  onChange: (val: string) => void;
  onSave: () => void;
  isLive: boolean;
  isSaving: boolean;
}

const VisualColorPickerCard: React.FC<VisualColorPickerCardProps> = ({
  title,
  value,
  recentColors,
  allowTransparent = false,
  onChange,
  onSave,
  isLive,
  isSaving,
}) => {
  const [showHexInput, setShowHexInput] = useState(false);

  // Normalize color for HTML native color picker (requires #RRGGBB)
  const safeHexForInput = value.startsWith("#") && value.length === 7 ? value : "#000000";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
        <span>{title}</span>
        <SaveButton onSave={onSave} isSaving={isSaving} isLive={isLive} />
      </div>

      {/* Main trigger button & native color picker */}
      <div className="flex items-center gap-2">
        <label className="relative flex items-center gap-2 p-1.5 bg-[#0f1217] border border-white/10 rounded-md cursor-pointer hover:border-white/20 transition-colors flex-1">
          <input
            type="color"
            value={safeHexForInput}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <div
            className="w-6 h-6 rounded border border-white/20 shadow-inner shrink-0"
            style={{ backgroundColor: value === "transparent" ? "transparent" : value }}
          />
          <span className="text-xs font-mono text-zinc-200 truncate">{value}</span>
        </label>

        {allowTransparent && (
          <button
            type="button"
            onClick={() => onChange("transparent")}
            className={`px-2 py-1.5 rounded border text-[10px] font-medium transition-colors ${
              value === "transparent"
                ? "bg-primary text-white border-primary"
                : "bg-[#0f1217] text-zinc-400 border-white/10 hover:text-zinc-100"
            }`}
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowHexInput(!showHexInput)}
          className="px-2 py-1.5 rounded border border-white/10 bg-[#0f1217] text-[10px] text-zinc-400 hover:text-zinc-100 transition-colors font-mono"
          title="Toggle HEX/RGB input"
        >
          HEX
        </button>
      </div>

      {/* Manual HEX text input if toggled */}
      {showHexInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff or rgb(255, 255, 255)"
          className="w-full text-xs p-1.5 border border-white/10 rounded bg-[#0b0d10] font-mono text-zinc-100 focus:outline-none focus:border-primary"
        />
      )}

      {/* Quick Swatches Palette */}
      <div className="space-y-1">
        <span className="text-[10px] text-zinc-400">Palette Swatches</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {THEME_SWATCHES.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => onChange(col)}
              className="w-5 h-5 rounded border border-white/20 hover:scale-115 transition-transform"
              style={{ backgroundColor: col }}
              title={col}
            />
          ))}
        </div>
      </div>

      {/* Recent Colors (Session) */}
      {recentColors.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-zinc-400">Recent Colors</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {recentColors.map((col, idx) => (
              <button
                key={`${col}-${idx}`}
                type="button"
                onClick={() => onChange(col)}
                className="w-4 h-4 rounded-full border border-white/20 hover:scale-120 transition-transform"
                style={{ backgroundColor: col }}
                title={`Recent: ${col}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface PropertyInputProps {
  label: string;
  field: string;
  value: string;
  onChange: (field: string, val: string) => void;
  onSave: (field: string) => void;
  isLive: boolean;
  isSaving: boolean;
  placeholder?: string;
}

const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  field,
  value,
  onChange,
  onSave,
  isLive,
  isSaving,
  placeholder,
}) => {
  return (
    <div className="border border-white/10 p-1.5 rounded bg-[#101318] space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
        <SaveButton onSave={() => onSave(field)} isSaving={isSaving} isLive={isLive} />
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full text-xs p-1 border border-white/10 rounded bg-[#0b0d10] font-mono focus:outline-none focus:border-primary text-zinc-100"
      />
    </div>
  );
};
