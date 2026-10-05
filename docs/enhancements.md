# Progressive graphics enhancements

Status: proposed roadmap, not implemented by this document.

The aim is to improve the browser port in useful, incremental steps while continuing to load the user's original game files. The existing 320×200 indexed renderer, original palette effects, sky, horizon, floor and sprite drawing provide the reference appearance. See [the port notes](port.md) for reconstruction work and [the evidence discipline](evidence.md) for claims about the DOS game.

The ideas below are creative additions. Their artistic settings are design choices, not evidence about how the original game worked.

## Presets and shared foundations

Offer three eventual presets, with individual effects adjustable:

- **Original:** the existing faithful rendering path, including its original timing and palette behavior.
- **Enhanced:** original artwork with smoother presentation, shadows, particles and atmosphere.
- **Remastered:** optional replacement artwork and a more ambitious renderer, as those become available.

Keep simulation, collision, race progress and asset decoding shared. Rendering should consume state without modifying it. Store graphics preferences separately from original game files and track data. Original assets remain in ignored `game/` during development or are supplied by the visitor on the hosted site.

Enhancement configuration needs an explicit home and documented distinction from reconstructed constants before implementation. Do not invent evidence claims for shadow opacity, fog color or particle tuning, or bypass the existing constants rules with misleading annotations.

## Stage 1: presentation

### Pixel-perfect scaling and display options

Offer integer nearest-neighbor scaling for crisp pixels, alongside a fit-to-window option. Provide clearly labeled aspect-ratio choices and fullscreen controls. Show the selected behavior in a small preview so users can choose between sharp edges and filling the display.

A later independent HUD layer could improve text readability on high-density screens while keeping the world pixelated. It must preserve original HUD placement in Original mode and remain usable in split screen.

### Smooth camera and object movement

Retain the simulation's update cadence and interpolate presentation between completed states. Smooth camera position and other racers together to avoid a fluid background with visibly stepping opponents. Interpolate heading through the shortest angular path.

Keep gameplay decisions and discrete sprite animation events on simulation ticks. Reset interpolation at teleports, respawns, scene changes and other discontinuities. Measure the presentation delay introduced by interpolation before deciding whether it should be enabled by default.

### Optional CRT appearance

Add adjustable scanlines, subtle glow and optional curvature as a final display effect. Keep the effect restrained enough that road edges and small HUD text remain readable. Offer a clean image with a single toggle; CRT styling is a preference, not a prerequisite for other enhancements.

## Stage 2: depth and driving feedback

### Contact shadows

Start with small, soft ground shadows below racers and selected scenery. Their projected size should follow distance, and their position should follow the object's ground anchor rather than the sprite rectangle. This helps sprites feel attached to the track.

Draw shadows with correct scene ordering so they do not paint over foreground objects or the HUD. Inspect existing art first to avoid doubling any baked-in shadows. Directional, sun-cast shadows can come later.

### Surface-specific particles

Use short-lived dust, sand spray, splashes, smoke and impact sparks to make movement easier to read. Select effects from established surface classifications and actual driving events. Unknown surface meanings should remain unassigned until understood.

Emit particles in world space, give them a bounded lifetime and cap their total count. Use a separate visual random source so enabling particles cannot change gameplay randomness. Reuse original art where appropriate or generate simple shapes at runtime.

### Distance fog

Blend distant ground and objects toward a track-specific atmospheric color. Apply compatible fading to both so sprites do not appear pasted onto the horizon. Preserve nearby road contrast, obstacles and pickups.

This needs depth information: a uniform translucent screen overlay is not distance fog. The enhanced renderer can carry a depth or distance layer alongside the image, with a later GPU version using the same concept.

### Skid marks and tire trails

Place temporary world-space marks behind tires during verified sliding or braking conditions. Vary their appearance by surface and fade them gradually. Use a bounded ring buffer or track overlay so long races do not accumulate unlimited geometry or memory.

Marks should survive camera movement and disappear cleanly when a race restarts. They are decorative and do not change grip.

## Stage 3: richer environments

### Layered skies and horizons

Build on the existing sky and horizon with drifting clouds and several scenery layers moving at different apparent distances. Keep the original horizon recognizable and avoid seams during a full turn. Optional enhancement metadata could select cloud speed, tint and layer depth for each track.

### Animated scenery and water

Add restrained movement to flags, foliage and trackside props. Extend the existing palette cycling with optional water ripples or highlights. Reflections are a later feature because they need masks, scene information and careful performance budgeting.

Animation should add life without obscuring racers or making static collision boundaries look as if they move.

### Track-specific lighting

Introduce warm sunsets, cool night scenes or overcast moods through controlled color grading and sky choices. Protect HUD colors and important gameplay cues. Stronger lighting could use separately authored normal or height maps for tiles and sprites; these would be enhancement assets, not fields inferred from the original formats.

## Stage 4: sharper rendering and artwork

### Higher internal resolution

Render new world samples at resolutions such as 640×400 while retaining the original textures. This can sharpen road geometry and object placement even before artwork is replaced. Increasing only the output canvas size enlarges the existing pixels and does not add scene detail.

The current floor renderer is tied to original dimensions and lookup tables. A higher-resolution path needs a generalized projection model, sprite scaling and compatible depth calculations, with the original path retained for comparison.

### Proper widescreen

Expand the horizontal view instead of stretching the image. Update projection, visibility checks, horizon coverage and HUD anchoring together. Test track edges and scenery that were previously outside the original view. A wider view also changes how much a player can see, so treat it as an explicit option when comparing play experiences.

### Replacement artwork packs

Allow optional higher-resolution tiles, horizons and sprite sheets, falling back to the original archive for missing entries. Define a pack manifest with asset names, frame order, dimensions, ground anchors and transparent regions. Logical sprite size and collision behavior should remain independent of artwork resolution.

The viewer's sprite-sheet export is a useful starting point. Import, validation and side-by-side previews would make it practical to author coherent packs. Packs must contain only artwork the creator can distribute; original extracted assets remain local.

### More kart viewing angles

Add intermediate directional frames to reduce visible jumps when racers turn. Hand-drawn frames or renders of a consistent 3D model could supply them. Stable scale, lighting, ground contact and character proportions matter across the entire sheet. This requires an enhancement-specific direction mapping while preserving the original animation and gameplay state.

## Stage 5: larger rendering changes

### GPU-based enhanced renderer

An optional WebGL renderer could share the existing asset loaders and simulation while handling textured ground, billboards, fog and lighting. Preserve indexed texture and palette semantics where needed so palette animation continues to work. Keep a usable fallback and benchmark on modest devices before expanding effects.

Vanilla JavaScript and Vite remain suitable; adopting a GPU renderer does not require changing the application's framework. [The WebGL tutorial](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial) is a useful implementation reference.

### Hybrid 2D and 3D scenery

Combine original sprite racers with dimensional barriers, trees, kerbs and trackside structures. Begin with decorative geometry outside the driving surface. Real hills, bridges or jumps require additional geometry data and explicit collision and gameplay decisions; they exceed a cosmetic rendering upgrade.

### Stylized 3D remaster

Eventually replace racers and scenery with models while using original layouts and race behavior as the foundation. Establish an art direction with one racer and one representative track before producing a full asset set. This is a substantial independent art and rendering effort, suitable after the Enhanced preset has demonstrated value.

## First milestone: original art with smoother motion and depth

**Goal:** deliver an optional Enhanced preset combining smooth presentation, contact shadows, light surface particles and gentle distance fog. Keep original artwork and the current world resolution for this milestone. Replacement art, widescreen, CRT effects, skid marks and 3D geometry can follow separately.

### Delivery order

1. **Create the presentation boundary.** Define a read-only render snapshot and separate enhancement settings. Add Original/Enhanced selection, individual effect toggles and reset-to-defaults. Preserve a direct path to the existing reference renderer. Agree how artistic constants fit the documented project rules.
2. **Prototype interpolation.** Smooth the camera and racers consistently. Check turns, pauses, countdowns, crashes and respawns, including angular wraparound. If the lookup-table projection limits smoothness, assess a small enhanced projection adapter before widening scope to higher resolution.
3. **Add contact shadows.** Start with racers, validate ground anchors and occlusion, and tune subtle size and opacity. Add scenery shadows only after the racer case works reliably.
4. **Add a small particle set.** Begin with dust and one contrasting effect such as water spray where the surface mapping is established. Base emission on distance or simulation time so higher display refresh rates do not create extra particles. Clear effects on restart and limit their count.
5. **Add distance fog.** Produce consistent distance information for the floor and objects, blend after palette lookup where appropriate, and exclude the HUD. Start with a neutral atmospheric tint and modest strength.
6. **Tune and compare.** Use the same camera path or replay for Original/Enhanced comparisons. Profile each effect separately, then test the combined preset before selecting defaults.

### Completion criteria

- Switching graphics settings leaves positions, collisions, laps, scores and simulation randomness unchanged for the same recorded inputs.
- Original mode retains the existing reference image behavior and passes the applicable evidence checks.
- Smooth motion has no jumps across angle wraparound, and discontinuities do not produce interpolated travel through the track.
- Shadows stay attached to the ground; particles and fog respect scenery ordering and keep the HUD clear.
- Pausing, restarting, loading another track and changing modes leave no stale particles or snapshots. Split-screen views maintain independent camera projection.
- Effects have bounded memory use. Record frame time with effects off and on on a named reference device; target stable 60 Hz presentation where the baseline supports it and offer lower effect settings when needed.
- The production build still works under a GitHub Pages subpath, using the visitor's supplied archive without bundling original assets.

### Tools that make later milestones easier

Add an enhancement preview to the viewer and track editor after the first gameplay integration: a fixed camera, effect toggles, intensity controls and an Original/Enhanced comparison. The viewer can preview sprite anchors and replacement sheets; the editor can preview track atmosphere. Store enhancement metadata in a separate project section or sidecar with sensible defaults so existing tracks remain usable.

For efficient Canvas work, cache reusable visuals and separate layers with different update needs where profiling supports it; see [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
