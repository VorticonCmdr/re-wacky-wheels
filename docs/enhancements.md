# Progressive graphics enhancements

Status: built in the playtest page:
- the first milestone (the Enhanced preset: smooth motion, contact shadows, surface particles and distance fog over the original art), see [the first milestone as built](#the-first-milestone-as-built);
- skid marks and sun shadows from Stage 2, and the enhancement previews of the asset garage (the viewer), see [skid marks, sun shadows and the viewer's previews](#skid-marks-sun-shadows-and-the-viewers-previews).

Everything else in this document is a proposal.

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

### The first milestone as built

Built 2026-10-05 in `src/enhance/` and the Graphics panel of `play.html`. Original is the default preset and draws the race exactly as before; Enhanced is opt-in.

**Using it.** In the game's own menus: GAME OPTIONS has the item ENHANCED GRAPHICS (only in the page's menus, like KEYBOARD CONTROLS and SOUND DEVICES; the game's records of its four-item menu are untouched). It opens:
- PRESET, which Enter switches between ORIGINAL and ENHANCED (from CUSTOM, a mix of switches, back to ORIGINAL);
- EFFECTS, the list of the seven effects with ON or OFF, which Enter flips;
- EFFECT LEVELS: the strengths of the shadows, the fog and the particles (Enter goes up a quarter, from 100 to OFF), the side the sun shines from (Enter goes round in eighths; north is the top of the track map) and DEFAULT LEVELS;
- LEAVE THIS MENU.

The same settings are in the panel beside the race screen: the preset (Original, Enhanced, or Custom once a switch differs), a switch for each effect, sliders for the strengths and the sun, and *Reset graphics*. The menu and the panel always show the same settings. The choice is kept in this browser under `wackywheels.graphics`, apart from the game files, the track data and the game's own settings (keys, sounds, saves). A panel control gives up the keyboard focus after a change, so Space and the arrows keep driving. The menus are in `src/game/graphics-menu.js` (the lines and what Enter chooses) and `src/enhance/settings.js` (`menuView`, the words they show, and what each choice does).

**The presentation boundary.**
- The page calls `enh.afterTick(state)` after every completed tick. `motion.js` captures what moves between ticks:
  - each seat's drawn camera (the "before the answer" camera of a touch frame when there is one), the car's point and the horizon offset;
  - the computer racers' points;
  - the shots.
- For a picture, the page passes how far its clock is toward the next tick. `present()` blends the last two snapshots and returns a shallow copy of the state with the blended cameras and points rounded to the words the reference renderer takes. It also copies the seats and the viewer word, so the split screen's seat swaps never touch the race.
- The scene's draw list comes from the reference renderer itself: `render/scene.js` now exports `sceneCamera` and `sceneRecords`, and `render/race-frame.js` exports `drawRaceOverlays` and `sceneSky`.
- That split was checked pixel for pixel. 19,488 frames of every track (races, intros, two player views, two detail levels) are identical before and after, and `npm run verify` passes.
- With every effect off, the page draws through `drawRaceFrame` and `drawVersus` as before. Lint enforces the dependency: only the pages (`src/play.js`, and since the previews `src/viewer.js` and `src/viewer-preview.js`) import `src/enhance`.

**Design constants.** All tuning values are in `src/enhance/config.js`, which documents them as design choices and creates no claims. The lint rules that keep them there are in [evidence.md](evidence.md#enhancement-constants).

**Smooth motion.**
- **What is blended.** The cameras, the cars' points, the racers, the shots and the horizon offset are blended between the last two ticks. Headings take the shortest way round the 1920-unit turn. The horizon offset is unwrapped over its 160-offset period (horizon.js wraps 0 to 160 and 240 to 80) and is drawn at single-pixel steps instead of the strip's 4-pixel steps.
- **What stays on the ticks.** Sprite frames, animation words, glances and every gameplay decision come from the state. The racers' direction frames are chosen by the tick's camera heading (`sceneRecords` takes it as `frames.heading`), and the cars keep the tick's headings, so the other human's direction frame follows its compass word as before. Size classes follow the blended distance, as the reference renderer's projection of the blended point gives them.
- **The projection adapter (`project.js`).** The floor casts the reference renderer's rays from a camera that keeps its fraction of a world unit. Each sprite is shifted by the difference between its exact projection and its whole-unit projection, then clipped again by the object pass's rule. At a whole-unit camera both reduce to the reference exactly: the floor matches `renderFloor` on synthetic tables in `npm test`, and whole pictures match on every scenario in `check:enhance`. The heading stays a whole TRIG entry, one screen column.
- **Discontinuities.** A camera jump of more than 192 world units or a turn of more than 240 compass units in one tick is shown at once. So are a racer or shot that jumps more than 192 units, another world, and an earlier tick (a restart, the next round of a shoot-out). The largest legitimate steps `check:enhance` met over 22 scenarios were 72 units of camera, 138 compass units of turn (the hand brake turn) and 123 units of a racer. No running race crossed a limit.
- **Pauses.** When the page restarts its accumulator after the in-race menu closes, the blend carries on from the picture last shown instead of jumping back.
- **Delay.** Blending shows the race between its last two ticks. That adds 44.6 ms on average (half the 88.2 ms tick) and up to one tick to what the player sees, measured over the four attract demos at 60 Hz.
- **Smoothness.** In the same runs, the reference picture moves in 14% of the 60 Hz frames: it stops and jumps once per tick. The blended camera's step changes by only 4 to 6% of its mean from frame to frame, against 200% for the reference.
- **Default.** The delay is why smooth motion is part of the opt-in Enhanced preset and not the default.

**Contact shadows.**
- **Ground anchors.** All 96 frames of CARS.SP have their wheels on the last of their 28 rows. Of the 97 frames of the 36 object sprites the tracks place, 91 end on their last row too; the other six are frames of bouncing objects (H23, H25, H11). A picture's bottom row is therefore its ground anchor, as the projection's bottom row is in the game. The car art has no baked-in shadow.
- **Where shadows go.**
  - Racers, ducks and the other human get an ellipse under that anchor, the width of the drawn picture.
  - The own car's shadow stays on its ground row (the row table's row of the distance 0x7c) whatever its jump or jiggle. It shrinks and fades to half as the car rises. There is none while the car falls into a pit, flies off a crash or is wrecked, and none for a wrecked racer.
  - Scenery (objects and the starter) gets a narrower ellipse sized by the opaque columns of the lowest quarter of the drawn picture. A tree trunk casts less than a crate. A bouncing object's shadow stays on its anchor row and shrinks and fades with the height of the frame, as the own car's does.
- **Ordering.** Shadows go into a shade layer, and the compositor darkens only pixels whose final owner is the floor. A nearer racer, the shadow's own car, the horizon and the sky therefore cover shadows in any drawing order.

**Surface particles.** `particles.js` emits only from events the game itself classifies; no surface meaning is invented ([surfaces.md](surfaces.md) leaves most of them unread):
- **Dust.** It comes up where the surface under a car has a wheel-dust picture the loader read for the track (the SDX record's first EFFECTS.SP picture, `effects.ground-dust`). Its colour is the mean of that picture's pixels. Where a surface's own picture is blue water spray (surface 5 on track 2), the particles are blue spray: no surface was named for this.
- **Drops.** They fly while a car is in the pit state of the surfaces 6 and 15 (`effects.pit`), coloured by that state's picture or the floor under the car.
- **Sparks.** They fly when a wall or racer contact starts the spark word (`effects.sparks`), on the side `sparkShift` gives, coloured by the brightest half of SPARK.SP.
- **Emission.** Dust is laid along the path a car drove in the tick, every 9 world units, and each puff is born at the time the car passed that spot. The amount follows the distance driven, never the display's refresh rate.
- **Ageing and limits.** Particles age on the presentation clock, so a pause freezes them. The pool holds at most 384, and its random source is its own seeded xorshift. `check:enhance` makes `Math.random` throw while the enhancer runs, and a reset leaves no particle.
- **Drawing.** Particles are hidden behind nearer pictures and under the overlays. They are fogged by their own distance and fade before they pass the camera.

**Distance fog.**
- **Depth.** The floor's depth at a pixel is the NDIST distance of its ray times the column's VIEW word over 2^14. This is the distance the game sorts and sizes its sprites by: the row table puts the floor's distances on the rows they are drawn on (for example 115 at row 199, 318 at row 149 and 972 at row 130). Sprites carry their record's distance, so ground and sprites fade alike.
- **Colour and strength.** The colour is the mean of the top four rows of the track's horizon strip (the sky just above the scenery), pulled 35% toward its own grey. The blend starts at 32% of the floor's farthest distance and reaches 42% at its far edge. The horizon strip gets 22%.
- **Untouched.** The sky, a demo slide's page picture, the split screen's strips and every overlay are left unchanged.

**Overlays.** The HUD, the overhead map, the finish labels and messages, the menus and the split screen's strips are drawn by the reference code over the enhanced indexed picture. The same code then draws a second time into a buffer of sentinel values. Every pixel it writes there is masked out of the effects, which needs no comparison of colours. The picture's own pixels go through the frame's palette, so the palette cycle of the beach tracks and the demo's fade-in reach them as before. The fog and particle colours come from the track's base palette and are not cycled; the fade-in caps them as it caps the palette.

**Split screen and link races.** Each viewer is drawn with its own camera, and its layers are cut and flipped the way `composeSplit` and `flipViewport` cut and flip the picture. Particles are projected per viewer and mapped to the viewer's rows. A link race draws the own seat full screen through the same path.

**Memory.** These buffers are fixed:
- three sets of layers for 320×200 (kind, depth, contact shadows, sun shadows, skid marks and a blur scratch since the second batch);
- two scene pictures, a mask and a sentinel buffer;
- two snapshots;
- the 384-particle pool and the 768-segment ring of skid marks.

Per world, the enhancer caches the floor depth table, one layer template per detail level and sky kind, the fog colour and ramp, and the particle colours. All of these sit in WeakMaps keyed by the decoded data.

**Frame time.** Measured on a MacBook Air (Mac14,2, Apple M2), with the second batch's effects included (2026-10-06):
- *Node v26.8.1, `npm run check:enhance -- --time`.* The four attract demos were drawn five pictures per tick:

  | Configuration | Mean | 95th percentile |
  | --- | --- | --- |
  | Reference renderer (with the page's palette blit) | 0.94 ms | 1.08 ms |
  | Smooth motion | 1.49 ms | 1.64 ms |
  | Smooth motion and skid marks | 1.45 ms | 1.58 ms |
  | Smooth motion and shadows | 1.56 ms | 1.72 ms |
  | Smooth motion and fog | 1.59 ms | 1.79 ms |
  | Smooth motion and particles | 1.67 ms | 2.01 ms |
  | Smooth motion and sun shadows | 2.04 ms | 2.93 ms |
  | Enhanced (all effects) | 2.34 ms | 3.14 ms |

  The attract demos skid little, so the marks' row is a light case; the scripted races of `check:enhance` keep up to 76 segments alive.
- *Chrome 157, with the page's whole frame (ticks, draw, readouts) over an attract demo.* The reference averaged 1.52 ms (95th percentile 2.5 ms). Enhanced averaged 3.54 ms (95th percentile 4.6 ms, worst 8.3 ms). The first milestone alone had measured 2.7 ms.

Both fit a 60 Hz frame many times over. On slower machines the strength sliders and the switches are the lower settings.

**Checks.**
- `npm test`. `test/enhance.test.js` covers the settings, wraparound, discontinuities, the pause rebase, the floor adapter against `renderFloor`, the inverse projection, the compositor's masks and layers, the coverage fill, the contact and sun shadows, the skid marks' rules and ring, the random source and the lint rules.
- `npm run check:enhance` uses the local archive. It runs 22 scenarios: the attract demos on their recorded controls, a scripted race on every third track with its fly-in, the two player race and shoot-out, and the duck game with a seeded source. Each scenario is checked three ways:
  - the state after every tick must hash the same with no draw, with the reference draw, and with the enhanced draw at random blends, mid-run settings changes and menu-style rebases;
  - a picture drawn at the tick with only smooth motion on must equal the reference renderer's;
  - with every effect on, the overlay pixels must equal the reference renderer's.

  It also checks the brake's skid marks, the caps of the particles and the marks, the second player's view of a link race, and the viewer's race preview.
- *A production build served under a subpath.* `dist/` was copied to `/wacky/`, and an archive was dropped onto the page from outside the build. The build loaded and raced with the Enhanced preset, and the viewer's race view of track 4 ran from the dropped archive. The build contains no game files.

**Not in this milestone.** The display options and CRT look of Stage 1 and the track editor's preview are still open; skid marks, sun shadows and the viewer's previews followed (next section). Also open: the tuning of the defaults with the player, by eye on more tracks and devices.

### Skid marks, sun shadows and the viewer's previews

Built 2026-10-06 on the first milestone. Both effects are part of the Enhanced preset and have their own switches in the playtest page's panel (*Sun shadows*, *Skid marks*) with a *Sun direction* slider; Original is unchanged and still the default.

**Skid marks (`marks.js`).**
- **When.** A car lays marks on a tick that the game itself counts as a skid: the slide (the drift word, which the hand brake turn sets too), the forced turn of the hand brake, the hop, or a SKID among the tick's sounds, which the control routine plays every tick the brake works against a throttle above 0 (obj1+0x19553). The split screen's sounds are not told apart by seat, so there only the skid states lay marks. A car in the air (the jump), a wrecked car and a tick that moved too little or jumped too far lay none.
- **Where.** A segment is one rear wheel's path over one tick, from the car's point (where its picture stands on the ground) six world units to either side, so consecutive segments join into two tracks. By design no marks are laid on the five surface values `terrain.special-values` lists apart from the boost strip (the wall, the value a stopped car is drawn four rows shorter on, the pit state's two and the fall): what they are is not read, so they are left unmarked rather than guessed at.
- **How they look.** Marks darken the ground they lie on and keep its colour, so they are grey on tarmac, brown on sand and dark green on grass. Where the surface has a wheel-dust picture for the track (the same classification the dust uses) they are wider and lighter, like ruts. They stay at full strength for 5 seconds of race and fade over the next 7. Each pixel takes the part of it a mark covers (four scanlines a row), so far marks thin out instead of breaking into dashes.
- **Memory and resets.** The ring holds the newest 768 segments, about 34 seconds of skidding; a race start, a restart, a new round or a change of the switches empties it. Marks are drawn into their own layer of the ground, under every picture.
- **Checked.** In `check:enhance` a car that only brakes (no slide, hand brake or hop) lays two segments a tick, and the scripted races with their brake and hand brake turns lay marks on 12 of their 14 tracks.

**Sun shadows (`shadows.js`).**
- **What casts.** Every picture that can have a contact shadow casts on this switch of its own, whatever the contact and scenery switches say: racers, ducks, the other human, the own car on the ground and the scenery; never a shot, and not the own car in a pit, a crash or a wreck.
- **The silhouette.** Each drawn column of a picture is cast as a line on the ground from the shadow of its lowest to that of its highest opaque pixel, the heights read off the picture at its distance (`cameraPoint` inverts the projection to find the picture's point). A picture is flat, so a sun to the side would cast a line; the column's line is therefore swept through a depth of 0.9 times the drawn width along the camera's view, which gives the shadow the body the picture shows. A lifted car or a bouncing object casts from its height, so its shadow moves away from its anchor.
- **The sun.** One sun for every track (the tracks carry none): its direction is the *Sun direction* setting, a part of a turn in the world's compass, so the shadows turn with the camera as the car drives round the track. Its height gives a shadow 1.1 times as long as the picture is high (about 42 degrees). The shadows are softened by a one-pixel box blur and darken the ground by 46% at full strength (the shadow strength slider applies to both kinds); where a contact shadow and a sun shadow meet, the darker counts.

**The asset garage's previews (`viewer-preview.js`).**
- **Race view.** A track's *View* control (on any of its `.GAM`, `.M`, `.RD` and `.SPW` members) switches from the map to a race on the track seen from the race camera: the reference renderer on the left and the Enhanced presentation of the same moment on the right (or one of them alone).
  - The race is the game's own, run in the page on the visitor's archive: tracks with demo controls (1 to 5 and 7) replay their demo race with the driver and detail level it was recorded with (the attract mode's races take the drivers from the first in turn); the others, and the demos after their recording ends, are driven by a pilot that pursues a point 110 steps ahead on the computer cars' route, with the hand brake on sharp turns.
  - *Moment* is the roadmap's fixed camera: a chosen pass of that race, the same every time; moving it back runs the race again from the start. *Play* runs it in real time, which shows smooth motion against the game's stepping side by side.
  - The effect switches, the levels and the sun direction apply at once; a change of switches runs the race again so particles and marks are rebuilt as they would have been. The settings stay in the viewer until *Use these in the game* stores them for the playtest page; *Load the game's* reads them back.
- **Ground anchors of sprites.** A sprite sheet (`.SP`) has *Ground anchor and shadows*: the frame stood where the race draws the player's car on a plain ground, with its contact shadow and its sun shadow for a *Sun direction*, and the anchor drawn over it (red: the ground row under the lowest opaque row; cyan: the footprint the scenery's contact shadow is sized by and the band it is read from). The contact shadow follows the racer rule (the picture's width) for CARS.SP and the driver sheets and the scenery rule (the footprint) for the others, switchable. A bouncing frame shows its shadow staying on the ground.
- **Checked.** `check:enhance` runs the preview on a demo track and three pilot tracks: the drive must start a lap within 500 passes, draw, and reach the same tick going back and forward. The previews were also looked at in Chrome.

**Shared code.** `raster.js` fills the convex shapes of marks and sun shadows with coverage; `models.js` reads the reconstructed values the effects share with the game once (each accessor validates its claim through `K()` on every call, which cost about a millisecond a frame on the per-point paths before it was cached).

### Tools that make later milestones easier

Add an enhancement preview to the viewer and track editor after the first gameplay integration: a fixed camera, effect toggles, intensity controls and an Original/Enhanced comparison. The viewer can preview sprite anchors and replacement sheets; the editor can preview track atmosphere. Store enhancement metadata in a separate project section or sidecar with sensible defaults so existing tracks remain usable.

For efficient Canvas work, cache reusable visuals and separate layers with different update needs where profiling supports it; see [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
