# Homepage cinematic ocean transformation plan

Status: approved design and implementation plan

Source branch: `main` at `216e38d`

Implementation branch: `codex/cinematic-home-v2`

Rejected-branch source: `codex/cinematic-scrollytelling`

Scope: homepage only, from hero through footer; case-study routes remain editorial destinations

## 1. Executive contract

The homepage becomes one continuous, scroll-driven ocean journey. The experience begins immediately below a bright moving surface, descends through four authored project encounters, enters a quiet human layer, and settles at an abyssal contact basin. The ocean is not a background theme. It is the page's shared material, lighting, physics, navigation, sound, and transition system.

The direction is approximately 65% physically believable and 35% surreal. Water behavior, buoyancy, drag, pressure, refraction, absorption, caustics, haze, and depth must feel credible. Composition, scale, timing, and project metaphors may bend reality when that creates a stronger story.

“Wow” is a primary conversion goal. The experience must demonstrate that Ezzy can build ambitious interfaces others would only mock up. It must also remain a portfolio: visitors can understand the work, reach any case study, contact Ezzy, use standard browser navigation, and bypass the full journey at any time.

This is an incremental transformation from `main`, not a merge of the rejected `/experience-lab` implementation. Every milestone must be visually reviewed and performance-gated before the next section is built.

### Non-negotiable outcomes

- One coherent ocean world from hero to footer.
- A flagship desktop composition and a separately authored premium mobile composition.
- Scroll-driven, exact, reversible primary choreography.
- Stable navigation and normal browser semantics.
- Semantic DOM content; WebGL never gates reading or navigation.
- Smooth 60 FPS on an M1 MacBook Air-class device and iPhone 13-class Safari under the defined quality policy.
- Jane Street-style code: typed policies, pure mappings, explicit ownership, small effect boundaries, deterministic cleanup, and behavioral tests.
- No parallel scroll engines, renderers, motion stores, physics systems, or quality policies.
- No giant all-purpose scene class.
- No generic aquarium, industrial observatory, game HUD, glass-card UI, or disconnected chapter panels.

## 2. Evidence reviewed

This plan is based on:

- the current `main` homepage and its Hero → Projects → About → Contact structure;
- the current `src/features/kinetic-canvas` WebGL2 renderer, persistent water solver, GLB glyph system, fixed-step physics, quality ladder, and fallback behavior;
- the rejected branch's eight commits and its additional uncommitted visual pass;
- the rejected branch's `/experience-lab`, six-chapter observatory direction, generated GLBs, Blender sources, keyframes, scroll/runtime architecture, adaptive quality code, audio, preferences, diagnostics, and tests;
- the original bright-surface hero and deep-contact visual references at `/Users/ezzyrappeport/Downloads/download.png` and `/Users/ezzyrappeport/Downloads/download-1.png`;
- the prior task history that produced the rejected branch;
- the existing project records in `src/lib/portfolio/content.ts`;
- prior measured main-branch hero performance and browser evidence.

## 3. Current-state verdict

### 3.1 What `main` gets right

- The original visual identity is recognizable: bright surface water, crystalline name, blue depth arc, and abyssal contact.
- The homepage information architecture is direct and portfolio-shaped.
- Project content is substantive and fact-backed.
- The 13 hero glyphs already have independent transforms, mass, inertia, buoyancy, hover, click, and fixed-step physics seams.
- The persistent water solver, depth-aware renderer, semantic fallback, device quality tiers, visibility pause, context-loss handling, and case-study route separation are strong foundations.
- About and Contact already understand the desired tonal role: a calm reading pocket followed by an ocean floor.

### 3.2 What `main` still lacks

- The homepage is a sequence of sections over one ambient renderer, not yet one authored camera journey.
- Scroll/world state still has overlapping owners and DOM-derived mappings.
- The hero optical material is globally tuned; individual glyph construction and optical response are not authored deeply enough.
- The current hero departure is not a fully coherent physical transition into the rest of the page.
- Projects are long editorial rows rather than spatial encounters.
- Pointer effects are present but do not yet feel like one depth-aware physical probe across the entire experience.
- The shared frame clock needs subscriber fault isolation before it becomes the sole runtime clock.
- Current quality selection is useful but needs measured, hysteretic runtime adaptation across whole-page scenes.

### 3.3 Why the rejected branch is the wrong base

The rejected branch changes the product from an oceanic portfolio into an industrial underwater observatory. It adds invented Method and Lab chapters, a mission-like navigation rail, amber/titanium industrial art direction, large opaque story surfaces, generated station architecture, and a monolithic observatory engine. The resulting world competes with the work and abandons the airy, refractive identity that made `main` closer to the target.

The branch is also too large to merge safely: more than 12,000 committed inserted lines plus roughly 3,800 uncommitted inserted lines, a 2,600-line committed engine that grew substantially afterward, more than 5 MB of new Blender/GLB assets, and regression tests coupled to its invented structure.

The branch did produce valuable engineering. Those seams should be extracted individually after validation, not cherry-picked as a feature stack.

## 4. Fixed product decisions

- Full-page metaphor: involved ocean descent, not an abstract water accent.
- Art direction: 65% credible ocean physics, 35% surreal composition.
- Journey time: approximately 60–120 seconds at a natural trackpad pace.
- Scrolling: native and reversible by default. Pinning, snapping, inertial shaping, or temporary input capture is allowed only when it materially improves a scene and passes the interaction gates in this plan.
- Desktop: complete flagship real-time experience.
- Mobile: separately staged experience using the same story and visual identity.
- Anchor projects: MonkeyClaw, Etch, FlowE, and a shorter Argyph encounter.
- Remaining projects: Velox, NexaRad, and MathPilot remain visible, distinct, and directly reachable through Charted Work.
- No standalone Method or Observatory destination.
- About and Contact deliberately reduce visual intensity.
- Sound is optional, muted by default, and first-class after opt-in.
- Important copy and actions remain semantic DOM.
- WebGL2 is the production baseline. WebGPU is an optional capability path only when profiling proves a meaningful gain.
- The visual direction is singular. Technical unknowns may use bounded proof-of-concept tests with objective pass/fail criteria.

## 5. Experience topology and pacing

The final timing is tuned through real use, not locked to a fixed `vh` rail. The initial authored target is:

| Journey beat | Natural duration | Relative scroll share | Intensity |
| --- | ---: | ---: | --- |
| Surface arrival and hero play | 12–20 s | 14% | High wonder, low speed |
| Hero release and first descent | 6–10 s | 8% | First motion peak |
| MonkeyClaw | 12–18 s | 17% | Tense and reactive |
| Etch | 12–18 s | 17% | Mechanical precision |
| FlowE | 12–18 s | 17% | Luminous calm |
| Argyph | 6–10 s | 8% | Fast, sharp proof beat |
| Charted Work | 5–8 s | 6% | Browsable overview |
| About | 8–12 s | 7% | Decompression |
| Contact and footer | 8–12 s | 6% | Still, decisive close |

These are pacing targets, not timers. A visitor may scroll faster, reverse immediately, jump by anchor, use the scrollbar, or tab directly to content. Primary state always derives from scroll position, never elapsed time.

## 6. Global ocean system

### 6.1 Physical world

The homepage is one vertical body of water with continuous pressure, color absorption, particle density, current, and acoustic state. Sections do not swap unrelated backgrounds. They reveal different formations within the same ocean.

Depth drives:

- sun intensity and directionality;
- water color absorption and scattering;
- caustic sharpness and speed;
- visibility distance and fog density;
- current direction, turbulence, and suspended matter;
- material contrast and edge readability;
- audio filtering and pressure tone;
- navigation contrast and minimal depth indication.

Depth must not drive every property linearly. Each quantity has an authored curve. Caustics disappear before the deepest basin. Particles become more visible in side light but do not simply multiply forever. Text contrast is section-owned and verified, not guessed from a numeric depth threshold.

### 6.2 Camera grammar

- One authored camera spline describes primary position, target, roll, field of view, and focus distance.
- Camera motion favors descent, glide, and controlled orbital reveals. Avoid roller-coaster yaw, constant forward flight, and large roll.
- Primary camera state is a pure function of normalized journey progress.
- Secondary spring response may react to scroll velocity or pointer motion but must decay to the deterministic primary state.
- Reverse scroll reconstructs the same composition. No forward-only timelines.
- Fast scroll uses swept visibility and precomputed scene state so the camera cannot expose unloaded voids.
- Chapter jumps may use a brief occlusion or pressure wash, but land at the exact authored state.

### 6.3 Color and light arc

- Surface: mineral white, clear water, ice blue, crisp navy ink, spectral highlights.
- Early descent: cerulean shoulders, soft cyan volume, bright directional rays.
- Projects: saturated ocean blue with project-specific light behavior, not unrelated project palettes.
- Thermocline/About: deeper cobalt, softer rays, localized warm skin and portrait light.
- Contact: navy-to-near-black water, faint blue floor caustics, one clean electric-blue action signal.

Blue is treated as light under pressure, not a generic CSS accent. Visible broad background gradients are avoided. Tonal change comes from the 3D environment, fog, transmission, surface normals, and physical lighting.

### 6.4 Particles and marine life

Particles exist only to communicate volume, current, scale, and focus. They are sparse near the surface, visible in project light shafts, and slower/deeper near Contact. Use instanced or GPU-simulated particles with strict caps.

Do not add generic schools of fish, coral stock assets, bubbles everywhere, or decorative jellyfish. If a living form appears, it must have narrative and motion value and pass the same asset/performance bar as core geometry.

### 6.5 Semantic layer

- DOM owns headings, project facts, CTAs, navigation, About copy, contact information, focus order, and announcements.
- WebGL owns environment, depth, optical integration, physical objects, and decorative responses.
- DOM text may appear embedded through masking, depth-aware dimming, shared transforms, and calm physical backplanes.
- Core text is never rendered only into a texture.
- Content is visible in the initial semantic document. Animation enhances it; renderer readiness never controls focusability or accessibility.

## 7. Navigation, scroll, and direct manipulation

### 7.1 Navigation

The navigation remains visually close to the original site's restraint:

- portrait/name at left;
- Projects and About as central anchors on desktop;
- sound and Contact at right;
- a compact mobile menu with 44 px minimum targets;
- a quiet, linear depth/journey indicator that never resembles a game HUD;
- current chapter communicated by text and one restrained physical/light state, not six permanent mission labels.

Below the surface, the nav may gain subtle refraction, pressure compression, and contrast changes. Its geometry and location remain stable. The user must never chase navigation that drifts with the scene.

### 7.2 Scroll ownership

One `ScrollDirector` owns:

- the sole window scroll listener;
- the sole window resize listener for journey geometry;
- coalesced reads inside one animation-frame sample;
- root-relative progress;
- active chapter and local progress;
- direction and filtered velocity;
- anchor/hash seeking;
- browser restoration coordination;
- optional local input-shaping policy.

No component, shader adapter, navigation component, or section hook calculates a competing world position.

### 7.3 Advanced scroll control policy

Wheel or touch shaping is not banned. It is allowed only in a named, short “viscous zone” when all conditions pass:

- the scene gain is visible and meaningful;
- reversal responds on the next input frame;
- Escape, keyboard navigation, anchors, scrollbar dragging, and touch remain available;
- the user is never forced to wait for a timeline;
- input capture has a strict time/distance bound and visible progress;
- trackpad momentum does not overshoot into an unloaded scene;
- history restoration and deep links remain exact;
- reduced motion bypasses the shaping;
- automated rapid-direction tests pass.

Default implementation should first attempt native scroll plus pinning and progress mapping. Add shaping only after a browser prototype proves the need.

### 7.4 Pointer and click as a physical probe

Pointer movement is ray-mapped into the current depth layer. It creates a bounded wake, caustic displacement, and local pressure field. The response changes with depth: quick and sharp near the surface, heavier and slower below.

Left-button behavior:

- pointer down creates a local dimple/compression field;
- hold increases pressure with a hard cap and critically damped visual feedback;
- drag pulls a current and applies torque to eligible loose objects;
- release emits a pressure ring and restrained microbubbles/droplets where physically appropriate;
- clicking a glyph acts on that glyph's surface and neighboring fluid;
- clicking empty water acts on the water volume;
- clicking a link remains a normal link and receives only supporting feedback.

Right-click, modified clicks, text selection, browser gestures, and native link behavior remain untouched. Pointer cancellation, leaving the canvas, losing capture, multi-touch, and hidden-tab transitions must release all held state.

### 7.5 Touch and device motion

- Tap creates a short pressure pulse.
- Short drag creates a current; page scroll always wins after the movement threshold.
- No fake hover.
- Device parallax is opt-in and low amplitude.
- Orientation permission is requested only from a direct gesture.
- Motion is suspended when the page is hidden.

## 8. Hero: the living optical name

### 8.1 Objective

The hero is the highest-polish object on the site. At rest it must immediately read `EZZY RAPPEPORT`, resemble the bright reference, and reward close inspection. It is not a single extruded font with a glass material. It is a family of 13 individually authored submerged sculptures.

### 8.2 Desktop composition

- Camera sits just below a clearly visible moving water surface.
- The two-line name dominates the center without colliding with navigation or support copy.
- Supporting role copy sits low-left on a calm optical region.
- Location sits low-right.
- `Explore work`/descent action remains visible on first paint.
- The water surface, background, letters, and copy share lighting cues so no layer feels pasted on.
- The initial frame is excellent before any pointer movement.

### 8.3 Letter asset contract

Each glyph has:

- a stable identity matching the current 13-entry manifest;
- watertight, counter-safe geometry;
- centered local pivot and authored center of mass;
- stroke-aware bevel width, face curvature, sidewall depth, and back curvature;
- local thickness data or a thickness-rendering path;
- collision proxy separate from render geometry;
- per-letter density, mass, inertia, buoyancy, drag, angular drag, flex limit, and maximum travel;
- a deterministic rest transform for exact reverse-scroll reconstruction;
- optional internal bubbles/impurities with an authored seed;
- optical variation parameters constrained to one material family.

Repeated letters may share mesh data, but their physical and optical instances remain independent. Geometry generation remains deterministic through checked-in Blender scripts and manifest validation.

### 8.4 Optical model

The letter material must behave as a submerged medium, not air-glass chrome.

- Use the correct relationship between water IOR and glyph IOR. The outside medium is approximately 1.333, so bending at the water/glyph boundary is subtler than air/glass.
- Use a front/back or thickness pass to estimate path length.
- Apply Beer-Lambert absorption from path length, with one coherent pale-blue material family and bounded per-glyph variation.
- Refraction samples the live environment with depth-aware offsets and guarded screen edges.
- Fresnel and total internal reflection are based on the two participating media, not an air default.
- High tier may use three-wavelength dispersion at edges; balanced uses a cheaper approximation; low tier omits dispersion while preserving silhouette and thickness.
- Caustics derive from the water surface normal/curvature field and scene light, not arbitrary animated noise.
- Fine internal imperfection uses sparse authored bubbles and subtle density noise. Never make the letters milky or scratched.
- Tone mapping preserves white-water sparkle and dark blue edge separation without flattening the bodies.

Technical proof-of-concept gate: compare the current material with two implementations of the same approved look—screen-space transmission and environment-assisted transmission—using identical camera/light states. Select by edge stability, readability, GPU time, and behavior at viewport boundaries, not taste drift.

### 8.5 Physical model

The existing 1/120 s fixed-step glyph physics is the starting point.

Forces include:

- buoyancy from displaced volume and local surface state;
- linear and angular drag that increase slightly with depth;
- low-amplitude ambient current;
- pointer pressure and drag force;
- scroll-induced current during the departure phase;
- bounded pairwise collision/separation;
- critically damped return toward the authored rest state when the hero recomposes.

Letters remain structurally solid. Any bend is a tiny, short-lived optical/mesh response under local pressure, not jelly deformation. A cage, morph target, or vertex shader may provide sub-percent elastic deflection while rigid-body motion remains the main response.

### 8.6 Hero interaction states

- Rest: slow independent buoyancy, clear word silhouette.
- Pointer approach: local caustic focus and pressure onset before contact.
- Hover: nearest glyph gains a subtle depth shift/torque; neighbors respond after a propagation delay.
- Press: the chosen glyph compresses fluid, translates and rotates within bounds, and bends background light.
- Hold: pressure rises to a cap; no runaway oscillation.
- Release: ring propagation, neighboring response, and critically damped recovery.
- Drag: chosen glyph and fluid respond together; pointer cannot fling a letter out of composition.
- Rapid repeated clicks: impulse budget limits energy and prevents simulation explosion.
- Idle: activity decays to the exact designed frame without looking frozen.

### 8.7 Hero scroll choreography

Local hero progress is divided into four continuous phases:

1. **Arrival, 0.00–0.18.** Surface and letters settle from the loading poster into the live scene. Copy is already usable. No content gate.
2. **Living name, 0.18–0.52.** Camera remains composed for exploration. Scroll adds slight water tension, not immediate departure.
3. **Release, 0.52–0.82.** Camera begins descending. Letters lag through inertia, rotate independently, collide lightly, and become increasingly refracted by the moving surface above.
4. **Pass-under, 0.82–1.00.** Camera travels beneath/between the rising letters. The name fragments optically through the waterline but never shatters. Focused caustic energy stretches downward and becomes the light path into MonkeyClaw.

Reverse scroll performs the exact inverse: camera returns, current decays, letters re-enter frame, and a damped rest solver resolves them to the manifest transforms without popping.

### 8.8 Hero mobile composition

- Three-line wrapping is allowed only if it remains typographically intentional; otherwise use a tighter two-line camera framing.
- The name occupies the upper/middle field, with copy below it—not text over the busiest water.
- Camera moves are shorter and mostly vertical.
- Touch pulses are smaller and lower frequency.
- The visible surface remains clear so mobile retains the bright “impossible glass under water” impact.
- GPU cost is reduced through DPR, refraction taps, simulation resolution, and internal particles—not by replacing the hero with generic text.

### 8.9 Hero acceptance gates

- Name legible within one second on desktop and mobile.
- All 13 glyphs independently respond and return.
- No first-paint focus/inert delay tied to WebGL readiness.
- Reverse scroll restores the approved hero keyframe within tolerance.
- No visible screen-edge refraction smear.
- No glyph tunnels through a neighbor under the maximum legal impulse.
- Pointer cancellation leaves no held glyph.
- M1/iPhone performance budgets pass for rest, hover, click storm, and departure.
- Reduced-motion and renderer-failure versions remain premium and complete.

## 9. Hero-to-project descent

The transition must feel caused by the hero, not like a section fade.

- The rising letters focus and stretch caustic light into a descending beam.
- Camera follows that light through a thermocline where surface highlights soften and particulate depth becomes visible.
- The role copy and hero annotations leave through spatial occlusion and restrained DOM motion; they do not fly randomly.
- A distant reactive lattice/current field hints at MonkeyClaw before its title appears.
- Scene asset loading begins before the transition threshold and is abortable if the user reverses.
- If MonkeyClaw assets are late, the ocean and caustic path remain a complete scene; no spinner or empty void appears.

## 10. Project encounter system

### 10.1 Shared rules

Each anchor project gets a distinct ocean phenomenon, spatial composition, motion language, and evidence interaction. They still inhabit the same water and use the same typography, navigation, light physics, and input grammar.

Each encounter contains:

- project title and one-line value;
- role/status and two or three proof points from `content.ts`;
- one clear case-study action;
- a visual object that communicates the actual system, not just a logo;
- a reversible entrance, focus state, and exit;
- one signature pointer interaction;
- a fast-scroll state that remains coherent;
- a mobile composition designed independently.

The full case study remains a calm editorial route. Entry uses one short transition from the encounter's primary visual object into the case-study hero, then stops the homepage scene runtime.

### 10.2 MonkeyClaw: adversarial current field

**Story.** Continuous red, blue, and purple-team security testing around a live agent runtime.

**World.** A suspended, translucent agent-core structure sits in a darkening blue current. Eighteen faint attack vectors approach from the surrounding water. Some are deflected, some reach a judge layer, and verified detections return as visible telemetry paths. The scene communicates attack → judge → reproduce → patch → detection, not a generic hacker interface.

**Composition.** The core and flow occupy roughly 58–62% of desktop width. DOM copy sits on a calm open-water region or a minimal mineral plane at the opposing side. Avoid portholes, vault doors, pipes, and amber machinery.

**Motion.** Scroll advances one continuous loop through red pressure, judge convergence, blue response, and purple telemetry. Flow direction reverses correctly on upward scroll. Secondary pulses continue at low amplitude when the camera holds.

**Pointer signature.** The probe can introduce a bounded adversarial pulse. The system visibly routes, blocks, and records it. This is playful proof, never a required interaction and never fake terminal text.

**Evidence.** Use the real facts: 18 seeded attack zones, 8 verifier gates, and 1,051 tracked test functions. Claims come from `content.ts`.

**Audio.** Slightly tense high-frequency sonar ticks and a restrained detection return over the shared bed.

**Exit.** Verified telemetry lines align into clean rails/paths that become Etch's typed verification geometry.

### 10.3 Etch: pressure-forged verification path

**Story.** Natural-language hardware intent becomes typed design, candidates, verification gates, synthesis evidence, and a proof dossier.

**World.** A sequence of precise submerged forms assembles along one axis. Intent begins as an unstable pressure volume. Typed constraints crystallize its boundary. Candidate structures form, pass through simulation/formal light planes, and leave only the evidence-backed result.

**Composition.** Use engineered geometry without turning the whole world into an industrial submarine. Think precision optical metrology in water: clean frames, projected constraint planes, and crystalline silicon-like structures with ocean light moving through them.

**Motion.** Scroll scrubs the verification ladder. Failed or unavailable gates remain visibly distinct; no false completion. The camera moves laterally and slightly downward to inspect each state.

**Pointer signature.** The probe perturbs a candidate. Constraint planes reveal where it violates bounds, then the object returns. This demonstrates verification rather than merely adding ripples.

**Evidence.** Saved FIFO run, simulation pass, bounded-formal pass, Yosys metrics, and physical signoff pending.

**Audio.** Clean mechanical/tonal confirmations filtered through water; no sci-fi alarm bed.

**Exit.** Rigid proof geometry relaxes into softer linked paths and calendar-like currents leading to FlowE.

### 10.4 FlowE: luminous planning current

**Story.** A calm operating system connecting tasks, Canvas, calendars, focus, and daily planning.

**World.** The water opens into a brighter, calmer mid-depth clearing. Loose obligations arrive as drifting luminous fragments. A course-aware current groups them into a structured plan, then narrows into one focused stream. Real app imagery may appear on a thin optical plane only when it remains readable and grounded in the world.

**Composition.** More breathing room than MonkeyClaw or Etch. Use softer ray fields, greater negative space, and controlled bioluminescence. Keep the app's calm identity without introducing unrelated gradients or phone mockups floating in emptiness.

**Motion.** Scroll moves from brain dump to structured plan to focus loop. Secondary particles settle as organization increases.

**Pointer signature.** The probe can nudge an unplanned fragment into the current; the system absorbs and rebalances it. No drag-and-drop requirement.

**Evidence.** SwiftUI client, Convex backend, Canvas sync, offline retry, widgets/Live Activities where accurate.

**Audio.** Open, soft, low-density tones. This is the first decompression before the short Argyph beat.

**Exit.** Organized paths contract into a local index/search field.

### 10.5 Argyph: short local sonar index

**Story.** A local-first, read-only code intelligence server that combines text, symbols, semantic search, and bounded repository packing.

**Duration.** Deliberately the shortest anchor encounter: approximately half the scroll/time budget of the other project scenes.

**World.** A bathymetric sonar pass reveals a dense local “code reef” in tiers. Tier 0 appears immediately, symbols resolve next, and semantic relationships emerge last. A query pulse returns bounded spans and coverage, then collapses into the Charted Work map.

**Composition.** One decisive scan, not a chamber. Maintain ocean credibility through light attenuation and sonar propagation. Avoid terminal cosplay, neon code rain, or a generic node graph.

**Pointer signature.** Click sends one local sonar query pulse and briefly reveals the returned bounded region. It does not simulate a fake chat response.

**Evidence.** 19 read-only tools, tiered local index, and npm/crates.io/Homebrew distribution.

**Exit.** The resolved bathymetric map widens to reveal the complete project catalog.

## 11. Charted Work: all projects remain reachable

Charted Work is a compact spatial index after the four anchor encounters. It preserves direct access to Velox, NexaRad, MathPilot, and all anchors without adding three more long chapters.

### Desktop

- A wide bathymetric chart or current map occupies the stage.
- Seven project names sit at clear, readable coordinates tied to depth markers or formations.
- Hover/focus reveals a concise DOM summary, status, and case-study link.
- Keyboard focus follows the same ordered project list as `content.ts`.
- The map is not a card grid and not a game map with invented lore.

### Mobile

- Use one vertical, readable charted list with a synchronized shallow 3D map above or beside the active item.
- Natural scrolling; no horizontal carousel trap.
- Every case study is reachable in one tap.

### Acceptance

- All seven projects appear by name.
- Project order and facts come from `content.ts`.
- Modified clicks and open-in-new-tab behavior work.
- Focus and hover show equivalent information.
- Chart remains useful if WebGL fails.

## 12. About: the quiet thermocline

### Objective

Move from systems spectacle to the human author. This is a reading and trust scene, not another technical demonstration.

### Desktop composition

- Camera enters a slow, quiet thermocline where current and particles settle.
- Portrait occupies a clear third of the frame and is never crossed by rods, particles, masks, or copy.
- Copy remains close to the current `main` content: point of view, focus, location, and operating principles.
- The portrait may sit behind a very thin water/optical boundary that reacts subtly to pointer pressure.
- One distant view back toward the brighter project waters supplies continuity.

### Motion and interaction

- Scroll movement is slow and shallow.
- Pointer shifts depth planes by only a few pixels and changes water focus, not the copy layout.
- The portrait never distorts the face beyond a restrained edge refraction.
- Principles reveal through light/occlusion or reading order, not repeated card entrances.

### Mobile

- Portrait first, then copy, then principles.
- No text overlays the face.
- The scene may use a composed vertical cut instead of continuous camera travel.

### Audio

Reduce the bed, high-frequency detail, and transient events. Keep a soft water body tone and distant surface memory.

## 13. Contact and footer: abyssal basin

### Objective

End with clarity and stillness. The primary action is direct email. The scene should feel inevitable, not like a footer pasted under a 3D demo.

### Composition

- Camera settles near an abyssal floor with faint, slow caustic residue and large negative space.
- `Let's build something that matters.` remains the dominant copy direction unless later copy review improves it without changing intent.
- Email is a single clear semantic control using current `content.ts` data. Support copy, location, GitHub, LinkedIn, and resume remain available.
- Footer utility links sit on one stable baseline/formation and remain readable at all widths.
- A return-to-surface control reverses or jumps cleanly to the hero.

### Signature interaction

The email control behaves like a pressure-sensitive luminous seam in the basin. Hover/focus concentrates blue light. Press compresses the local water/floor response. Activation still performs normal copy/mailto behavior and gives an accessible confirmation.

### Restraint

- No large industrial transmitter.
- No amber sci-fi console.
- No extra “availability” claim unless it is intentionally maintained as current content.
- No high-energy particles or dramatic camera move after the primary action is visible.
- The existing abyss easter egg may remain only if it does not compete with contact conversion, trap focus, or add runtime cost before interaction.

### Footer completion state

At the bottom, animation approaches near-stillness. The shared runtime may reduce cadence while pointer and navigation remain responsive. The visitor should feel arrival, not a loop that demands more scrolling.

## 14. Sound design

Sound is muted by default and enabled only from a direct user gesture.

### Shared bed

- Procedural or compact authored underwater ambience.
- Depth drives low-pass filtering, subtle pressure tone, and gain.
- Avoid constant cinematic music and loud sub-bass.
- Chapter accents layer over the same bed rather than swapping tracks.

### Interaction sounds

- Surface clicks: light fluid taps and refracted transient.
- Glyph contact: restrained material resonance based on glyph mass.
- MonkeyClaw: detection returns.
- Etch: gate confirmations/failures.
- FlowE: soft organization/focus tones.
- Argyph: local sonar pulse.
- Contact: one clean action confirmation.

### Lifecycle

- Audio graph is lazy-created.
- Preference persists; sound and motion preferences remain independent.
- Context suspends while hidden and resumes only when previously unlocked.
- Route exit and runtime disposal disconnect all nodes and timers.
- Audio failure changes only the sound control state; it never affects scene timing.

## 15. Responsive and capability strategy

Responsive behavior is composition-based, not breakpoint-only scaling.

### Layout classes

- Wide desktop: full asymmetric camera and DOM composition.
- Compact desktop/tablet landscape: reduced camera lateral travel and simplified secondary geometry.
- Mobile portrait: vertical poster-like chapter compositions with shorter camera paths.
- Mobile landscape: explicit safe-area layout, not portrait rotated.

### Capability tiers

- **High:** full refraction samples, optional spectral edge dispersion, highest water resolution, denser particles, full chapter geometry.
- **Balanced:** fewer optical taps, moderate water/particle resolution, shared/baked lighting where possible.
- **Low live:** same compositions and core interactions, lower DPR, reduced secondary particles, simplified shadows/reflections, lower simulation cadence.
- **Non-realtime fallback:** premium authored still/short-transition compositions used only when WebGL2 is unavailable, context recovery fails repeatedly, or the user selects motion off. It is not a generic screenshot or degraded layout.
- **Reduced motion:** complete semantic story with restrained crossfades, short transforms, and no large camera/parallax movement.

WebGPU may add compute water/particles or optical capability on supported browsers only after it proves a measurable gain. WebGL2 remains visually complete.

## 16. Runtime architecture

### 16.1 Ownership graph

```text
ExperienceRoot
├── PreferenceStore        persistent discrete choices
├── ScrollDirector         sole scroll/resize/jump owner
├── ExperienceStore        imperative continuous snapshot; discrete subscriptions
├── ExperienceRuntime      load/start/seek/render/stop/dispose
│   ├── Renderer           one canvas and one scene graph
│   ├── WaterSystem        persistent shared simulation
│   ├── HeroScene          glyph optics and physics
│   ├── ProjectScenes      lazy anchor encounter modules
│   ├── AmbientScene       depth, particles, light, fog
│   └── QualityController  measured adaptive policy
├── AudioDirector          opt-in, depth-fed, independently disposable
└── SemanticStory          server-rendered DOM chapters and actions
```

### 16.2 Proposed source layout

The final home runtime should live under one feature boundary, for example:

```text
src/features/ocean-experience/
  contracts/
    chapter.ts
    preferences.ts
    quality.ts
    scene.ts
  runtime/
    ExperienceRuntime.ts
    frame-fault-policy.ts
  scroll/
    ScrollDirector.ts
    scroll-mapping.ts
    input-shaping-policy.ts
  state/
    experience-store.ts
    preferences-store.ts
  render/
    OceanRenderer.ts
    shared/
    hero/
    projects/
      monkeyclaw/
      etch/
      flowe/
      argyph/
    about/
    contact/
  physics/
    fixed-step.ts
    water/
    glyphs/
    impulses/
  audio/
  diagnostics/
  fallback/
```

This is a migration target, not permission to copy the current renderer. Existing `kinetic-canvas` modules move or are adapted as their ownership changes. During migration, `KineticCanvas` may be a thin adapter. It is removed after the new root owns the same runtime. At no point may two live renderers or water solvers exist on the homepage.

### 16.3 State policy

Primary continuous state:

```ts
type ExperienceFrame = {
  progress: number;
  chapter: ChapterId;
  chapterProgress: number;
  direction: -1 | 0 | 1;
  velocity: number;
  viewport: Viewport;
  pointer: PointerProbe;
  quality: ResolvedQuality;
};
```

- Continuous state lives in mutable runtime snapshots/typed arrays, not React state.
- React subscribes only to discrete changes: active chapter, scene status, preference changes, error/fallback state, and accessible announcements.
- Pure functions map progress to chapter/camera/visibility/light states.
- Renderer reads the latest snapshot once per frame.
- No layout reads inside render or simulation paths.

### 16.4 Frame-clock hardening

Before expanding the runtime, the shared frame clock must:

- schedule the next frame in `finally`;
- isolate each subscriber with `try/catch`;
- record failure by subscriber ID;
- disable only a repeatedly failing subscriber after a bounded policy;
- expose failures in development diagnostics;
- preserve visibility pause/resume;
- maintain exact acquire/release ownership for GSAP or any external ticker.

One subscriber failure must never freeze scroll, audio updates, WebGL, magnetic interactions, or navigation together.

### 16.5 Asset lifecycle

- Each chapter declares assets, estimated GPU memory, preload threshold, and disposer.
- Hero assets load first. Project assets load one encounter ahead and may be evicted one or two encounters behind on constrained devices.
- Fetch/decode is abortable on route exit or direction reversal.
- Shared geometry/materials use reference-counted ownership or an explicit resource registry.
- Disposal covers textures, render targets, geometries, materials, audio nodes, observers, timers, and event listeners.
- Context loss pauses simulation and exposes the semantic/non-realtime version immediately. Recovery is bounded; repeated failure stays in fallback.

## 17. Rendering and shader plan

### 17.1 Render passes

Use the smallest pass graph that produces the approved image. Candidate high-tier graph:

1. depth/normal prepass where needed;
2. thickness backface/frontface data for hero glyphs and selected optical objects;
3. opaque environment and project geometry;
4. shared water/volume pass;
5. transmitted hero/project optical materials;
6. restrained caustic/light accumulation;
7. final tone mapping and minimal post-processing.

Do not add bloom, depth of field, chromatic aberration, film grain, or motion blur by default. Each post effect must solve a visible problem, stay readable during scroll, and fit the GPU budget.

### 17.2 Water simulation

- Retain the proven ping-pong height/velocity foundation unless profiling shows a concrete limitation.
- Separate fixed simulation rate from display rate.
- Coalesce pointer, click, drag, and scroll inputs into bounded impulses.
- Use world/canvas coordinate adapters as pure functions.
- Lower tiers reduce resolution and update cadence while upsampling normals cleanly.
- Ocean-scale currents for later chapters may use analytical/curl fields layered over the hero surface solver; do not stretch the hero heightfield into a fake full-ocean simulation.

### 17.3 Lighting

- One directional “sun” and physically motivated environment/volume light form the base.
- Project scenes may add a small number of authored local lights.
- Prefer baked light detail, emissive masks, probes, and shared shadow atlases over many dynamic shadow-casting lights.
- Shadows exist only where they improve depth and grounding.
- DOM surfaces receive matching CSS variables for light direction, intensity, and depth tint at a reduced cadence.

### 17.4 Blender pipeline

- Checked-in deterministic `bpy` scripts generate or validate authored GLBs.
- Blender source files are retained only for assets selected by the approved visual direction.
- Export reports validate node names, material slots, bounds, pivots, triangle count, texture references, and transform identity.
- Use Meshopt/Draco only after comparing decode cost and browser support.
- Use KTX2/Basis textures where they materially reduce transfer/GPU memory.
- Do not ship generated observatory/station GLBs merely because they already exist.

## 18. Performance contract

### 18.1 Device targets

- Desktop baseline: M1 MacBook Air-class integrated GPU at 1440×900, current Safari and Chrome.
- Mobile baseline: iPhone 13-class Safari in portrait and landscape.
- Supported current browsers: Chrome, Safari, Firefox, and Edge.

### 18.2 Frame budgets

- Sustained target: 60 FPS.
- p95 display frame interval: ≤16.7 ms after warm-up in approved baseline scenes.
- Desktop GPU target: ≤9.5 ms p95 in normal travel, leaving CPU/compositor headroom.
- Main-thread experience work: ≤4 ms p95 per active frame.
- No normal-travel long task >50 ms.
- Scroll-to-visual response: next rendered frame under normal load.
- No per-frame garbage allocation in render, physics, mapping, or quality sampling hot paths.

### 18.3 Scene budgets

Initial budgets, refined by profiling:

- Hero draw calls: ≤70 high, ≤50 balanced/mobile.
- Project encounter draw calls: ≤90 high, ≤60 balanced, ≤45 low.
- Visible triangles: ≤350k desktop high, ≤220k balanced, ≤160k mobile low.
- Render-target memory: ≤64 MB desktop high, ≤40 MB balanced, ≤28 MB mobile low.
- Critical hero transfer should not materially exceed the current cold-load envelope without an explicit measured tradeoff.
- Later chapter payloads load lazily; each encounter has an asset-size budget before art production begins.
- Particle counts are tiered and instanced/GPU-driven.
- Dynamic shadow casters are tightly capped.

The budgets are enforcement tools, not permission to ship visibly bad low-tier art. If a composition cannot survive its budget, redesign the implementation before cutting its core identity.

### 18.4 Adaptive quality

Quality controller uses a preallocated frame-time ring buffer and hysteresis.

Downgrade order should preserve composition:

1. reduce DPR/render scale;
2. reduce refraction/dispersion samples;
3. reduce secondary particles;
4. reduce water/secondary simulation cadence;
5. simplify optional shadows/reflections;
6. swap distant geometry to cheaper LODs;
7. enter low-live mode only after sustained pressure.

Never remove project text, primary objects, navigation, or core pointer response as an automatic quality step.

Downgrades occur after sustained slow windows and a cooldown. Upgrades occur only after a longer stable period and preferably at chapter boundaries to prevent visible oscillation. User quality choice sets a ceiling/floor explicitly. A discreet control exposes Auto/High/Balanced/Low without turning the page into a settings panel.

### 18.5 Required stress traces

- 60-second hero idle.
- 30-second dense pointer movement.
- repeated click/hold/release storm.
- slow full journey.
- rapid wheel/trackpad descent.
- rapid direction reversals at every chapter boundary.
- scrollbar drag from top to bottom and back.
- background for 30 seconds then resume.
- resize and orientation changes during active physics.
- thermal soak on mobile.
- context loss and recovery.
- sound enabled and disabled.

## 19. Accessibility and browser semantics

- WCAG AA contrast for all important text in every scene state.
- Skip link reaches main content immediately.
- Navigation, project links, sound/quality controls, contact action, and return-to-surface work by keyboard.
- Visible focus treatment remains stable over changing water.
- All important content exists in semantic HTML and logical source order.
- Active-chapter announcements are restrained; do not spam screen readers on continuous progress.
- Modified clicks, middle-click, target, download, and already-prevented events remain native.
- Hash jumps align below navigation and work before/after fonts and assets load.
- History restoration returns to the correct chapter/camera state.
- Renderer loading, failure, and recovery never hide or inert CTAs.
- `prefers-reduced-motion` is resolved before interactive effects mount.
- Motion preference cannot override the OS reduced-motion ceiling.
- Touch action and pointer capture never block page zoom, browser navigation gestures, or normal scrolling.
- Text selection and copy remain available.

## 20. Edge-case policy

### Rendering

- WebGL2 unavailable: use premium non-realtime composition.
- Shader compile failure: fail one feature/pass where possible; otherwise fall back without blocking content.
- GLB missing/corrupt: keep semantic chapter and ocean environment; log exact asset failure in diagnostics.
- Context lost: pause, release transient state, show fallback, attempt bounded recovery.
- Tab hidden: stop render/simulation/audio; clear velocity spikes on resume.
- Resize during load: apply latest viewport after load, not stale dimensions.

### Scroll and navigation

- Load at a deep hash.
- Browser back/forward between case study and exact homepage chapter.
- Fonts or images reflow after initial scroll restoration.
- Extremely short/tall viewports.
- Scrollbar drag skipping unloaded chapters.
- Trackpad momentum crossing multiple boundaries.
- Reverse during an in-flight asset load.
- Route change during a pinned/viscous zone.

### Input and physics

- Pointer leaves window while held.
- `pointercancel`, lost capture, or visibility change during hold.
- Multi-touch while scrolling.
- Repeated maximum-energy impulses.
- Focus/activation on a link inside an interactive region.
- Device orientation permission denied/revoked.

### Content

- Long project status/proof text.
- Missing optional gallery media.
- New eighth project added to `content.ts`.
- Contact email or location changed.
- JavaScript disabled: complete readable portfolio and direct links remain.

## 21. Rejected-branch salvage matrix

No whole commit from `codex/cinematic-scrollytelling` should be cherry-picked. Extract the smallest validated units into the new ownership model.

### 21.1 Reuse after targeted review/refactor

| Branch surface | Decision | Required changes |
| --- | --- | --- |
| `scroll/scroll-mapping.ts` | Reuse pure math | Replace six invented chapters and fixed 1000/610vh policy; keep validation, root-relative mapping, inverse seek, and tests. |
| `scroll/ScrollDirector.ts` | Reuse design, selective code | Retarget to approved chapters; integrate with existing route/hash behavior; keep one listener, rAF coalescing, exact seek, and resize separation. |
| `scene/SceneDirector.ts` | Reuse contract | Add abortable loading/cancellation context, explicit failure reporting, and chapter asset lifecycle. |
| `scene/SceneRuntime.ts` | Reuse core | Add frame-subscriber fault policy, context-loss/fallback coordination, and exact load-generation cancellation. |
| `state/experience-store.ts` | Reuse | Replace chapter schema; retain continuous snapshot/discrete notification split. |
| `state/preferences-store.ts` | Reuse after audit | Preserve versioning, OS motion ceiling, independent sound, quality choice, and opt-in parallax; align names with existing portfolio preference migration. |
| `observatory-frame-stats.ts` | Reuse | Move to shared quality runtime; extend metrics to GPU timing where available. |
| `observatory-tier-policy.ts` | Reuse concept/code | Rename generically; add carefully gated chapter-boundary upgrade policy. |
| `diagnostics/experience-debug.ts` | Reuse | Retarget chapters; add frame stats, active assets, fallback reason, and context status. Keep dev-only exposure. |
| `navigation/chapter-hash-click.ts` | Reuse | Apply same plain-click guard to all custom project/chapter transitions. |
| `audio/depth-band.ts` | Reuse concept/code | Retune bands for the approved depth curve. |
| `audio/underwater-bed.ts` | Reuse after audio review | Keep lazy gesture unlock, lifecycle, and failure isolation; art-direct the sound and verify Safari behavior. |

### 21.2 Extract concept or test pattern only

| Branch surface | Keep | Reject |
| --- | --- | --- |
| `observatory-quality.ts` | Pixel-budgeted DPR, tier resolution, allocation-free sampling | Observatory-specific particle/ring/station knobs and fixed 14.5 ms assumptions without new traces. |
| `observatory-visibility.ts` | Pure progress-to-visibility tables and swept fast-scroll thinking | Observatory object names and chapter ranges. |
| `ReducedMotionStory.tsx` | Complete semantic alternate composition | Current six-chapter copy/layout. |
| `project-selection.ts` | Anchor/archive split and missing-anchor validation | Three-anchor list; new contract is MonkeyClaw/Etch/FlowE/full, Argyph/short. |
| `underwater-bed.ts` procedural graph | Gesture-safe lazy audio architecture | Treating coarse depth bands as finished sound design. |
| regression additions | Pure mapping, listener ownership, modified-click, runtime cleanup, quality hysteresis patterns | Thousands of source-literal assertions coupled to rejected components/CSS. |
| mobile expedition work | Separate mobile ranges/composition principle | The bottom-sheet/industrial poster implementation and fixed rail length. |
| generated asset reports | Deterministic validation/report schema | Assuming generated observatory/station assets belong in the final product. |

### 21.3 Discard from the new implementation

- `src/app/experience-lab/page.tsx` after extraction verification.
- `CinematicHome.tsx` and `CinematicHome.module.css` as the replacement shell.
- The Method and Observatory/Lab chapters and their copy.
- `UnderwaterObservatoryEngine.ts` as an engine architecture.
- Observatory-specific scene state, station state, structure policy, station policy, and shaders.
- The industrial titanium/amber/porthole/pressure-door visual system.
- Chapter HUD, mission labels, depth meters, and opaque story panels.
- Generated observatory, synthesis-engine, end-chamber, and project-station GLBs unless a future approved scene independently proves a specific mesh useful.
- Corresponding Blender scenes/scripts that only reproduce the rejected art direction.
- Rejected keyframes as implementation targets. They remain audit evidence only.
- Any project copy invented in generated keyframes rather than sourced from `content.ts`.
- The fixed 2–3 minute, ~1000vh journey.

### 21.4 Preserve before branch retirement

Before deletion, create an annotated salvage manifest containing:

- source commit/file;
- extracted destination;
- behavioral tests carried over;
- visual/art assets explicitly rejected;
- any uncommitted source worth archiving;
- verification that the new branch no longer imports `/experience-lab` code.

Tag the last rejected state or create an archival bundle only after confirming the exact dirty files. Do not commit rejected assets into `main` merely to preserve them. Delete local/remote branches only after the user reviews the salvage result.

## 22. Incremental implementation plan

### Milestone 0: clean foundation and measurement

**Goal:** make one safe runtime owner before changing the visible site.

- Create the new integration worktree/branch from `main`.
- Capture baseline desktop/mobile screenshots and frame traces for current `main`.
- Record transfer, draw calls, triangles, render-target memory, GPU/main-thread frame time, and current visual states.
- Harden frame-clock subscriber isolation.
- Introduce the approved typed chapter schema and pure scroll mappings.
- Consolidate scroll/world ownership behind one director without changing visuals.
- Add dev diagnostics and exact lifecycle tests.
- Define asset/resource registry and abortable load contract.

**Gate:** current homepage looks unchanged; all existing checks pass; only one scroll owner and one frame owner exist; baseline evidence is committed.

### Milestone 1: hero optics and per-letter authorship

**Goal:** make the first viewport world-class while everything below remains visually unchanged.

- Validate/regenerate 13 glyph assets with richer per-letter metadata.
- Build correct submerged thickness/refraction/absorption material.
- Add tiered optical path.
- Tune individual letter mass, inertia, buoyancy, drag, and optical variation.
- Improve background/surface lighting and caustic coherence.
- Implement pressure-probe hover, click, hold, release, and drag.
- Preserve current semantic hero, navigation, and below-fold sections.
- Produce desktop/mobile/rest/interaction/reduced/failure screenshots and traces.

**Gate:** hero acceptance criteria pass, M1/iPhone budgets pass, and the user approves the live hero before departure work begins.

### Milestone 2: hero release and descent seam

**Goal:** transform the existing letter fly-away into the approved buoyant pass-under transition.

- Add local hero progress phases.
- Create deterministic camera descent and letter release targets.
- Bind current/caustic energy into the first transition.
- Prove reverse reconstruction, rapid reversals, deep-link load, and late asset behavior.
- Keep Projects/About/Contact content otherwise unchanged.

**Gate:** no popping or trapped scroll; reverse returns to approved hero; fast scroll never exposes an empty frame.

### Milestone 3: MonkeyClaw vertical slice

**Goal:** prove the complete project encounter model once.

- Build MonkeyClaw scene, semantic story surface, signature interaction, audio hooks, mobile composition, non-realtime fallback, and case-study transition.
- Lazy-load the encounter and dispose it correctly.
- Validate facts from `content.ts`.
- Measure all scene budgets.

**Gate:** one finished encounter meets visual, semantic, input, performance, route, and failure criteria. Use it as the contract for remaining projects.

### Milestone 4: Etch and FlowE

- Implement Etch verification choreography and perturbation interaction.
- Implement FlowE calm planning-current choreography and organization interaction.
- Maintain distinct scenes without duplicating runtime systems.
- Tune transitions so each phenomenon causally becomes the next.

**Gate:** all three major encounters are visually distinct, reversible, readable, and within aggregate asset/runtime budgets.

### Milestone 5: Argyph and Charted Work

- Implement the short sonar/index beat.
- Build the seven-project semantic/spatial catalog.
- Verify all direct links and modified clicks.
- Confirm Argyph is noticeably shorter than the other anchors.

**Gate:** every project is discoverable in desktop, mobile, keyboard, reduced-motion, and renderer-failure states.

### Milestone 6: About thermocline

- Recompose current About content into the quiet scene.
- Preserve portrait fidelity and semantic reading order.
- Add restrained depth response and matching mobile composition.

**Gate:** About is easier to read than project scenes, portrait remains unobstructed, and frame cost drops rather than rises.

### Milestone 7: Contact/footer basin

- Build abyssal arrival, email seam interaction, social/resume links, and return-to-surface behavior.
- Review/remove or isolate the abyss easter egg if it competes with conversion or accessibility.
- Reduce idle cadence at journey end.

**Gate:** direct email/contact works with keyboard, touch, pointer, JavaScript failure, and renderer failure; footer is fully usable at every supported width.

### Milestone 8: sound, hardening, and final look development

- Finish opt-in sound design after visual frame budgets are stable.
- Run full responsive, accessibility, browser, thermal, context-loss, route, restoration, and fast-input matrices.
- Compare every chapter against approved keyframes captured from the live implementation.
- Remove dead old/rejected systems and assets only after import/resource proof.
- Perform final asset compression and bundle review.
- Conduct independent code and visual review.

**Gate:** complete acceptance matrix passes or each external blocker is named. Only then is the integration branch eligible for user-approved merge into `main`.

## 23. Verification matrix

### Static and unit checks

- TypeScript strict typecheck.
- ESLint with no new warnings.
- `git diff --check`.
- Pure chapter mapping and inverse seek tests.
- camera spline and visibility boundary tests.
- fixed-step catch-up and energy-bound tests.
- pointer impulse, cancellation, and propagation tests.
- quality hysteresis/downgrade/upgrade tests.
- preference migration and OS reduced-motion ceiling tests.
- resource acquire/release and failed-load tests.
- modified-click and hash-navigation tests.
- frame-clock failure-isolation tests.

### Browser behavioral checks

- Current Chrome, Safari, Firefox, and Edge.
- M1 baseline desktop and iPhone 13 baseline mobile.
- desktop widths: 1280×720, 1440×900, 1728×1117.
- tablet: 1024×768 and portrait equivalent.
- mobile: 390×844 plus short and landscape viewports.
- keyboard-only full journey.
- VoiceOver semantic/focus smoke test.
- reduced motion, motion off, sound on/off, quality tiers.
- missing hero/project GLB.
- forced shader failure and context loss.
- slow network, cold cache, asset abort/reverse.
- route to/from every anchor case study.
- back/forward restoration and deep hashes.
- resize/orientation while interacting.
- hidden/resume and long idle.

### Visual evidence per milestone

- equal-crop before/after comparison;
- desktop, tablet, mobile keyframes;
- close-ups of representative glyph edges/counters and each project's signature object;
- rest, hover, press, hold, release, drag, and settled sequences;
- hero departure and reverse reconstruction sequence;
- fast-scroll frames at every boundary;
- reduced-motion and non-realtime versions;
- text contrast/occlusion overlays;
- frame-time and resource capture associated with the exact commit.

Source-only review or generated concept art is never sufficient visual proof.

## 24. Definition of done

The homepage transformation is complete only when:

- the approved ocean journey exists on the main `/` route of the integration branch;
- no `/experience-lab` route or rejected observatory runtime is required;
- hero, four anchors, Charted Work, About, Contact, and footer meet their acceptance criteria;
- all important content and navigation work without WebGL;
- primary scroll/camera state is exact and reversible;
- one scroll owner, frame owner, renderer, water system, preference store, and quality controller remain;
- no per-frame React updates or hot-path allocations are found in traces;
- M1 MacBook Air and iPhone 13-class performance targets pass with the correct adaptive tier;
- full browser, input, lifecycle, accessibility, and route matrices pass;
- rendered evidence is reviewed, not merely generated;
- the branch contains no unused rejected assets or parallel implementation debris;
- the user approves the final live experience and explicitly authorizes any merge/push.

## 25. Immediate next action after this plan

Do not begin by rebuilding the whole homepage. Begin Milestone 0 on `codex/cinematic-home-v2`, then deliver Milestone 1 as a hero-only vertical slice while Projects, About, Contact, and footer remain visually unchanged. The first approval target is the living name and its optical/physical interaction—not another alternate full-site branch.
