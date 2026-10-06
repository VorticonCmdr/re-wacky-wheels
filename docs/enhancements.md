# Progressive graphics enhancements

Status: built in the playtest page:
- the first milestone (the Enhanced preset: smooth motion, contact shadows, surface particles and distance fog over the original art), see [the first milestone as built](#the-first-milestone-as-built);
- skid marks and sun shadows from Stage 2, and the enhancement previews of the asset garage (the viewer), see [skid marks, sun shadows and the viewer's previews](#skid-marks-sun-shadows-and-the-viewers-previews);
- the display options and the CRT look of Stage 1 (scaling, the 4:3 shape, full screen, scanlines, glow and curvature), see [display options and the CRT look](#display-options-and-the-crt-look);
- from Stage 3, each track's atmosphere, clouds in the sky and track lighting, with an atmosphere preview in the track editor, see [Stage 3 as built](#stage-3-as-built-track-atmosphere-clouds-and-lighting).

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

**Using it.** In the game's own menus: GAME OPTIONS has the item DISPLAY AND EFFECTS (named ENHANCED GRAPHICS until the display options joined it; only in the page's menus, like KEYS AND SOUND; the game's records of its four-item menu are untouched). It opens:
- PRESET, which Enter switches between ORIGINAL and ENHANCED (from CUSTOM, a mix of switches, back to ORIGINAL);
- MOTION AND SHADOWS (smooth motion, contact, scenery and sun shadows) and SURFACE AND SKY (particles, skid marks, distance fog, and since Stage 3 clouds and track lighting): the switches with ON or OFF, which Enter flips, in two lists so that each stands below the logo ([the menus and the logo](#the-menus-and-the-logo));
- EFFECT LEVELS: the strengths of the shadows, the fog and the particles (Enter goes up a quarter, from 100 to OFF), the side the sun shines from (Enter goes round in eighths; north is the top of the track map) and DEFAULT LEVELS;
- DISPLAY OPTIONS, added with the display options of Stage 1 ([below](#display-options-and-the-crt-look));
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

**Not in this milestone.** Skid marks, sun shadows and the viewer's previews followed (next section), then the display options and the CRT look of Stage 1, then Stage 3 with the track editor's preview. Also open: the tuning of the defaults with the player, by eye on more tracks and devices.

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
- **The sun.** The game's tracks carry no sun, so one sun serves every track (since Stage 3 a track's atmosphere can give it its own direction and height): its direction is the *Sun direction* setting, a part of a turn in the world's compass, so the shadows turn with the camera as the car drives round the track. Its height gives a shadow 1.1 times as long as the picture is high (about 42 degrees). The shadows are softened by a one-pixel box blur and darken the ground by 46% at full strength (the shadow strength slider applies to both kinds); where a contact shadow and a sun shadow meet, the darker counts.

**The asset garage's previews (`viewer-preview.js`).**
- **Race view.** A track's *View* control (on any of its `.GAM`, `.M`, `.RD` and `.SPW` members) switches from the map to a race on the track seen from the race camera: the reference renderer on the left and the Enhanced presentation of the same moment on the right (or one of them alone).
  - The race is the game's own, run in the page on the visitor's archive: tracks with demo controls (1 to 5 and 7) replay their demo race with the driver and detail level it was recorded with (the attract mode's races take the drivers from the first in turn); the others, and the demos after their recording ends, are driven by a pilot that pursues a point 110 steps ahead on the computer cars' route, with the hand brake on sharp turns.
  - *Moment* is the roadmap's fixed camera: a chosen pass of that race, the same every time; moving it back runs the race again from the start. *Play* runs it in real time, which shows smooth motion against the game's stepping side by side.
  - The effect switches, the levels and the sun direction apply at once; a change of switches runs the race again so particles and marks are rebuilt as they would have been. The settings stay in the viewer until *Use these in the game* stores them for the playtest page; *Load the game's* reads them back.
- **Ground anchors of sprites.** A sprite sheet (`.SP`) has *Ground anchor and shadows*: the frame stood where the race draws the player's car on a plain ground, with its contact shadow and its sun shadow for a *Sun direction*, and the anchor drawn over it (red: the ground row under the lowest opaque row; cyan: the footprint the scenery's contact shadow is sized by and the band it is read from). The contact shadow follows the racer rule (the picture's width) for CARS.SP and the driver sheets and the scenery rule (the footprint) for the others, switchable. A bouncing frame shows its shadow staying on the ground.
- **Checked.** `check:enhance` runs the preview on a demo track and three pilot tracks: the drive must start a lap within 500 passes, draw, and reach the same tick going back and forward. The previews were also looked at in Chrome.

**Shared code.** `raster.js` fills the convex shapes of marks and sun shadows with coverage; `models.js` reads the reconstructed values the effects share with the game once (each accessor validates its claim through `K()` on every call, which cost about a millisecond a frame on the per-point paths before it was cached).

### Display options and the CRT look

Built 2026-10-06 (Stage 1 apart from the HUD layer): `src/enhance/display.js` (the layout and the WebGL pass), `src/enhance/display-settings.js` (the settings, kept in this browser under `wackywheels.display`), the menus in `src/game/display-menu.js`.

**Using it.**
- In the game's menus: GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS. Its list has SCALING (FIT or INTEGER), ASPECT (16 BY 10 or 4 BY 3), FULL SCREEN, CRT LOOK and CRT LEVELS (SCANLINES, GLOW, CURVATURE, DEFAULT LEVELS). A level goes up a quarter with Enter, from 100 to OFF.
- In the panel: the *Display* fieldset has the same settings, a *Full screen* button, *Reset display*, and a close-up of the screen's own pixels around the car, enlarged four times. Double-clicking the picture also toggles full screen. The menu and the panel always show the same settings.
- Full screen is not stored: browsers enter it only from a key or a click.

**What it changes.** The page still draws every screen into its 320 x 200 canvas exactly as before. The display only decides how that canvas reaches the screen, so it applies to the Original and Enhanced presets alike and to every screen (menus, cards, races, the split screen).
- **The defaults:** 4:3, fit, and the CRT look off with its curvature off: the maintainer's choice (2026-10-06), the shape the game had on a monitor. They are drawn by the WebGL pass below, so a first visit makes a WebGL context.
- **Square pixels, fit and no CRT look are the page as it was:** the browser scales the canvas itself, as before (nearest pixel, at most 960 CSS pixels wide, whatever the window's height), and the page makes no WebGL context; it is made the first time another setting or full screen needs it.
- **Any other setting, or full screen:** a second canvas the size of the screen's own pixels takes the canvas's place. A WebGL 2 shader fills it from the picture. The canvas is hidden but still drawn as before, so `wackyDebug` and the checks read the same picture.
- **Without WebGL 2:** the browser scales the canvas to the chosen shape and size, by the nearest pixel (at 4:3 the rows are then of uneven height). The CRT look is not available, and the menu's CRT LOOK says NONE.

**The shapes.** 16 BY 10 is the canvas's square pixels. 4 BY 3 is the shape a VGA monitor of the time stretched the 320 x 200 picture to, which makes each pixel 1.2 times as tall as it is wide. That is a display convention, not a claim about the game.

**The scaling.** Sizes are computed in screen (device) pixels, not CSS pixels. The canvas's drawing buffer follows the element's real size where the browser reports it.
- **Fit**, everywhere but in the page as it was, draws the largest picture of the shape that fits the space. Each pixel's inside is its own colour; where a pixel falls between screen pixels its edge blends over one screen pixel (sharp bilinear), so the uneven nearest-pixel columns and rows of the browser's own scaling do not appear. In the page as it was the browser's scaling stays, as above.
- **INTEGER** gives every picture row a whole number of screen rows, and with square pixels every column too.
  - At 4:3, six screen rows per picture row is exactly five by six screen pixels per picture pixel (1600 x 1200), and any multiple of six rows is whole on both axes (twelve rows: ten by twelve).
  - Other row counts give columns that are not whole, drawn as in fit.
  - A space one screen pixel short of a multiple, in width or height, keeps that multiple and draws the picture a pixel smaller there. The browser's rounding of an element's size therefore cannot drop it to the next smaller multiple.
- **Window and full screen.** Beside the panel, the picture is at most 960 CSS pixels wide (the page's old width) and fits the window's height below its top. In full screen it fills the screen, centred on black.

**The CRT look.** It is a final pass over the scaled picture, with three levels (defaults 50, 25 and OFF: the curvature is off until the player sets it). The design numbers are in `CRT` of `config.js` and reach the shader as uniforms.
- **Scanlines.** Each picture row is lit as a Gaussian beam and the space between rows darkens; part of the lost light is given back on the row's middle. They fade out below two screen rows per picture row and show fully from three and a half, so a small window gets no moiré.
- **Glow.** The picture is blurred at its own size, over 2.5 pixels, and screen-blended over the result.
- **Curvature.** It bulges the picture like a tube's face without cropping it. The midpoints of the edges touch the frame, while the corners are drawn in, rounded and slightly darkened.
- **Readability.** At the default levels, and with the curvature at 25, the HUD's timer and the menu text stay readable; checked by eye on full-size captures.

**Full screen and Esc.**
- Full screen comes from the menu line (requested inside the key's handler, as browsers require; the menu's own pass, which reads the key later, does nothing more), the button or a double-click.
- Esc leaves full screen, as browsers have it; after that it is the game's key again. The page ignores an Esc it receives while in full screen, so a browser that also passes that key on does not pause the race or give up a link race with it. The page does not lock Esc for itself (Chromium's Keyboard Lock API): leaving would then mean holding Esc, and the held key would reach the game as presses of its own Esc.
- LEAVE GAME leaves full screen, because the DOS text screen is shown beside the picture.

**Checks.**
- `npm test`: `test/display.test.js` covers the placement for each shape and scaling, the window's space, the CRT pass's numbers, the settings and their store, the menus and the logo rule, and, on a page of stubs, how the picture is shown: the page as it was never asks for a WebGL context, the default 4:3 or another setting that needs one asks once, and a CRT look the browser cannot show does not move the page out of its layout. `test/menu-logo.test.js` checks the logo rule for every list the page's menus reach.
- In Chrome 157 on a MacBook Air (Mac14,2, Apple M2, device pixel ratio 2), by reading back the drawn pixels:
  - Square pixels with INTEGER at 1600 x 1000: all 1,600,000 screen pixels equal their picture pixel.
  - 4:3 at 1600 x 1200: all 1,920,000 are exact 5 x 6 copies.
  - 4:3 with whole rows at 1333 x 1000, and fit at 1523 x 1142: every screen pixel inside one picture pixel is exact, and every edge pixel lies within the colours of the picture pixels it covers.
  - The canvas hashes the same with the CRT look on and off, and Original with the CRT look leaves the Enhanced presentation off.
  - The menus were driven with key events: each line changes the setting, and the panel and the store follow.
- **Not exercised in automation:** entering real full screen. The automated tab's synthetic keys carry no user activation, so the check only shows that FULL SCREEN calls the request from the key's handler.
- **Frame time.**
  - The pass costs about 0.12 ms of CPU time a frame.
  - With the graphics card made to finish every frame (a one-pixel read-back after each draw) at 2880 x 1800, a full screen of that Mac: 1.47 ms without the CRT look, 1.78 ms with it, 1.43 ms with it but no glow.
  - Those figures include the read-back's stall. The glow's two blur passes are most of the difference. They were measured before the blur's tap count became a uniform (a loop the shader compiler may no longer unroll) and before the bottom row's scanline fix; not measured again since.

#### The menus and the logo

The menu picture's logo ends on row 75. Every menu of the game the port models (`menu.tree-observed`, `menu.famous-menus`) starts its first bar at row 76 or below: the longest are the nine-line main menu, in its own layout, and the six-line lists of FAMOUS DRIVERS. That is not a rule shown for the whole game: the phone book of seven items that MAKE CALL opens ([leads/menus.md](leads/menus.md)) is not modelled, and where it stands is not read. The page's own lists are held to the modelled menus' row.
- Every list the page's menus reach keeps to that (`test/menu-logo.test.js`), so none has more than six lines: GAME OPTIONS (its page items are KEYS AND SOUND, which opens KEYBOARD CONTROLS and SOUND DEVICES, and DISPLAY AND EFFECTS), DISPLAY AND EFFECTS with its two lists of switches, EFFECT LEVELS, DISPLAY OPTIONS and CRT LEVELS, and a player's key list, which has its six keys and no LEAVE THIS MENU (Esc goes back, as from the game's setup lists).
- How it came about: DISPLAY OPTIONS was first tried as an eighth GAME OPTIONS item, whose first bar covered rows 64 to 75. That showed three earlier lists over the logo: GAME OPTIONS (7 lines), EFFECTS (8) and the key lists (7). On 2026-10-06 they were split as above.
- Still over the logo: the key lists' boxed title (SETUP.EXE's PLAYER 1 KEYBOARD CONTROLS), which stands at the engine menu title's distance above the first bar, on rows 54 to 69 (before the split 48 to 63; docs/TODO.md).

### Stage 3 as built: track atmosphere, clouds and lighting

Built 2026-10-06: from Stage 3, each track's atmosphere (the per-track metadata the roadmap's Stage 3 sections and its section on tools ask for), clouds in the sky (from "Layered skies and horizons") and track lighting ("Track-specific lighting"), and the track editor's atmosphere preview.
- **Code:** `src/enhance/atmosphere.js` (the atmosphere and its store), `clouds.js`, `grade.js` (the lighting), the composite's sky and grade passes, and `src/track-atmosphere.js` (the editor's tab).
- **Design numbers:** in `config.js` under `ATMOSPHERE`, `CLOUDS` and `GRADES`. They are art direction, not claims about the game, and no track carries a hand-made theme.

**Using it.**
- **Editor:** the track editor has a third tab, **Atmosphere**, beside Tiles and Objects. For the selected track it sets:
  - the lighting (none, dawn, sunset, dusk, night or overcast) and its strength;
  - the clouds (how much of the sky they cover) and the wind;
  - its own sun (direction and height; otherwise the game's SUN FROM setting at the usual shadow length);
  - its own fog colour (otherwise the colour of the horizon strip) and the fog's strength (up to twice the game setting).
- **Race view:** above the controls, a race on the track as it is being edited, drawn by the Enhanced graphics with that atmosphere. It has *Play*, a *Moment* slider and an *Original* switch for the reference picture.
- **Game page:** the playtest page draws each track with its atmosphere whenever its Enhanced graphics have the effect switched on. The Graphics panel says which atmosphere the current track has.
- **Switches:** two new effect switches, **Clouds** and **Track lighting**, are in the panel and in GAME OPTIONS > DISPLAY AND EFFECTS > SURFACE AND SKY. That list was renamed from PARTICLES AND FOG and has six lines, so it still stands below the logo.
- **Defaults:**
  - The Enhanced preset now includes the clouds, so every track shows some by default. Turn the *Clouds* switch off to remove them, or set a track's clouds to 0 in the editor.
  - Settings stored before Stage 3 keep their preset: an Enhanced player stays Enhanced.
  - The lighting has no effect until a track is given a grade.

**The atmosphere and where it is kept.**
- **Store:** each track's atmosphere is kept in this browser under `wackywheels.atmosphere`, by track number, apart from the game files and from the editor's draft. A track with nothing stored has the defaults. The editor writes each change at once, and the playtest page and the asset garage read it whenever a race starts.
- **Defaults draw as before:** with the clouds and the lighting off, the defaults draw exactly as before Stage 3. A run of six scenarios (the attract demo, races on tracks 2, 3 and 7, the split screen and the duck game, all other effects on) hashes every picture the same as the committed code.
- **Keyed by number, not archive:** the editor's own draft is keyed by its archive's fingerprint, which the playtest page does not know. An edited archive's track 12 therefore has the same atmosphere as the original's.
- **Project file:** the editor's *Save project* file carries every stored atmosphere in a top-level `atmosphere` section. *Open project* takes them in, over this browser's for the same tracks. The project format stays version 1: an older editor ignores the section, and a project with atmospheres but no edited track opens.
- **Not in the draft:** the browser draft does not carry the atmospheres, so restoring an old draft never brings back older atmospheres. Atmosphere edits are not part of the editor's undo, and they never enable the edited-archive export.

**Clouds (`clouds.js`).**
- **What they are:** two banks of a cloud field (repeating value noise) over the track's sky.
  - A far bank of small, flat puffs sits just above the horizon strip, and a near bank of bigger clouds higher up.
  - Each bank has a flat base and a top that thins out.
  - The cover of a pixel is drawn in a few steps with ordered dithering, as the game's own sky ramps are dithered, and each cloud has a lit top and a shaded base, read from the field's slope.
  - The cover follows the field's own distribution: the share of the field that is cloud is 0.95 × amount ^ 1.44, so the default amount 0.35 makes about a fifth of a bank's middle rows cloud and the full amount nearly all of them (its top and base thin out).
- **How they move:** the game's sky picture never moves; only the strip scrolls, with the steering rather than the heading.
  - The clouds move with the strip, using its scroll without its wraps. `motion.js` keeps a sky value per seat that adds each tick's step of the offset taken the short way round, so the 240 → 80 and 0 → 160 wraps leave no seam.
  - The wind moves them on the race clock, so a pause stops them.
- **Colours:** taken from the sky row they lie in. A lit top goes toward white as far as that row is bright, so on the red skies of the BACK3 tracks the clouds keep a reddish colour. A shaded base lies between the lit colour and the sky's, never darker than the sky.
- **Where they are never drawn:**
  - on a demo's slide page;
  - on the split screen, whose sky rows are the strips' picture;
  - over the overlays.

  The overhead map's rectangle is drawn from the race's first frame, sky and all. In a single view of the track's sky, an overlay pixel that only puts back the sky's own index therefore stays sky, so the clouds and the lighting pass behind the map as they do around it. Counted over the check scenarios (tracks 2, 3, 7, 9 and 21, the demo, the split screen and the duck game, under a night grade), no overlay pixel outside the map's rectangle is let through this way.

**Track lighting (`grade.js`).** A grade is a table per colour component (gain, lift and gamma) and a saturation, mixed with the picture by the track's strength. It is applied as the last step, after the particles. The fog colour, the clouds and the particles are therefore lit with the rest.
- **Pictures:** racers, objects and shots get only part of the grade (60% for dawn and sunset, 50% at night), so what the player drives around stays easy to see.
- **Sky:** each grade mixes the sky toward a gradient of its own. Every track's strip draws its sky-coloured background in the indices of the sky picture's row under it, so the gradient goes on over those strip pixels and the sky does not end at the strip's top.
- **Never touched:** the overlays, the sky rows that are not the track's sky (slides and the split screen), and the demo's fade-in cap.
- **Sun height:** a track's own sun height changes the shadows' length (10 to 70 degrees above the horizon). Sunset with a low sun casts long shadows.

**The editor's race view (`track-atmosphere.js`, using `viewer-preview.js`).**
- **What it runs:** the race of the track as edited. Its changed files are patched into a copy of the archive (`patchArchive`), and the race is the asset garage's preview on that copy.
- **Who drives:** always the pilot that follows the computer cars' route. A track's demo recording does not fit an edited layout, so it is not used.
- **What it shows:** no HUD (the overhead map would be the original's). An edited track with no waypoint left shows a message instead of a race.
- **When it rebuilds:** only while the tab is shown, a moment after the game files changed. A change of the atmosphere only draws again, and *Play* runs the animation only while it plays.
- **Memory:** `archiveMembers` (`src/game/track-data.js`) now keeps its tables in a WeakMap, so an archive copy that no preview holds any more is freed.

**Checks.**
- `npm test`: `test/atmosphere.test.js` covers:
  - the atmosphere's normalizing (values of the wrong type, arrays and prototype names dropped);
  - the store, and the settings migration;
  - the sun's length and the fog tint;
  - the sky scroll across the strip's wraps;
  - the cloud field and banks;
  - the grade tables;
  - the composite's rules (overlays untouched, the sky of slides and the split screen untouched, the fade's cap, pictures graded less).
- `test/menu-logo.test.js` keeps SURFACE AND SKY within six lines.
- `npm run check:enhance`, section 3b, gives every track a night, cloudy atmosphere and compares the clouds and the lighting on and off:
  - a slides demo: its page rows are untouched;
  - the split screen: its strips' rows are untouched;
  - a race on track 7: its sky changes;
  - and in each, the overlays still equal the reference renderer's.
- In the browser: clouds were looked at on six sky families (the city, beach, desert, mountains and both red skies), every grade on track 7, and the editor's tab on track 7.

**Frame time.** Measured on the MacBook Air (Mac14,2, Apple M2), 2026-10-06, before the review's last small fixes (the clouds' fade cap, the cloud amount's curve, the map's rectangle in a single view only).
- **Node v26.8.1, `npm run check:enhance -- --time`.** The four attract demos, five pictures a tick:

  | Configuration | Mean | 95th percentile |
  | --- | --- | --- |
  | Reference renderer (with the page's palette blit) | 0.96 ms | 1.02 ms |
  | Smooth motion | 1.75 ms | 1.87 ms |
  | Smooth motion and clouds | 2.18 ms | 2.28 ms |
  | Smooth motion and a sunset grade | 2.48 ms | 2.63 ms |
  | Enhanced (all; no grade, as the default atmosphere has) | 3.04 ms | 3.81 ms |
  | Enhanced with a sunset on every track | 3.72 ms | 4.44 ms |

  - The clouds cost about 0.4 ms a frame and a grade about 0.7 ms.
  - Until this change the script ran no ticks at all when called with `--time` alone: the frame count was read from the argument after `--frames`, which was absent. It now defaults to 500.
- **Chrome 157, track 1, the enhancer's draw.** The page's tab was hidden, so it ran at background priority: its reference frame took 2.2 ms here, against the 1.5 ms the first milestone measured. Read these figures against each other, not against the node table:
  - Enhanced without clouds and lighting: 4.1 ms.
  - With clouds: 5.8 ms.
  - With a sunset grade too: 7.0 ms, 7.8 ms for the whole frame.

  All of these fit a 60 Hz frame.

**Not done.**
- The roadmap's "several scenery layers" (a second, distant horizon) and animated scenery and water ("Animated scenery and water", which needs a reading of which surfaces are water, or water areas marked per track).
- A HUD layer for high-density screens (Stage 1).
- Hand-made atmospheres for the game's tracks: every track starts from the defaults.

### Tools that make later milestones easier

Built: the viewer's previews (above) and the track editor's atmosphere preview (Stage 3). The roadmap's note: add an enhancement preview to the viewer and track editor after the first gameplay integration: a fixed camera, effect toggles, intensity controls and an Original/Enhanced comparison. The viewer can preview sprite anchors and replacement sheets; the editor can preview track atmosphere. Store enhancement metadata in a separate project section or sidecar with sensible defaults so existing tracks remain usable.

For efficient Canvas work, cache reusable visuals and separate layers with different update needs where profiling supports it; see [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
