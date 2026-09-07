# Living water · local implementation review

## Result

Replaced the live photographic water plate with a procedural surface, mineral floor, daylight environment, and forward-projected sunlight caustics. The caustic mesh refracts rays through the wave normal, projects them onto the floor, and accumulates overlapping footprints with area-density compensation. This is a real-time heightfield approximation, not a volumetric fluid solver. Technique reference: [Evan Wallace's WebGL water renderer](https://github.com/evanw/webgl-water/blob/master/renderer.js).

The water fills the viewport throughout the homepage and case studies. Cursor strokes, clicks, moving letters, floating project panels, and scroll currents share one pressure field and one frame clock. Letters have sampled release velocity, mass-dependent springs, collisions, torque, and buoyancy. Desktop panels can be pulled and released without triggering navigation; ordinary clicks open the case study. Touch scrolling stays the default, with explicit touch play for the water. Case pages omit the title GLB and keep reading panels opaque enough for legibility.

Regenerated desktop and mobile posters from paused, reset live captures at 1440×810 and 390×844. The mobile poster now covers the tablet breakpoint through 900px, preventing the desktop image from cropping the title at portrait tablet widths. Poster framing is approximate between capture aspect ratios.

## Evidence

- Typecheck and lint passed.
- `npm run test:water`: optical direction and total internal reflection; coupled buoyancy; field upload; poster provenance; gesture sample-rate equivalence; bounded throws/cancellation/settling; scroll-current decay; continuous wakes and repeated-impact stability passed.
- `npm run test:playground`: springs, contact momentum, render budgets, framing, assets, and water solver regressions passed.
- Separate retained-renderer runtime audit: 14 checks passed.
- Production build passed. Production HTTP audit passed 9 routes, anchors, 32 assets/downloads, and the unknown-project 404.
- Browser: live procedural rendering, desktop held-letter displacement/release, project-panel drag without navigation, subsequent ordinary case navigation, continuous water while scrolling, mobile homepage/case layouts, and no horizontal overflow at tested sizes.
- Browser: mobile touch play set `touch-action: none`; pause restored `pan-y`. Reduced motion paused the scene and cleared panel transforms. Forced WebGL context loss removed the canvas and exposed the fallback poster. JavaScript-disabled load preserved content, navigation, and poster.
- Local production timing at 1440×810, DPR 1: active median interval 16.7ms, p95 17.2ms; GPU p95 12.1ms. At the native 613×837, DPR 2 viewport, active interval p95 was 33.3ms and idle p95 reached 50ms. These short samples do not establish a sustained 60fps guarantee or phone performance.

## Remaining limits

`npm run test:portfolio` fails the existing em-dash assertion in `src/lib/portfolio/content.ts:766`; that content is unchanged from HEAD. Log: `/tmp/portfolio-world-regression.log`. Build logs: `/tmp/portfolio-world-build.log` and `/tmp/portfolio-world-build-final.log`.

Mobile checks used browser emulation, not physical hardware. Safari, physical-phone thermal/battery behavior, Save-Data emulation, and a new hidden-tab runtime measurement were not verified in this pass. Hidden-tab suspension and resource cleanup were reviewed in source. No commit, push, deployment, or public production change was made.

## Follow-up refinement

Implemented all five requested improvements: distinct low-frequency swells and sharper interaction ripples; depth-aware exposed/submerged glass with wet edges, outward body displacement, and release bob/splash; quieter caustic lighting; resistant card pulls with critically damped settling and filtered ambient motion; adaptive main/caustic target resolution with bounded degradation and conservative recovery probes. Passive card movement no longer continuously reinjects pressure.

Review found and repaired exposed-face picking and severe-overload detection. Browser verification grabbed an exposed E face, dragged a card ~44px without navigating, and then opened its case study with an ordinary click. Mobile homepage and case layouts remained within the viewport; touch play followed by pause restored `pan-y` scrolling. Updated posters were exported again at the documented dimensions.

New tests cover expanding splash propagation, body shoulder displacement, smooth drag resistance, sustained overload down to scale 0.65, preservation across resize/resume, isolated-stall rejection, and gradual recovery under healthy active cadence. All water/playground tests and the 14 retained-renderer audit checks passed. Typecheck/lint passed.

A deliberate 20× CPU-throttled browser run reduced quality to 0.65 under sustained interaction. Throttling was removed afterward. The subsequent active sample had a 16.7ms median interval, 33.3ms p95, and GPU p95 6.9ms at scale 0.65. It did not meet the conservative recovery threshold during that sample; recovery is established by controller tests, not that browser run. Mobile emulation at 390×844 DPR 1 showed GPU p95 about 6ms; this is not physical-phone evidence. No physical phone was available through the browser tooling, so sustained phone thermal/battery testing remains open.

Final production build log: `/tmp/water-refinement-build.log`.

The final production build passed and the HTTP audit again passed 9 routes, 32 assets/downloads, anchors, and the unknown-project 404. The final water suite passed after poster regeneration. Reduced-motion changes cleared panel transforms and paused the renderer; forced context loss removed the canvas and preserved the loaded poster. Browser throttling, media emulation, and viewport overrides were reset. The final preview is the production server at `http://127.0.0.1:3000/`.


## Atmospheric journey and project stages

Implemented a more spacious hero with approximately 13% smaller lettering, a 1.4-second light reveal, and a one-second supporting-copy entrance. Before JavaScript, the poster, text, and navigation remain available. Reduced motion and pause disable the entrances.

Four alternating full-width project stages replace the paired card grid. Each pairs the existing visual with purpose, delivered evidence, role, and case-study link. The paired image and copy stack on mobile. Opposing reveal directions, small scale differences, and varied shadow softness create depth without animating the reading copy. A centered project gently softens the surrounding caustics. Supplied project identity and campaign images remain labeled as such; only Etch currently has an interface capture in this checkout.

`journey.ts` ties descent to hero height and the return to the contact section's measured document position. Water becomes deeper blue and its light more diffuse through the work, then returns to depth 0.04 around contact. The contact invitation and email are centered with generous space; gradients soften the section boundary. Existing scene controls, links, normal scrolling, spring interactions, and quality adaptation remain.

Verification: typecheck/lint, production build, all water/playground tests, 14 retained-renderer audit checks, and the production HTTP audit (9 routes, 32 assets/downloads, anchors, unknown-project 404) passed. New behavioral tests verify bounded continuous depth, a bright opening and return, and centered/offscreen project emphasis. Build log: `/tmp/ethereal-build.log`.

Browser checks covered 1440×810 desktop and 390×844 mobile hero/project/contact layouts, no horizontal overflow, depth 1 through work and 0.04 at contact, case navigation, back-to-top, resized glass dragging, and reduced-motion clearing of transforms/opening animation. Posters were regenerated from paused/reset matching viewports. A source-review finding about stale shader project focus on pause/reset was repaired. Physical-device and public deployment evidence are still outside this local result; the previously documented punctuation-test failure is unchanged.


## Performance, clarity, and integrated project treatment

Replaced the drifting frame gate with a fractional-deadline clock. The old gate could render only 37.5fps on an unloaded 75Hz display, then interpret its own timing loss as overload and lower image resolution. The new clock targets 60fps for both active and ambient water. Behavioral tests cover 60, 75, 90, 120, 144, and 165Hz input cadence plus resumption without catch-up bursts.

Removed redundant MSAA from the final fullscreen context, reduced the internal Three transmission target to half resolution, reduced caustic geometry from 98,304 to 40,960 triangles, and added a 512×512 half-float optical surface cache shared by water/glass/caustics. The simulation grid remains unchanged. Platforms without renderable half-float textures use analytic waves instead of quantizing small slopes into 8 bits; the forced byte-target path rendered successfully without shader errors. Title bounds now stop its passes when the actual geometry leaves view. Water below the hero skips the HDR/FXAA resolve, and case pages omit the unused environment generation and full-size glass targets.

Adaptive savings primarily affect internal targets. Main output loses at most 5.25% per axis and stays at or above CSS pixel density within the existing global pixel cap. Held letter/card springs respond faster. DOM updates skip unchanged transforms and hover state, and resting stages drop 3D transforms. Only media tilts; text remains flat.

Removed the white project-copy panels and moved media descriptions into the typography. MonkeyClaw's white image background blends into the water; dark evidence images use thin frames. Featured images use quality 90 through Next's configured quality allowlist. New DPR-2 desktop/mobile/tablet posters improve startup sharpness and tablet framing.

Matched local browser samples at 613×837 CSS pixels, DPR 2, with the 1226×1674 drawing buffer retained: before, active interval p95 33.3ms and ambient p95 50ms; after, active and ambient p95 17.6ms, median 16.7ms. After GPU p95 was 11.44ms active and 12.75ms ambient, versus 12.35ms and 14.94ms before. These are short local samples, not a cross-device benchmark. The new 390×844 mobile-emulation reading path sampled GPU p95 4.77ms and frame interval p95 17.5ms with 3 calls and 40,964 triangles. Physical-phone performance remains unverified.

Typecheck/lint, water/playground tests, and the separate 14-check retained-renderer audit passed. Production build log: `/tmp/portfolio-performance-build.log`. The previously documented punctuation regression is unchanged.

Final production verification passed the build and HTTP audit (9 routes, 34 assets/downloads, anchors, and unknown-project 404). Browser checks confirmed held-glass input, quicker stage dragging with tilt confined to media, suppressed navigation after drag followed by working normal navigation, case-study initialization, touch-play pause restoring `pan-y`, the new tablet poster with JavaScript disabled, and reduced-motion startup. Browser overrides were cleared. No commit, push, or deployment was performed.
