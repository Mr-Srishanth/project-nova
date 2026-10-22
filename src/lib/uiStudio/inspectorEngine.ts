import type { BuildArtifact } from "@/types/artifact";

/**
 * Validates CSS property values and URLs against safety and syntactical rules.
 */
export function validateCssValue(property: string, value: string): { valid: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: "Value cannot be empty" };
  }

  // Prevent script injection or expression hacks
  if (/javascript:|expression\(|<script|behavior:|binding:/i.test(trimmed)) {
    return { valid: false, error: "Unsafe script or expression detected in style value" };
  }

  if (property === "color" || property === "backgroundColor" || property === "borderColor") {
    const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed);
    const isFunc = /^(rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(trimmed);
    const isNamed = /^[a-z]+$/i.test(trimmed);
    const isTransparentOrCurrent = trimmed === "transparent" || trimmed === "currentColor" || trimmed === "inherit";
    if (!isHex && !isFunc && !isNamed && !isTransparentOrCurrent) {
      return { valid: false, error: "Invalid color format (use hex, rgb, hsl, or standard color name)" };
    }
  }

  if (
    [
      "fontSize",
      "padding",
      "margin",
      "width",
      "height",
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
      "gap",
      "borderRadius",
      "borderWidth",
      "letterSpacing",
      "lineHeight",
    ].includes(property)
  ) {
    const isKeyword = /^(auto|inherit|initial|unset|normal|fit-content|max-content|min-content)$/i.test(trimmed);
    const isUnit = /^-?(\d+(\.\d+)?)(px|rem|em|%|vh|vw|pt|ch|fr)?(\s+-?(\d+(\.\d+)?)(px|rem|em|%|vh|vw|pt|ch|fr)?)*$/i.test(trimmed);
    if (!isKeyword && !isUnit) {
      return { valid: false, error: "Invalid CSS measurement unit (e.g., 16px, 1.5rem, 100%)" };
    }
  }

  if (property === "href" || property === "src") {
    if (/^javascript:/i.test(trimmed)) {
      return { valid: false, error: "javascript: URLs are strictly disallowed" };
    }
    const isSafeUrl =
      /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed) ||
      /^\/[a-zA-Z0-9_\-./?#=&%]*$/.test(trimmed) ||
      /^#[a-zA-Z0-9_\-]+$/.test(trimmed) ||
      /^mailto:[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/i.test(trimmed);
    if (!isSafeUrl) {
      return { valid: false, error: "Invalid URL (must be valid HTTP/HTTPS, relative path, or hash)" };
    }
  }

  return { valid: true };
}

/**
 * Maps a camelCase or kebab-case CSS property to standard CSS property name.
 */
export function toCssPropertyName(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

// -----------------------------------------------------------------------------
// JSX opening-tag scanning (quote/brace aware, so `>` inside props is safe)
// -----------------------------------------------------------------------------

interface TagSpan {
  start: number;
  end: number;
  text: string;
  tagName: string;
}

function scanOpeningTags(content: string): TagSpan[] {
  const tags: TagSpan[] = [];
  let i = 0;
  while (i < content.length) {
    if (content[i] === "<" && /[A-Za-z]/.test(content[i + 1] || "")) {
      let j = i + 1;
      let depth = 0;
      let quote: string | null = null;
      while (j < content.length) {
        const ch = content[j];
        if (quote) {
          if (ch === quote && content[j - 1] !== "\\") quote = null;
        } else if (ch === '"' || ch === "'" || ch === "`") {
          quote = ch;
        } else if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
        } else if (ch === ">" && depth === 0) {
          break;
        }
        j++;
      }
      if (j < content.length) {
        const text = content.slice(i, j + 1);
        const m = text.match(/^<([A-Za-z][A-Za-z0-9.]*)/);
        if (m) tags.push({ start: i, end: j + 1, text, tagName: m[1] });
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return tags;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the source contains the token as a whole word inside a className attribute. */
function contentHasClassToken(content: string, token: string): boolean {
  if (!token) return false;
  const re = new RegExp(`className\\s*=\\s*(?:"[^"]*\\b${escapeRegExp(token)}\\b|\\{\\s*['"\`][^'"\`]*\\b${escapeRegExp(token)}\\b)`);
  return re.test(content);
}

function tagHasClassToken(tagText: string, token: string): boolean {
  const m = tagText.match(/className\s*=\s*(?:"([^"]*)"|\{\s*['"`]([^'"`]*)['"`]|\{`([^`]*)`)/);
  if (!m) return false;
  const classes = (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/);
  return classes.includes(token);
}

function tagHasId(tagText: string, id: string): boolean {
  return new RegExp(`\\bid\\s*=\\s*(?:"${escapeRegExp(id)}"|'${escapeRegExp(id)}')`).test(tagText);
}

// -----------------------------------------------------------------------------
// Style-object merge (replaces an existing property instead of duplicating it)
// -----------------------------------------------------------------------------

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === quote && inner[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
    } else if (ch === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function escapeStyleValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Sets `property: "value"` inside a JSX opening tag: merges into an existing
 * style={{ ... }} object (replacing the property when already present) or
 * adds a new style attribute. Returns the updated tag text.
 */
function setStyleInTag(tagText: string, property: string, value: string): string {
  const entry = `${property}: "${escapeStyleValue(value)}"`;
  const styleIdx = tagText.search(/\bstyle\s*=\s*\{\{/);
  if (styleIdx >= 0) {
    const openIdx = tagText.indexOf("{{", styleIdx) + 2;
    // Find the matching close of the style object (depth-aware).
    let depth = 1;
    let quote: string | null = null;
    let j = openIdx;
    while (j < tagText.length && depth > 0) {
      const ch = tagText[j];
      if (quote) {
        if (ch === quote && tagText[j - 1] !== "\\") quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      }
      j++;
    }
    const closeIdx = j - 1; // index of the first } of "}}"
    const inner = tagText.slice(openIdx, closeIdx);
    const entries = splitTopLevel(inner);
    const cssProp = toCssPropertyName(property);
    let replaced = false;
    const merged = entries.map((e) => {
      const keyMatch = e.match(/^['"]?([A-Za-z-]+)['"]?\s*:/);
      if (keyMatch && (keyMatch[1] === property || toCssPropertyName(keyMatch[1]) === cssProp)) {
        replaced = true;
        return entry;
      }
      return e;
    });
    if (!replaced) merged.push(entry);
    return tagText.slice(0, openIdx) + merged.join(", ") + tagText.slice(closeIdx);
  }
  const selfClosing = tagText.endsWith("/>");
  const insertAt = selfClosing ? tagText.length - 2 : tagText.length - 1;
  return tagText.slice(0, insertAt) + ` style={{ ${entry} }}` + tagText.slice(insertAt);
}

/**
 * Resolves which source artifact an inspected element likely belongs to.
 * Checks, in order: explicit element id, distinctive className tokens,
 * unique visible text, and finally the app entry file (labelled "medium" —
 * callers must disclose that the target was inferred, never hide it).
 */
export function resolveSourceArtifactForElement(
  element: { tagName: string; id: string | null; className: string; textContent: string },
  artifacts: BuildArtifact[]
): { artifact: BuildArtifact | null; confidence: "high" | "medium" | "low" | "none" } {
  // If target element has an explicit ID
  if (element.id) {
    const idMatches = artifacts.filter(
      (a) => a.content && (a.content.includes(`id="${element.id}"`) || a.content.includes(`id='${element.id}'`) || a.content.includes(`"${element.id}"`))
    );
    if (idMatches.length === 1) {
      return { artifact: idMatches[0], confidence: "high" };
    }
  }

  // Distinctive className tokens (the strongest signal in Tailwind/JSX source)
  const tokens = (element.className || "")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !/^(flex|grid|block|hidden|relative|absolute|fixed|sticky|container|w-full|h-full|items-center|justify-center|text-center)$/.test(t));
  for (const token of tokens) {
    const classMatches = artifacts.filter(
      (a) => a.content && (a.path.endsWith(".tsx") || a.path.endsWith(".jsx")) && contentHasClassToken(a.content, token)
    );
    if (classMatches.length === 1) {
      return { artifact: classMatches[0], confidence: token.length >= 6 ? "high" : "medium" };
    }
  }

  // Check unique text snippet if available
  const cleanText = element.textContent.trim();
  if (cleanText.length > 5 && cleanText.length < 50) {
    const textMatches = artifacts.filter(
      (a) => a.content && a.content.includes(cleanText) && (a.path.endsWith(".tsx") || a.path.endsWith(".jsx"))
    );
    if (textMatches.length === 1) {
      return { artifact: textMatches[0], confidence: "high" };
    }
  }

  // Check App.tsx default entry
  const appArtifact = artifacts.find(
    (a) => a.path === "src/app/App.tsx" || a.path === "src/App.tsx" || a.path === "src/main.tsx"
  );
  if (appArtifact) {
    return { artifact: appArtifact, confidence: "medium" };
  }

  return { artifact: null, confidence: "none" };
}

export type InspectorApplyStrategy = "inline_style" | "css_rule" | "attribute_update";

/**
 * Applies an updated style or attribute to ONE project artifact.
 *
 * Truthfulness contract: this function either returns content in which the
 * change genuinely takes effect, or throws. It never appends inert comments
 * or otherwise reports a successful edit that changes nothing (the previous
 * "Strategy D" appended a CSS comment to the TSX file and claimed success —
 * that behaviour is removed).
 */
export function applyStyleToArtifact(
  artifact: BuildArtifact,
  element: { tagName: string; id: string | null; className: string; textContent: string; previewId?: string | null },
  property: string,
  value: string
): { updatedContent: string; appliedStrategy: InspectorApplyStrategy } {
  const content = artifact.content || "";
  const cssProp = toCssPropertyName(property);

  // Strategy A: stylesheet artifact — append/replace a real CSS rule
  if (artifact.path.endsWith(".css")) {
    const selector = element.id ? `#${element.id}` : element.className ? `.${element.className.trim().split(/\s+/)[0]}` : element.tagName;
    return {
      updatedContent: upsertInspectorCssRule(content, selector, cssProp, value),
      appliedStrategy: "css_rule",
    };
  }

  // Strategy B: textContent replacement when the exact text exists in source
  if (property === "textContent" && element.textContent && content.includes(element.textContent)) {
    const updated = content.replace(new RegExp(escapeRegExp(element.textContent), "g"), value);
    return {
      updatedContent: updated,
      appliedStrategy: "attribute_update",
    };
  }

  // Attribute properties (href/src/alt/title) on a locatable element
  if (["href", "src", "alt", "title"].includes(property)) {
    const located = locateElementTag(content, element);
    if (located) {
      const updatedTag = setAttributeInTag(located.text, property, value);
      return {
        updatedContent: content.slice(0, located.start) + updatedTag + content.slice(located.end),
        appliedStrategy: "attribute_update",
      };
    }
    throw new Error(
      `Could not locate <${element.tagName}> in ${artifact.path}; the ${property} change was NOT written to source.`
    );
  }

  // Strategy C: locate the JSX element (by id, then by className token) and
  // merge the property into its inline style.
  const located = locateElementTag(content, element);
  if (located) {
    const updatedTag = setStyleInTag(located.text, property, value);
    return {
      updatedContent: content.slice(0, located.start) + updatedTag + content.slice(located.end),
      appliedStrategy: "inline_style",
    };
  }

  throw new Error(
    `Could not locate <${element.tagName}>${element.id ? ` #${element.id}` : ""} in ${artifact.path}; the ${property} change was NOT written to source.`
  );
}

function setAttributeInTag(tagText: string, property: string, value: string): string {
  const attrRe = new RegExp(`\\b${property}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`);
  const escaped = value.replace(/"/g, "&quot;");
  if (attrRe.test(tagText)) {
    return tagText.replace(attrRe, `${property}="${escaped}"`);
  }
  const selfClosing = tagText.endsWith("/>");
  const insertAt = selfClosing ? tagText.length - 2 : tagText.length - 1;
  return tagText.slice(0, insertAt) + ` ${property}="${escaped}"` + tagText.slice(insertAt);
}

/**
 * Finds the opening tag of the rendered element inside TSX/JSX source:
 * exact id match first, then a unique className-token match (preferring the
 * same tag name), then a unique same-tag match.
 */
function locateElementTag(
  content: string,
  element: { tagName: string; id: string | null; className: string }
): TagSpan | null {
  const tags = scanOpeningTags(content);
  if (element.id) {
    const byId = tags.filter((t) => tagHasId(t.text, element.id!));
    if (byId.length === 1) return byId[0];
    if (byId.length > 1) return null; // ambiguous — refuse to guess
  }
  const tokens = (element.className || "").split(/\s+/).filter((t) => t.length >= 3);
  for (const token of tokens) {
    const matches = tags.filter((t) => tagHasClassToken(t.text, token));
    if (matches.length === 1) return matches[0];
    const sameTag = matches.filter((t) => t.tagName.toLowerCase() === element.tagName.toLowerCase());
    if (sameTag.length === 1) return sameTag[0];
  }
  return null;
}

// -----------------------------------------------------------------------------
// Project-level application with a real stylesheet fallback
// -----------------------------------------------------------------------------

const INSPECTOR_RULE_MARKER = "ui-studio-inspector";

/** Inserts or replaces the managed inspector rule for (selector, property). */
export function upsertInspectorCssRule(css: string, selector: string, cssProperty: string, value: string): string {
  const marker = `/* ${INSPECTOR_RULE_MARKER}:${selector}:${cssProperty} */`;
  const rule = `${marker}\n${selector} {\n  ${cssProperty}: ${value} !important;\n}\n`;
  const existingRe = new RegExp(
    `/\\* ${INSPECTOR_RULE_MARKER}:${escapeRegExp(selector)}:${escapeRegExp(cssProperty)} \\*/\\n[^}]*\\}\\n?`
  );
  if (existingRe.test(css)) {
    return css.replace(existingRe, rule);
  }
  return css.replace(/\s*$/, "") + "\n\n" + rule;
}

export interface ProjectStyleUpdate {
  path: string;
  updatedContent: string;
  strategy: InspectorApplyStrategy;
  /** True when the stylesheet artifact does not exist yet and must be created. */
  isNewFile: boolean;
}

export interface ProjectStyleResult {
  updates: ProjectStyleUpdate[];
  resolvedPath: string;
  confidence: "high" | "medium" | "low" | "none";
  strategy: InspectorApplyStrategy;
}

/**
 * Applies an inspector change to the project, guaranteeing the change is real:
 * 1. Writes an inline style / attribute / text update into the resolved source
 *    file when the element can be located there.
 * 2. Otherwise appends a REAL rule to the project stylesheet (the preview
 *    injects src/index.css), which genuinely affects rendering.
 * 3. Throws an honest error when neither is possible (e.g. textContent with
 *    no locatable element, or no artifacts at all).
 */
export function applyStyleToProject(
  artifacts: BuildArtifact[],
  element: { tagName: string; id: string | null; className: string; textContent: string; previewId?: string | null },
  property: string,
  value: string
): ProjectStyleResult {
  if (artifacts.length === 0) {
    throw new Error("The project has no files; the inspector change was NOT written to source.");
  }
  const cssProp = toCssPropertyName(property);
  const resolved = resolveSourceArtifactForElement(element, artifacts);

  if (resolved.artifact) {
    try {
      const { updatedContent, appliedStrategy } = applyStyleToArtifact(resolved.artifact, element, property, value);
      return {
        updates: [{ path: resolved.artifact.path, updatedContent, strategy: appliedStrategy, isNewFile: false }],
        resolvedPath: resolved.artifact.path,
        confidence: resolved.confidence,
        strategy: appliedStrategy,
      };
    } catch {
      // Element not locatable in the resolved file — fall through to the
      // stylesheet rule, which does take effect. textContent cannot be
      // expressed in CSS, so surface the original failure for it.
      if (property === "textContent" || ["href", "src", "alt", "title"].includes(property)) {
        throw new Error(
          `Could not locate <${element.tagName}> in ${resolved.artifact.path}; the ${property} change was NOT written to source.`
        );
      }
    }
  }

  if (property === "textContent" || ["href", "src", "alt", "title"].includes(property)) {
    throw new Error(
      `Could not locate <${element.tagName}> in any source file; the ${property} change was NOT written to source.`
    );
  }

  // Stylesheet fallback: a real CSS rule in the project's stylesheet.
  const selector = element.id
    ? `#${element.id}`
    : element.className
    ? `.${element.className.trim().split(/\s+/)[0]}`
    : element.tagName;
  const cssArtifact =
    artifacts.find((a) => a.path.replace(/\\/g, "/") === "src/index.css") ||
    artifacts.find((a) => a.path.endsWith(".css"));
  if (cssArtifact) {
    return {
      updates: [
        {
          path: cssArtifact.path,
          updatedContent: upsertInspectorCssRule(cssArtifact.content || "", selector, cssProp, value),
          strategy: "css_rule",
          isNewFile: false,
        },
      ],
      resolvedPath: cssArtifact.path,
      confidence: resolved.confidence,
      strategy: "css_rule",
    };
  }
  return {
    updates: [
      {
        path: "src/index.css",
        updatedContent: upsertInspectorCssRule("", selector, cssProp, value),
        strategy: "css_rule",
        isNewFile: true,
      },
    ],
    resolvedPath: "src/index.css",
    confidence: resolved.confidence,
    strategy: "css_rule",
  };
}
