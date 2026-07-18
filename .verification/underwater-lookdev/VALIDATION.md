# Underwater hero look-development validation

Date: 2026-07-18

Baseline commit: `98c1867`

## Visual diagnosis

The baseline confirmed all fourteen suspected issues. The scene used nearly one pale value range; the environment had too little refractive structure; the glyph shader imposed a constant body mix and minimum optical thickness; sidewalls and highlights lacked direction; the persistent surface moved but had no clear optical boundary; and the title, copy, and location read as separate layers. The physics data was stronger than the visible interaction.

The root cause was optical and compositional, not the heightfield or rigid-body architecture. Transparent meshes were asked to separate from a homogeneous background, then ACES compressed the remaining tonal differences into a gray midrange.

## Final optical configuration

- Exposure: `0.96` (`1.08` only for the brightest-safe diagnostic).
- Tone curve: custom underwater shallow shoulder; no ACES midrange lift.
- Glyph key / fill / environment intensity: `3.8 / 1.1 / 0.58`.
- IOR / roughness: `1.405 / 0.072`.
- Absorption color / distance: `#91a9b7 / 1.08`.
- Surface distortion / caustic strength / depth attenuation: `0.0105 / 0.18 / 0.18`.
- Resting ambient heightfield forcing: `0.013`.
- Refraction taps: high `5`, balanced `3`, low `1`.
- Desktop simulation: high `256x165` during active performance capture; tablet `192x144`; mobile balanced emulation `128x277`.
- Desktop active render resolution: `1382x893` after stable adaptive scale `0.80`; initial static captures rendered at the viewport resolution.
- Mobile balanced render resolution: `351x759` at `390x844` CSS pixels.

Environment parameters are authored in the backdrop and composite shaders: pearl / smoke-blue volume, upper-water boundary around normalized `0.90`, two broad depth pockets, one title depth shelf, one long refracted band, selective upper folds, depth-aware transmitted shadow, and low-frequency caustic concentration. Portrait layouts blend `78%` toward a calm base volume.

## Evidence inventory

| Evidence | Viewport | Tier | Finding |
| --- | --- | --- | --- |
| `01-baseline-98c1867-1728x1117.png` | 1728x1117 | high | Uniform pale baseline; weak water and title separation. |
| `02-final-1728x1117-rest.png` | 1728x1117 | high | Dominant unified title, visible upper-water boundary, dark refractive structure, open counters. |
| `03-final-1440x900-rest.png` | 1440x900 | high | CTA and navigation remain in the first viewport. |
| `04-final-1024x768-tablet.png` | 1024x768 | high, 1024x768 render, 192x144 sim | Tablet safe-zone fix keeps semantic copy below the lower title. |
| `05-final-390x844-mobile.png` | 390x844 | balanced, 351x759 render, 128x277 sim | Two-line title and CTA remain visible; lower environment is deliberately calmer. |
| `06-close-e.png` | 1728x1117 crop | high | E arms remain distinct; clear face and dense sidewall differ. |
| `07-close-a.png` | 1728x1117 crop | high | A counter stays open. |
| `08-close-r.png` | 1728x1117 crop | high | R bowl and leg remain distinct. |
| `09-close-p.png` | 1728x1117 crop | high | P counter stays open during refraction. |
| `10-close-o.png` | 1728x1117 crop | high | O remains circular with controlled internal reflection. |
| `11-upper-water-surface.png` | 1728x1117 crop | high | Upper boundary, trough, and selective folds identify the water volume. |
| `12-between-lines-water.png` | 1728x1117 crop | high | Water remains visible between lines without forcing excess spacing. |
| `13-sidewall-counter.png` | 1728x1117 crop | high | Clear front, inflated shoulder, dense sidewall, and counter separation. |
| `14-brightest-safe-exposure.png` | 1728x1117 | high, exposure 1.08 | Hero luminance clipping is `0.0001%`; click energy remains localized. |
| `15-slow-pointer-wake-frame-01/02.png` | 1728x1117 | high | Slow directional surface wake sequence. |
| `16-fast-pointer-wake-frame-01/02.png` | 1728x1117 | high | Faster fold compression and broader wake sequence. |
| `17-center-click-frame-01..03.png` | 1728x1117 | high | Center click peaked at `28.29px`; no full-screen flash. |
| `18-off-center-click-frame-01..03.png` | 1728x1117 | high | Independent P bodies peaked at `30.96–36.32px` and `5.99–6.21deg`. |
| `19-click-between-glyphs-frame-01..03.png` | 1728x1117 | high | Delayed neighbor response across adjacent P/E bodies and water feedback. |
| `20-settled-after-interaction.png` | 1728x1117 | high | All current offsets and rotations returned below `1px/1deg`; persistent water calmed separately. |
| `21-reduced-motion-state.png` | 1728x1117 | static fallback | Static water-glass fallback remains composed and readable. |
| `22-missing-glb-fallback.png` | 1728x1117 | high fallback | Manifest text remains visible after forced GLB failure. |
| `23-scroll-away-frame-01.png`, `23-scroll-return-frame-02.png` | 1728x1117 | high | Scroll restores to `scrollY=0`; renderer resumes without duplicate canvases. |
| `24-resize-recovery-frame-01-mobile.png`, `24-resize-recovery-frame-02-desktop.png` | 390x844 -> 1728x1117 | balanced -> high | Camera, render targets, sim resolution, and semantic safe zones recover after settling. |
| `side-by-side-reference-baseline-final.png` | equal 1410x494 crops | n/a | Left: reference; center: baseline; right: final. Final materially improves water presence, depth, and title hierarchy. |

## Luminance and exposure

`luminance-analysis.json` measures the hero below the 70px navigation bar.

- Baseline mean / p05 / p95: `0.6478 / 0.5971 / 0.6812`.
- Final mean / p05 / p95: `0.4412 / 0.2515 / 0.5796`.
- Final clipped luminance: `0.0%`.
- Brightest-safe clipped luminance: `0.0001%`.

The wider final range confirms useful dark information behind the transparent glyphs without converting the page to dark mode.

## Performance

Measured with high-tier five-tap refraction while pointer wakes and three clicks were active. Raw dataset: `performance-active.json`.

- Average FPS: `60.0`.
- p95 frame time: `17.70ms` (baseline `18.6ms`).
- p95 renderer work: `2.30ms` (target below `5ms`).
- Draw calls: `57` (baseline `61`).
- Triangles: `153,930`.
- Render targets: `38.3MB` estimate at the measured adaptive resolution.
- No synchronous GPU readback, runtime shader recompilation, or per-frame object allocation was introduced.
- Production build stabilized at `60.0 FPS`, `16.80ms` frame p95, `0.30ms` renderer-work p95, adaptive scale `0.90`, and `57` draw calls (`production-build-stability.png`).

## Lifecycle and regression checks

- Initial load: GLB and 13 manifest glyphs present.
- Continuous pointer and repeated clicks: browser CUA sequences captured above.
- Touch scroll: mobile emulation reached `scrollY=612.5` with one canvas.
- Resize: balanced mobile to high desktop recovered; no duplicate canvas.
- Reduced motion: canvas count changed from one to zero; static fallback remained visible.
- WebGL cleanup/restart: canvas count `1 -> 0 -> 1`, engine restored as Three.js r180 with 13 glyphs.
- Missing GLB: forced development URL retained semantic fallback at opacity one.
- Hidden-tab pause: browser tab creation did not foreground the new tab, so lifecycle behavior is covered by the explicit `document.hidden` / `visibilitychange` regression assertions and renderer cleanup path rather than claimed as a foreground-tab browser capture.
- Physics architecture was not rebuilt. Only resting ambient forcing changed from `0.018` to `0.013` to prevent long-run optical over-amplification.

## Design-taste audit

- Replaced visible em dash copy with a natural comma construction.
- Replaced decorative role dots with restrained slash separators.
- Removed the decorative blue dot from the navigation CTA.
- Kept the availability indicator because it communicates explicit state.
- Preserved one accent color, the existing routes, semantic DOM copy, CTA, and one-line navigation.
