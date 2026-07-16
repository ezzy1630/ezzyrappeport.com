export type GlyphDebugVec2 = readonly [x: number, y: number];
export type GlyphDebugVec3 = readonly [x: number, y: number, z: number];

export type GlyphDebugBounds = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type GlyphDebugImpact = Readonly<{
  source: "pointer" | "ripple" | "debug";
  position: GlyphDebugVec2;
  impulse: GlyphDebugVec2;
  strength: number;
  timestamp: number;
}>;

export type GlyphDebugSnapshot = Readonly<{
  index: number;
  identity: string;
  restCenter: GlyphDebugVec2;
  currentCenter: GlyphDebugVec2;
  bounds: GlyphDebugBounds;
  displacement: GlyphDebugVec2;
  velocity: GlyphDebugVec2;
  orientation: GlyphDebugVec3;
  angularVelocity: GlyphDebugVec3;
  latestImpact: GlyphDebugImpact | null;
}>;

export type GlyphDebugImpulseRequest =
  | Readonly<{
      kind: "glyph";
      glyphIndex: number;
      anchor: "center" | "left-edge" | "right-edge";
      strength: number;
    }>
  | Readonly<{
      kind: "between";
      firstGlyphIndex: number;
      secondGlyphIndex: number;
      strength: number;
    }>;

export type GlyphDebugHooks = Readonly<{
  readSnapshots: () => readonly GlyphDebugSnapshot[];
  applyImpulse: (request: GlyphDebugImpulseRequest) => void;
}>;

export type GlyphDebugApi = Readonly<{
  enabled: true;
  getSnapshots: () => readonly GlyphDebugSnapshot[];
  getSelectedGlyph: () => number;
  select: (glyphIndex: number) => void;
  impulse: (
    glyphIndex: number,
    anchor?: "center" | "left-edge" | "right-edge",
    strength?: number,
  ) => void;
  impulseBetween: (firstGlyphIndex: number, secondGlyphIndex: number, strength?: number) => void;
  refresh: () => void;
}>;

declare global {
  interface Window {
    __glyphDebug?: GlyphDebugApi;
  }
}

export type GlyphDebugController = Readonly<{
  api: GlyphDebugApi;
  tick: (now?: number) => void;
  remove: () => void;
}>;

const OVERLAY_ID = "glyph-debug-overlay";
const REFRESH_INTERVAL_MS = 100;

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function fixed(value: number, digits = 1) {
  return finite(value).toFixed(digits);
}

function vec2(value: GlyphDebugVec2) {
  return `${fixed(value[0])},${fixed(value[1])}`;
}

function vec3Degrees(value: GlyphDebugVec3) {
  const radiansToDegrees = 180 / Math.PI;
  return `${fixed(value[0] * radiansToDegrees)}°,${fixed(value[1] * radiansToDegrees)}°,${fixed(value[2] * radiansToDegrees)}°`;
}

export function formatGlyphDebugSnapshot(snapshot: GlyphDebugSnapshot, strongestIndex = -1) {
  const impact = snapshot.latestImpact;
  const impactText = impact
    ? `${impact.source}@${vec2(impact.position)} j=${vec2(impact.impulse)} |j|=${fixed(impact.strength, 2)}`
    : "none";
  const bounds = snapshot.bounds;
  const strongest = snapshot.index === strongestIndex ? " ★ strongest" : "";

  return [
    `#${snapshot.index} ${snapshot.identity}${strongest}`,
    `rest ${vec2(snapshot.restCenter)}  now ${vec2(snapshot.currentCenter)}`,
    `bounds ${fixed(bounds.left)},${fixed(bounds.top)} → ${fixed(bounds.right)},${fixed(bounds.bottom)}`,
    `d ${vec2(snapshot.displacement)}  v ${vec2(snapshot.velocity)}`,
    `rot ${vec3Degrees(snapshot.orientation)}  ω ${vec3Degrees(snapshot.angularVelocity)}/s`,
    `impact ${impactText}`,
  ].join("\n");
}

export function isGlyphDebugEnabled(location: Pick<Location, "search"> = window.location) {
  return process.env.NODE_ENV !== "production"
    && new URLSearchParams(location.search).get("glyphDebug") === "1";
}

function strongestImpactIndex(snapshots: readonly GlyphDebugSnapshot[]) {
  let strongestIndex = -1;
  let strongestStrength = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const strength = snapshot.latestImpact?.strength ?? Number.NEGATIVE_INFINITY;
    if (strength > strongestStrength) {
      strongestStrength = strength;
      strongestIndex = snapshot.index;
    }
  }
  return strongestIndex;
}

function assertGlyphIndex(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Expected a non-negative glyph index, received ${value}`);
  }
}

export function installGlyphDebug(hooks: GlyphDebugHooks): GlyphDebugController | null {
  if (!isGlyphDebugEnabled()) return null;

  document.getElementById(OVERLAY_ID)?.remove();
  const overlay = document.createElement("pre");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-label", "Glyph physics debug information");
  overlay.style.cssText = [
    "position:fixed", "z-index:2147483647", "inset:8px auto auto 8px",
    "width:min(520px,calc(100vw - 16px))", "max-height:calc(100vh - 16px)",
    "overflow:auto", "margin:0", "padding:10px", "pointer-events:none",
    "white-space:pre-wrap", "color:#dff7ff", "background:rgba(4,10,18,.88)",
    "border:1px solid rgba(160,225,255,.45)", "border-radius:6px",
    "font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace", "text-shadow:0 1px 1px #000",
  ].join(";");
  document.body.appendChild(overlay);

  let selectedGlyph = 0;
  let lastRefresh = Number.NEGATIVE_INFINITY;
  const refresh = () => {
    const snapshots = hooks.readSnapshots();
    const strongestIndex = strongestImpactIndex(snapshots);
    const selected = snapshots.find((snapshot) => snapshot.index === selectedGlyph) ?? snapshots[0];
    const summary = selected ? formatGlyphDebugSnapshot(selected, strongestIndex) : "Waiting for renderer glyph state…";
    overlay.textContent = [
      "GLYPH DEBUG · CSS px / radians",
      "console: __glyphDebug.select(i), .impulse(i, anchor, strength), .impulseBetween(a, b, strength)",
      `glyphs ${snapshots.length} · selected ${selected?.index ?? "none"} · strongest ${strongestIndex < 0 ? "none" : strongestIndex}`,
      "", summary,
    ].join("\n");
  };

  const api: GlyphDebugApi = Object.freeze({
    enabled: true,
    getSnapshots: hooks.readSnapshots,
    getSelectedGlyph: () => selectedGlyph,
    select: (glyphIndex: number) => { assertGlyphIndex(glyphIndex); selectedGlyph = glyphIndex; refresh(); },
    impulse: (glyphIndex: number, anchor = "center", strength = 1) => {
      assertGlyphIndex(glyphIndex);
      hooks.applyImpulse({ kind: "glyph", glyphIndex, anchor, strength: finite(strength, 1) });
      selectedGlyph = glyphIndex;
      refresh();
    },
    impulseBetween: (firstGlyphIndex: number, secondGlyphIndex: number, strength = 1) => {
      assertGlyphIndex(firstGlyphIndex);
      assertGlyphIndex(secondGlyphIndex);
      hooks.applyImpulse({ kind: "between", firstGlyphIndex, secondGlyphIndex, strength: finite(strength, 1) });
      refresh();
    },
    refresh,
  });

  window.__glyphDebug = api;
  refresh();
  const remove = () => { overlay.remove(); if (window.__glyphDebug === api) delete window.__glyphDebug; };
  return Object.freeze({
    api,
    tick: (now = performance.now()) => {
      if (now - lastRefresh < REFRESH_INTERVAL_MS) return;
      lastRefresh = now;
      refresh();
    },
    remove,
  });
}
