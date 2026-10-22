import React, { useState, useEffect } from "react";
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

  // Form states
  const [formValues, setFormValues] = useState<Record<string, string>>({});

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

  return (
    <div className="flex flex-col bg-[#15181f] border border-white/10 rounded-md shadow-2xs overflow-hidden transition-all duration-200">
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
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400"
            title="Undo Last Visual Change"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedoChange}
            disabled={!canRedo}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400"
            title="Redo Visual Change"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-border mx-1" />

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
        <div className="p-3 text-center text-zinc-400 text-xs space-y-1">
          <p className="font-medium">No element selected</p>
          <p className="text-[11px] text-zinc-400/80">
            Click <strong>Inspect</strong> and click an element in the live preview to edit its layout, typography, colors, and content.
          </p>
        </div>
      )}

      {/* Editor Tabs & Controls */}
      {selectedElement && (
        <div className="flex flex-col text-xs">
          {/* Section Navigation */}
          <div className="flex border-b border-white/10 bg-[#101318] p-1 gap-1 overflow-x-auto">
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
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
                    activeTab === tab.id
                      ? "bg-[#15181f] text-zinc-100 shadow-2xs font-semibold border border-white/10"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="m-2 p-1.5 bg-red-500/10 text-red-300 border border-red-500/30 rounded text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{errorMsg.field}:</strong> {errorMsg.message}
              </span>
            </div>
          )}

          {/* Form Properties Body */}
          <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
            {/* 1. LAYOUT SECTION */}
            {activeTab === "layout" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="Display"
                    field="display"
                    value={formValues.display || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "display"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Position"
                    field="position"
                    value={formValues.position || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "position"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Width"
                    field="width"
                    value={formValues.width || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "width"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Height"
                    field="height"
                    value={formValues.height || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "height"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Padding"
                    field="padding"
                    value={formValues.padding || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "padding"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Margin"
                    field="margin"
                    value={formValues.margin || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "margin"}
                    isSaving={isSaving}
                  />
                </div>

                <div className="pt-2 border-t border-white/10">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Flex / Grid</span>
                  <div className="grid grid-cols-2 gap-2">
                    <PropertyInput
                      label="Gap"
                      field="gap"
                      value={formValues.gap || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "gap"}
                      isSaving={isSaving}
                    />
                    <PropertyInput
                      label="Justify"
                      field="justifyContent"
                      value={formValues.justifyContent || ""}
                      onChange={handleFieldChange}
                      onSave={handleSaveFieldToSource}
                      isLive={liveSuccessField === "justifyContent"}
                      isSaving={isSaving}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. TYPOGRAPHY SECTION */}
            {activeTab === "typography" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="Font Size"
                    field="fontSize"
                    value={formValues.fontSize || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "fontSize"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Font Weight"
                    field="fontWeight"
                    value={formValues.fontWeight || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "fontWeight"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Line Height"
                    field="lineHeight"
                    value={formValues.lineHeight || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "lineHeight"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Letter Spacing"
                    field="letterSpacing"
                    value={formValues.letterSpacing || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "letterSpacing"}
                    isSaving={isSaving}
                  />
                </div>
                <PropertyInput
                  label="Text Align"
                  field="textAlign"
                  value={formValues.textAlign || ""}
                  onChange={handleFieldChange}
                  onSave={handleSaveFieldToSource}
                  isLive={liveSuccessField === "textAlign"}
                  isSaving={isSaving}
                />
              </div>
            )}

            {/* 3. COLORS & SURFACES */}
            {activeTab === "colors" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="Text Color"
                    field="color"
                    value={formValues.color || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "color"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Background"
                    field="backgroundColor"
                    value={formValues.backgroundColor || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "backgroundColor"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Border Color"
                    field="borderColor"
                    value={formValues.borderColor || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "borderColor"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Border Radius"
                    field="borderRadius"
                    value={formValues.borderRadius || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "borderRadius"}
                    isSaving={isSaving}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="Border Width"
                    field="borderWidth"
                    value={formValues.borderWidth || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "borderWidth"}
                    isSaving={isSaving}
                  />
                  <PropertyInput
                    label="Border Style"
                    field="borderStyle"
                    value={formValues.borderStyle || ""}
                    onChange={handleFieldChange}
                    onSave={handleSaveFieldToSource}
                    isLive={liveSuccessField === "borderStyle"}
                    isSaving={isSaving}
                  />
                </div>
              </div>
            )}

            {/* 4. EFFECTS */}
            {activeTab === "effects" && (
              <div className="space-y-2.5">
                <PropertyInput
                  label="Opacity"
                  field="opacity"
                  value={formValues.opacity || ""}
                  onChange={handleFieldChange}
                  onSave={handleSaveFieldToSource}
                  isLive={liveSuccessField === "opacity"}
                  isSaving={isSaving}
                />
                <PropertyInput
                  label="Box Shadow"
                  field="boxShadow"
                  value={formValues.boxShadow || ""}
                  onChange={handleFieldChange}
                  onSave={handleSaveFieldToSource}
                  isLive={liveSuccessField === "boxShadow"}
                  isSaving={isSaving}
                />
                <PropertyInput
                  label="Transform"
                  field="transform"
                  value={formValues.transform || ""}
                  onChange={handleFieldChange}
                  onSave={handleSaveFieldToSource}
                  isLive={liveSuccessField === "transform"}
                  isSaving={isSaving}
                />
              </div>
            )}

            {/* 5. CONTENT & ATTRIBUTES */}
            {activeTab === "attributes" && (
              <div className="space-y-2.5">
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
                    rows={2}
                    value={formValues.textContent || ""}
                    onChange={(e) => handleFieldChange("textContent", e.target.value)}
                    className="w-full text-xs p-1.5 border border-white/10 rounded bg-[#0b0d10]"
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
          </div>

          {/* Recent Visual Changes History Footnote */}
          {recentChanges.length > 0 && (
            <div className="p-2 bg-[#101318] border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
              <span>{recentChanges.length} visual change(s) this session</span>
              <span className="font-semibold text-emerald-300">Live preview synchronized</span>
            </div>
          )}
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
}

const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  field,
  value,
  onChange,
  onSave,
  isLive,
  isSaving,
}) => {
  return (
    <div className="border border-white/10 p-1.5 rounded bg-[#15181f] space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
        <div className="flex items-center gap-1">
          {isLive && <Check className="w-3 h-3 text-emerald-300 animate-fadeIn" />}
          <button
            type="button"
            onClick={() => onSave(field)}
            disabled={isSaving}
            className="p-0.5 text-zinc-400 hover:text-primary rounded"
            title="Save to Project Source"
          >
            <Save className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full text-xs p-1 border border-white/10 rounded bg-[#0b0d10] font-mono focus:outline-none focus:border-primary"
      />
    </div>
  );
};
