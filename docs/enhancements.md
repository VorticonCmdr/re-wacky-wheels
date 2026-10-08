# Progressive graphics enhancements

Status: built in the playtest page:
- the first milestone (the Enhanced preset: smooth motion, contact shadows, surface particles and distance fog over the original art), see [the first milestone as built](#the-first-milestone-as-built);
- skid marks and sun shadows from Stage 2, and the enhancement previews of the asset garage (the viewer), see [skid marks, sun shadows and the viewer's previews](#skid-marks-sun-shadows-and-the-viewers-previews);
- the display options and the CRT look of Stage 1 (scaling, the 4:3 shape, full screen, scanlines, glow and curvature), see [display options and the CRT look](#display-options-and-the-crt-look);
- from Stage 3, each track's atmosphere, clouds in the sky and track lighting, with an atmosphere preview in the track editor, see [Stage 3 as built](#stage-3-as-built-track-atmosphere-clouds-and-lighting);
- then a far range of hills or mountains behind the horizon strip and the moving water, see [the far range and the moving water](#the-far-range-and-the-moving-water);
- then the relief lighting from height maps, with the player's own maps imported in the asset garage, and the HUD layer of Stage 1, see [the relief and the HUD layer](#the-relief-and-the-hud-layer).

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

Built: the HUD layer ([below](#the-relief-and-the-hud-layer)), for the Original and the Enhanced graphics.

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

Built: the clouds and one further layer, the far range ([below](#the-far-range-and-the-moving-water)), each set per track.

### Animated scenery and water

Add restrained movement to flags, foliage and trackside props. Extend the existing palette cycling with optional water ripples or highlights. Reflections are a later feature because they need masks, scene information and careful performance budgeting.

Built: the water's ripples and highlights, and a plain mirror of the haze by distance ([below](#the-far-range-and-the-moving-water)). Not built: the flags, foliage and props, and true reflections.

Animation should add life without obscuring racers or making static collision boundaries look as if they move.

### Track-specific lighting

Introduce warm sunsets, cool night scenes or overcast moods through controlled color grading and sky choices. Protect HUD colors and important gameplay cues. Stronger lighting could use separately authored normal or height maps for tiles and sprites; these would be enhancement assets, not fields inferred from the original formats.

Built: the grades (Stage 3) and the relief from height maps ([below](#the-relief-and-the-hud-layer)): the player's own maps where they imported some, else maps made from the pictures; neither is read from the game's formats.

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
- MOTION AND SHADOWS (smooth motion, contact, scenery and sun shadows, and since the moving water skid marks) and SURFACE AND SKY (particles, moving water, distance fog, sky layers, track lighting): the switches with ON or OFF, which Enter flips, in two lists so that each stands below the logo ([the menus and the logo](#the-menus-and-the-logo));
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
- In the game's menus: GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS. Its list has SCALING (FIT or INTEGER), ASPECT (16 BY 10 or 4 BY 3), FULL SCREEN and CRT AND HUD (CRT LOOK, SCANLINES, GLOW, CURVATURE and HUD). A level goes up a quarter with Enter, from 100 to OFF, so the quarter steps reach every default level. (As first built, CRT LOOK was a line of DISPLAY OPTIONS and the last item was CRT LEVELS with DEFAULT LEVELS; the HUD layer renamed it CRT AND HUD with a HUD line, [below](#the-relief-and-the-hud-layer), and Stage 4 moved CRT LOOK into it and dropped DEFAULT LEVELS to free a line for RENDERING: [Stage 4 as built](#stage-4-as-built-sharper-rendering-and-artwork). The panel keeps *Reset display*.)
- In the panel: the *Display* fieldset has the same settings, a *Full screen* button, *Reset display*, and a close-up of the screen's own pixels around the car, enlarged four times. Double-clicking the picture also toggles full screen. The menu and the panel always show the same settings.
- Full screen is not stored: browsers enter it only from a key or a click.

**What it changes.** The page still draws every screen into its 320 x 200 canvas exactly as before. The display only decides how that canvas reaches the screen, so it applies to the Original and Enhanced presets alike and to every screen (menus, cards, races, the split screen).
- **The defaults:** 4:3, fit, and the CRT look off with its curvature off: the maintainer's choice (2026-10-06), the shape the game had on a monitor. They are drawn by the WebGL pass below, so a first visit makes a WebGL context.
- **Square pixels, fit and no CRT look (and, since the HUD layer, the HUD in the picture) are the page as it was:** the browser scales the canvas itself, as before (nearest pixel, at most 960 CSS pixels wide, whatever the window's height), and the page makes no WebGL context; it is made the first time another setting or full screen needs it.
- **Any other setting, or full screen:** a second canvas the size of the screen's own pixels takes the canvas's place. A WebGL 2 shader fills it from the picture. The canvas is hidden but still drawn as before, so `wackyDebug` and the checks read the same picture.
- **Without WebGL 2:** the browser scales the canvas to the chosen shape and size, by the nearest pixel (at 4:3 the rows are then of uneven height). The CRT look is not available, and the menu's CRT LOOK (in CRT AND HUD) says NONE.

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
- **Real full screen:** not exercised in automation (the automated tab's synthetic keys carry no user activation, so that check only shows that FULL SCREEN calls the request from the key's handler). The maintainer checked it by hand on 2026-10-06: it works.
- **Frame time.**
  - The pass costs about 0.12 ms of CPU time a frame.
  - With the graphics card made to finish every frame (a one-pixel read-back after each draw) at 2880 x 1800, a full screen of that Mac: 1.47 ms without the CRT look, 1.78 ms with it, 1.43 ms with it but no glow.
  - Those figures include the read-back's stall. The glow's two blur passes are most of the difference. They were measured before the blur's tap count became a uniform (a loop the shader compiler may no longer unroll) and before the bottom row's scanline fix; not measured again since.

#### The menus and the logo

The menu picture's logo ends on row 75. Every menu of the game the port models (`menu.tree-observed`, `menu.famous-menus`) starts its first bar at row 76 or below: the longest are the nine-line main menu, in its own layout, and the six-line lists of FAMOUS DRIVERS. That is not a rule shown for the whole game: the phone book of seven items that MAKE CALL opens ([leads/menus.md](leads/menus.md)) is not modelled, and where it stands is not read. The page's own lists are held to the modelled menus' row.
- Every list the page's menus reach keeps to that (`test/menu-logo.test.js`), so none has more than six lines: GAME OPTIONS (its page items are KEYS AND SOUND, which opens KEYBOARD CONTROLS and SOUND DEVICES, and DISPLAY AND EFFECTS), DISPLAY AND EFFECTS with its two lists of switches, EFFECT LEVELS, DISPLAY OPTIONS (five lines since Stage 4 moved CRT LOOK out of it) and CRT LEVELS (CRT AND HUD since the HUD layer; six lines: CRT LOOK, the three levels, HUD and LEAVE THIS MENU since Stage 4), and a player's key list, which has its six keys and no LEAVE THIS MENU (Esc goes back, as from the game's setup lists).
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
- **Switches:** two new effect switches, **Clouds** and **Track lighting**, are in the panel and in GAME OPTIONS > DISPLAY AND EFFECTS > SURFACE AND SKY. That list was renamed from PARTICLES AND FOG and has six lines, so it still stands below the logo. (Since the far range, the clouds' switch is SKY LAYERS, *Sky layers* in the panel: [below](#the-far-range-and-the-moving-water).)
- **Defaults:**
  - The Enhanced preset now includes the clouds, so every track shows some by default. Turn the *Clouds* switch off to remove them, or set a track's clouds to 0 in the editor.
  - Settings stored before Stage 3 keep their preset: an Enhanced player stays Enhanced.
  - The lighting has no effect until a track is given a grade. (Since the relief it lights the slopes of every track by default: [below](#the-relief-and-the-hud-layer).)

**The atmosphere and where it is kept.**
- **Store:** each track's atmosphere is kept in this browser under `wackywheels.atmosphere`, by track number, apart from the game files and from the editor's draft. A track with nothing stored has the defaults. The editor writes each change at once, and the playtest page and the asset garage read it whenever a race starts.
- **Defaults draw as before:** with the clouds and the lighting off, the defaults draw exactly as before Stage 3 (and the water too, since it came). A run of six scenarios (the attract demo, races on tracks 2, 3 and 7, the split screen and the duck game, all other effects on) hashes every picture the same as the committed code.
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
- The roadmap's "several scenery layers" (a second, distant horizon) and animated water: built next, [below](#the-far-range-and-the-moving-water).
- A HUD layer for high-density screens (Stage 1).
- Hand-made atmospheres for the game's tracks: every track starts from the defaults.

### The far range and the moving water

Built 2026-10-06 on Stage 3: a second, more distant horizon behind the horizon strip (the roadmap's "several scenery layers") and water that moves ("Animated scenery and water").
- **Code:** `src/enhance/ranges.js` (the far range), `src/enhance/water.js` (the liquids and their light), the composite's sky, strip and ground passes, the floor draw's liquid hook (`project.js` `drawFloor`) and `tileSurfaces` in `src/game/surface.js` (each tile's two terrain values, the `.SIN` dwords the game's lookup reads).
- **Design numbers:** `RANGE` and `WATER` in `config.js`, art direction with no claims.

**Using it.**
- **Switches:** *Moving water* (MOVING WATER in the menu) is a new switch. The far range comes with the clouds under one switch, *Sky layers* (SKY LAYERS; the switch that was called Clouds, whose stored key stays `clouds`).
- **The menu:** its two lists of switches have room for five each and DISPLAY AND EFFECTS for no third list, so SKID MARKS moved to MOTION AND SHADOWS. MOTION AND SHADOWS has smooth motion, contact, scenery and sun shadows and skid marks; SURFACE AND SKY has particles, moving water, distance fog, sky layers and track lighting. Each is six lines with LEAVE THIS MENU. The panel lists the switches in the same order.
- **The preset:** both are part of Enhanced and only colour the picture, so switching them keeps the scene.
- **Per track,** in the editor's Atmosphere tab: *Far range* (hills or mountains), *Range height* (0 for none; the default is half) and *Water moves* (0 for still water, as the game draws it; the default is full).
- **Defaults:** under Enhanced every track gets low hills and moving water. With the sky layers, the lighting and the water off, every picture is the same as before (see Checks).

**The far range (`ranges.js`).**
- **Where:** it stands on the strip's last row (129) and shows on the strip pixels drawn in the strip's sky indices (the indices of the sky picture's row under them, the pixels the lighting's gradient goes over) and on the sky rows above. It is therefore behind every building, dune, cloud and sun the strips draw, and shows under their floating clouds and between tree trunks, where the strips leave sky down to the horizon. Only over the track's sky in a single view: never on a demo's slide, never in the split screen.
- **Shapes:** hills (up to 22 rows at full height, rolling) and mountains (up to 30 rows, ridged, snow on the tops of the tallest part). The profile is value noise over a lattice that repeats every 1,024 pixels.
- **Movement:** it follows the strip's scroll without its wraps, as the clouds do, at 0.55 of it. It moves slower than the strip's scenery and so reads as farther away, and it has no seam at the wraps or over a full turn (the profile repeats). The clouds' far bank lies above it and is drawn over the tallest mountains where they reach it (rows 100 and 101).
- **Colour:** the sky's colour of each row (with the lighting's gradient) pulled toward a darkened haze (the track's fog colour, or its own fog tint). Faces rising to the right are lit and the others shaded, in three steps dithered only near the middle between two, as the strips' own dunes are drawn. The last rows above the foot fade into the haze. The strip's fog does not go over it, so its part in the strip meets its part above without a step; the lighting grade goes over it with the rest.
- **Looked at** on all nine strips of the archive: those of tracks 1 and 5 (the city), 2 (the beach), 3 and 9 (the red skies) and 4 and 8 (the deserts) side by side, and those of tracks 6 and 7 (the brown and red mountains of the red-liquid and the lake tracks) in the water's pictures and in Chrome. On the red skies the range passes behind the strip's setting sun, so the sun stands in front of it.

**The moving water (`water.js`).**
- **Which surfaces:** the game's own reading of the surfaces a car sinks into (`terrain.special-values`): the surface a stopped car is drawn four rows shorter on (5), and the two that start the pit state (6, 15), whose pictures (`effects.pit`) are a splash and the car under the surface with only a periscope showing.
  - On the user's archive (a script over the 42 tracks' tiles, not a check), 5 and 6 are blue on every track that has them. Surface 15 is red on the six tracks that have it (6, 13, 20, 25, 32 and 39), where it is the whole ground off the road.
  - The port draws a liquid whose mean colour on the track is redder than blue as the red liquid, and the others as water. These are the port's labels, not names the game holds ([surfaces.md](surfaces.md)).
  - A surface the game does not treat specially is drawn as one of the track's liquids when its mean colour lies within 40 of that liquid's. On the user's archive that is only surface 25, single deep-blue tiles inside the lakes of tracks 7, 14, 23 and 30, which would otherwise stand still in moving water.
- **Marking:** the floor draw marks every liquid pixel from a table per tile and texel, made once per track from its mask sheets and `.SIN` entries (1 to 3 ms in node once the code is warm, more the first time in a session; a track with no sinking surface on its map makes none); an edited map is a new track and gets its own table.
- **Water:** two cloud fields drift over the ground in different directions, and where their values meet runs a thin highlight line, one pixel to either side at any distance (the difference over its slope), dithered in three steps; the surface shows short, moving glints. Between the lines it is a little lighter or darker.
  - The lines thin out between the distances 260 and 640, so the far rows do not sparkle, and are brighter in the columns that look toward the sun (the track's own sun or SUN FROM).
  - Far water mirrors the haze (toward the lighting's sky), up to 32% at the floor's far edge.
- **The beach tracks** (2, 12, 16, 27, 33 and 42): the game cycles their water's palette itself (`palette.cycle-rules`). There the water gets only the highlight lines, no mirror and no shimmer, so the cycle reads as before.
- **The red liquid:** it moves at 0.35 of the water's speed, with slightly narrower lines (0.9 of the water's) that go toward an orange glow, and mirrors nothing. The lighting grade lights it only as much as the pictures, so it glows at night.
- **Unchanged:** skid marks were never laid on these surfaces, and the particles' splashes are as before.

**Checks.**
- `npm test`: `test/sky-water.test.js` covers:
  - the atmosphere's new values;
  - the range's profile (it repeats without a step), its cover (it stands on the foot in every column, is no taller than its rows and moves at its parallax), its colours and the fade's cap;
  - the composite's range: on the sky and the strip's sky-coloured pixels without the strip's fog, never on its scenery or the overlays, within the cap;
  - the liquids of a synthetic track (water, red, the similar colour, the mask);
  - the water's light: within its range, highlights only on a beach, moving with time, nothing at no strength;
  - the composite's water and the red liquid's grade;
  - the floor draw with the hook: the same picture, and every pixel marked with the kind of the texel it shows;
  - the water as a switch that keeps the scene.
- `npm run check:enhance`, section 3b:
  - the dark atmosphere now also has full mountains and full water, and is compared with the sky layers, the lighting and the water all off, on the slides demo, the split screen and race 7;
  - then one effect alone on the race view's pilot, a moment every 75 passes from 150 to 1,200: the sky layers on track 3 change only the sky and the strip's sky-coloured pixels, the water on track 7 and the red liquid on track 6 only the liquid ground, and each changes some.
- **Hashes:** the six scenarios of the Stage 3 hash run give the same pictures as the uncommitted Stage 3 tree in two ways: with the sky layers, the lighting and the water off, and with every effect on and a night, dusk, sunset, overcast or dawn on several tracks but every track's range and water at 0.
- **In Chrome:** the editor's new controls and the race view of track 7 with mountains and its lake, *Play* included, and the panel's switches.

**Frame time.** Node v26.8.1 on the MacBook Air (Mac14,2, Apple M2), 2026-10-06: the four attract demos at five pictures a tick, every configuration drawn on the same ticks in turn. The table was measured before the water's slope test was skipped wherever no line can be, so its water rows are, if anything, high. (A `--time` run and a later run of this table made while the machine was busy with other work measured everything 20% and 140% slower, the reference renderer included, in about the same proportions; they are not quoted.)

| Configuration | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 0.96 ms | 0.92 ms | 1.11 ms |
| Smooth motion | 1.92 ms | 1.84 ms | 2.16 ms |
| Smooth motion, clouds without the range | 2.44 ms | 2.35 ms | 2.75 ms |
| Smooth motion and the sky layers (the default hills) | 2.56 ms | 2.47 ms | 2.86 ms |
| Smooth motion and water | 2.01 ms | 1.92 ms | 2.49 ms |
| Enhanced without the range and the water | 3.42 ms | 3.29 ms | 4.26 ms |
| Enhanced (all) | 3.65 ms | 3.53 ms | 4.61 ms |

- The range costs about 0.1 ms a frame.
- The water costs little on the demos (only track 2's race has water). Where liquid fills the view it costs about 1.2 to 1.6 ms: the red liquid of track 6 at pass 390 drew in 3.1 ms without and 4.7 ms with it, the lake of track 7 in 3.2 and 4.4 ms (medians of 300 pictures, after the slope of a line was skipped wherever no line can be).

**Not done.**
- Flags, foliage and trackside props that move; true reflections of the scenery.
- A third sky layer, or a range drawn from each strip's own skyline.

### The relief and the HUD layer

Built 2026-10-06: Stage 3's lighting from height maps ("Stronger lighting could use separately authored normal or height maps for tiles and sprites") and Stage 1's independent HUD layer.
- **Code:** `src/enhance/relief.js` (the maps, their light, the garage's helpers), `src/enhance/relief-store.js` (the player's maps in this browser), the floor draw's relief hook and the scene's pictures (`project.js`, `scene.js`), the composite's light; the display's HUD layer in `src/enhance/display.js`, the page's two layers in `src/play.js` and the enhancer's in `index.js`.
- **Design numbers:** `RELIEF` and `DISPLAY.huds` in `config.js`.

**The relief: using it.**
- **Switch:** TRACK LIGHTING (the panel's *Track lighting*) now also shows the relief; there is no new switch, as the menu's lists are full.
- **Per track,** in the editor's Atmosphere tab: *Relief* (0 for none; the default is 0.7). The track's own sun (its direction and height) lights it, else SUN FROM at the usual height; a low sun shows the most relief.
- **The player's own maps,** in the asset garage:
  - a tile sheet of the tracks (`A_F*.PCX`) and every sprite sheet (`.SP`) have *Relief preview* (the picture lit by its map from the upper left) and *Export height map*, *Import height map* and *Remove imported map*;
  - the export is the map in use as a grey PNG, lighter for higher: a tile sheet's in the sheet's own layout (320 x 200, the tiles where the sheet has them), a sprite sheet's in the layout of the garage's sprite sheet export for the current width, height, byte offset, pixel order and columns;
  - an import must have the export's size; it is kept in this browser (IndexedDB, under the member's name) and the race views and the playtest page light the pictures by it from the next race on. A sprite sheet's map can be imported only for the layout the race draws its frames in (the garage's default width and height for the sheet, column-major, from byte 0), and it is applied only to frames wholly inside the member; the label says when the view's layout is another one.
  - The maps are the player's art, kept apart from the game files; nothing is committed.
- **Defaults:** with no map of the player's, every track gets the generated relief under Enhanced; Enhanced players, settings stored before included, see it.

**How it is lit.**
- **The ground:** a height per tile texel from 0 to 1, made once per track and set of maps: the player's map of the sheet, else the generated one, the texel's brightness times 0.5, plus 0.5 on the wall surface (`terrain.special-values`), the water and the red liquid flat (they keep their own light). Each texel's slope (central differences) and how much lower it lies than the texels two away diagonally are kept with it; for the texels within two of a tile's edge they are taken at each sample from the heights around it through the map, so a wall that ends where its tile does has its bevel too (on the user's archive about half of the walls' edges lie on tile edges). Per floor sample the slope is lit by the sun, ambient plus diffuse light against a flat ground's, the occlusion darkens it, and the track's level mixes it in. A height of 1 stands 16 world units, enough for the textures' grain to show.
- **The pictures:** per drawn pixel, on the screen: the player's map of the frame (found by where the frame's bytes lie in the archive, for a map made for the frames the race draws), else a rounded body (the distance to the picture's edge, up to four pixels, eased) mixed with the pixel's brightness (0.35 of it). Where the screen cuts a picture, the cut is not an edge: the body goes on past it. The slope's normal is lit by the sun in the camera's terms against a flat picture's, so racers and scenery are lighter on the sun's side and darker on the other. The effects drawn over the own car (dust, its pictures) are not lit.
- **The light** stays within 0.55 and 1.45 and never goes above the demo's fade; the sky, the strip and the overlays are never lit. The generated map's liquids keep their light. The garage's export of a generated map is the very map the race uses.

**The HUD layer.**
- **Using it:** GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS > CRT AND HUD (renamed from CRT LEVELS) has HUD: PICTURE (the default: in the picture, as before), CRISP or SMOOTH; the panel's *Display* fieldset has *HUD*. It needs WebGL 2, like the CRT look (without it the line says PICTURE).
- **What it is:** on the race screens (single, split, link; Original and Enhanced) the page hands the display two layers: the world before the overlays, and the overlays alone (the HUD, the overhead map, the labels and messages, the split screen's strips, the in-race menu), found by drawing them a second time into sentinels. The display draws the world with the CRT look and puts the overlays over it after: no scanlines, glow or vignette on them; with curvature they follow the tube's shape. CRISP draws each overlay pixel sharp; SMOOTH enlarges the layer four times with Scale2x twice (AdvanceMAME's edge-preserving pixel-art scaler) on the graphics card, so the digits' and letters' diagonals are smooth on a dense screen while straight edges stay. Every other screen (menus, cards, boards) is the canvas as before.
- **Unchanged:** the canvas the page draws is the same picture; the overlays keep their pixels' places. The split screen's upside-down half (the inverting shot) is flipped in the world layer as the overlays flip it. The overhead map's rectangle, which the game takes from the race's first frame sky and all, keeps the pixels that only put back the world's index in the world layer, so its sky gets the CRT look as the sky around it does (in the reference renderer's race and link race, as the enhancer already did). Without WebGL 2 the HUD stays in the picture and the page keeps its layout.

**Checks.**
- `npm test`: `test/relief.test.js` (the atmosphere's level; the generated ground heights: the brightness, the raised wall, the flat water, a player's map replacing one sheet; the slopes; the ground's light flat, toward and away from the sun, at no strength and within its range; the sun's vectors; a picture's light on its two sides and its middle, and a flat map of the player's; the sprite maps' byte order; the sheet layout round trip; the store's records and how a frame is found in an archive; the composite's light on the ground and the pictures only, within the cap) and `test/display.test.js` (the HUD setting, its menu line and word, the layers from indexed pictures, Scale2x's rules).
- `npm run check:enhance`: the relief alone on track 4 changes only the ground and the pictures (285,339 pixels over 15 moments), a map of the player's for CARS.SP (rising from left to right) changes only the pictures against the generated one (3,620 pixels on track 1); section 3c draws a race, the split screen (with an upside-down half) and a slides demo with and without layers: the same picture, the overlays' layer exactly the overlay pixels, and the reference renderer's two layers put back together equal its picture.
- **Hashes:** the six scenarios hash the same as Stage 3 with the sky layers, the lighting and the water off, and with every effect on but every track's range, water and relief at 0.
- **In Chrome:** the playtest page with Enhanced, the CRT look and each HUD mode on track 7, read back from the display's canvas: the overlays drawn over the scanlines, sharp, or smoothed (the timer's and the item box's digits); the garage's relief preview of `A_F13.PCX`; the import of a tile sheet's and of CARS.SP's map through the *Import* buttons (a picture of the wrong size refused) and their removal; the race view with a map of the player's. The test maps were removed afterwards.

**Frame time** (node, 2026-10-06, the machine busy with other work, so read against each other): the relief adds about 0.3 to 0.6 ms a frame on tracks 1, 4 and 7 (medians of 300 pictures); the HUD layer's two layers add about 0.3 ms to the enhancer's draw. The Scale2x passes run on the graphics card and were not timed.

**Not done.**
- Shadows cast by the relief itself (a wall's shadow on the road); the sun shadows of the pictures are the cast shadows.
- Maps for the pictures the race makes itself (the crash pictures, the effects), and normal maps (the maps are heights).
- Hand-made maps: the port ships none; the garage's export and import are the way to make them.

### Stage 4 as built: sharper rendering and artwork

Stage 4 ("Stage 4: sharper rendering and artwork" above: a higher internal resolution, widescreen, replacement artwork packs, more kart angles) is built in milestones, art first, then 2x, smooth sprite sizes and widescreen. Each milestone ships on its own: the gates below stay green, the Original preset and the default Enhanced output (scale 1, the standard view, stepped sizes, no artwork) stay byte for byte what they were, and each adds its notes here and its lines to `docs/TODO.md`.

#### M0: the gates and the groundwork

Built 2026-10-06. No picture changes; in the menus, CRT LOOK moves into CRT AND HUD and DEFAULT LEVELS leaves it. M0 adds the identity gate every later milestone runs, the settings, database and geometry the later ones build on, and frees a line of DISPLAY OPTIONS for the RENDERING list.

**The identity gate, `npm run check:identity [ref]`.**
- `scripts/compare-enhance.mjs` makes a temporary git worktree of the ref (default `3f8af9d`, the commit before Stage 4; a later milestone passes its parent commit) in the system's temporary directory, links this tree's `node_modules` into it, and runs `scripts/hash-enhance.js` against both source roots at once, each on this repository's own `WACKY.DAT` (`game/`). It compares the hashes picture by picture, prints the first picture and buffer that differ, and removes the worktree, also when interrupted (a `git worktree remove` that fails is tried once more and reported; the checkout is deleted and the registration pruned either way). The hashes stay in a temporary directory: removed when everything is identical, kept (its path printed) when something differs. `--head <dir>` hashes another source tree instead of this one.
- **Configurations:** A, Enhanced with the default atmosphere; B, Enhanced with a dark full atmosphere on every track (the night grade, clouds 0.9, mountains at full range, water 1, relief 1); C, B with the HUD layers handed in; D, smooth motion only. A to D always draw through the enhancer (since M6's review with the page's frame context, and a seventh configuration N: Enhanced with RESOLUTION 2X stored, drawn as without WebGL 2; M6, Checks). O, the Original preset, and O2, Original as a player kept it before Stage 4 (the switches and levels with no rendering choices, in the enhancer's storage and read by it as the page's is, never configured), draw as the page's `draw` decides: through the enhancer when `enh.active()`, else the reference renderer's path. They record which path each picture took, so a later change that turned the enhanced path on for Original (at the defaults or from settings stored before Stage 4) differs there. The reference path is a replica of the page's (`play.js` cannot run in node: `drawLinkRace`, `drawVersus`, or `drawRaceFrame`'s scene and overlays, without the pause menu and the HUD layer), so O and O2 guard `active()` and that path, not an edit of `play.js`'s `draw` itself.
- **Scenarios** (each about 300 ticks, every tick drawn at a seeded blend and every seventh also at the tick, 342 pictures each): the attract demo of track 1 with its fade-in, races on tracks 2, 3, 6 and 7, the split screen on track 1, the duck game, the ORDERING slides demo over track 7, and both seats of a link race with the page's overhead map of the other human. In A to D the link race is the page's enhanced link draw (`drawEnhanced`: `drawSingle` with the seat, the enhancer swapping the seats for the second); in O and O2 it is the reference link path (`drawLinkRace`). The palette is the page's: the cycled entries shown, the demos faded in.
- **Per picture:** the CRC-32 (`src/evidence/crc32.js`) of the RGBA picture, the index, the overlay mask and, in C, the world and HUD layers; in O and O2 also the path, and on the reference path the index alone (the page's blit colours it with the palette).
- **Reference mode:** `drawRaceFrame` pictures of every track of the archive (42 on the user's), the camera's fly-in and the race at detail levels 1 and 3, and the two player split screen at split detail levels 1 and 3: 10,080 pictures. It guards the reference renderer and the game for the milestones that may export a function from them.
- **It bites.** In throwaway copies of the base tree, never in the repository: one red component of one pixel (row 120, column 160) changed at the end of the composite made all 40 pairs of configurations A to D and scenarios differ from their first picture (`out`, and in C the world layer too); one index of the same pixel changed at the end of `render/scene.js renderScene` made all 42 tracks differ in reference mode (race and split). In copies of this tree (`--head`, 30 ticks): `active()` always true in `enhance/index.js` made all 20 pairs of O and O2 differ (`path` at the first picture) and left A to D identical; one index at row 150, column 160 flipped at the end of `renderScene` made all 20 pairs of O and O2 and all 42 tracks (race and split) differ and left A to D identical. The copies were deleted afterwards.
- **Time:** about four minutes for both roots on the MacBook Air (M2), the two in parallel (102 comparisons: six configurations of ten scenarios and 42 tracks; 112 with seven since M6's review); `--mode reference` alone takes about 25 seconds, `--ticks N` shortens the scenarios.

**The rendering choices (RENDER, `config.js` and `settings.js`).**
- A third group of graphics settings beside the effects and the levels, kept with them under `wackywheels.graphics`: `scale` (1 or 2), `view` ('standard' or 'wide', a 16:9 target), `hudPlace` ('centred' or 'edges'), `sizes` ('classes', the original's stepped sizes, or 'smooth'), `angles` ('locked', 'free' or 'off') and `art` (a boolean). The defaults are the presentation before Stage 4, and a missing or unknown value takes its default, so settings stored before Stage 4 load to the same preset and values.
- **Presets:** ORIGINAL when the switches are Original's and no choice turns the enhanced path on (the HUD place and the kart angles only refine the wide view and the artwork, so they keep ORIGINAL: the word matches what draws); ENHANCED whenever the switches are Enhanced's, whatever the choices; else CUSTOM (Original's switches at 2x, say). Choosing Original (the panel, the menu's PRESET from CUSTOM, the reset) puts every choice back; choosing Enhanced keeps them.
- **Gating:** `renderActive` (a scale above 1, the wide view, smooth sizes or the artwork) and `enhancedOn` (an effect or `renderActive`) replace "any effect" wherever the page decides whether the enhanced path draws: the enhancer's `active()`, its configure (a choice keeps the scene unless the path comes on or goes off with it) and `afterTick`, the garage's race view (its scene key and its draw), the garage's preset fallback and readout, and the game menu's words (`menuView` reports `active`). The HUD place and the angles alone do not turn the path on: they only refine the others. The track editor's race view draws the Enhanced preset at 1x in the standard view with the player's stored sizes, artwork and angles. Without this, Original at 2x would silently draw the reference renderer and take no snapshots.
- **Words:** `RENDER_MENU` holds the RENDERING list's words (letters, digits and spaces; SPRITE SIZES STEPPED is exactly the 20 characters of a bar) and `menuView(settings, { worldReady, packs, angleSets }).render` the words for the settings, NONE where a choice cannot be shown. No menu line or panel control shows them yet: they come with the milestones that make them draw something.

**The menus.** CRT LOOK moved from DISPLAY OPTIONS to the head of CRT AND HUD (still NONE without WebGL 2), and DEFAULT LEVELS left CRT AND HUD: the quarter steps reach 50, 25 and OFF, and the panel keeps *Reset display*. DISPLAY OPTIONS is now SCALING, ASPECT, FULL SCREEN, CRT AND HUD and LEAVE THIS MENU, a line free for RENDERING; CRT AND HUD is CRT LOOK, SCANLINES, GLOW, CURVATURE, HUD and LEAVE THIS MENU. EFFECT LEVELS keeps its own DEFAULT LEVELS.

**The database (`src/enhance/store.js`).** The only opener of the page's IndexedDB database `wackywheels`, now at version 2 (`ART.dbVersion`): an upgrade creates whichever of `relief` (keyed by member, as before, its records kept), `packs` and `art` (keyed by id) is missing. A tab of the page still holding version 1 open blocks the upgrade: the open fails with "close the other tabs of the page", the relief loader returns no maps as it does whenever the browser keeps nothing, and the connection that arrives later is closed at once. The browser tells only the open that upgrades; the opens queued behind it would wait without a word until the old tab closes, so every open still waiting fails with it, and while the upgrade stays held an open fails at once without asking the browser. Every connection closes itself when another tab asks for a newer version. `relief-store.js` now opens through it, with the same behaviour. A build of before Stage 4 opened after the upgrade cannot open the version 2 database and finds no maps (documented risk).

**The geometry (`src/enhance/geometry.js`).** Pure and not used by the race yet: `geometryOf({ s, m })` (the reference grid at a whole scale with m margin columns a side, aligned top-left, so the output pixel (s(x + m), s y) is the reference sample (x, y): the sizes, the key, the maps u, v, outX, outY, colRef and rowRef, and the output pixel of each of the 320 x 200 index's samples), `IDENTITY`, `viewMargin(view, aspect, world)` (0 in the standard view; for 16:9, 53 columns a side at 4 BY 3 and 18 at 16 BY 10, never wider than the horizon strip's period, which is read from `horizon.bounds` (640), and 0 for a world whose strip does not repeat with it) and `cosT(trig, D)` (the cosine of D TRIG entries from the table's own dot products with entry 0, read as signed words and lerped, cached per table, no `Math.cos`). The check of a world's VIEW words against `cosT` comes with the wide view (M8), with its tolerance.

**The display's layers.** `display.js` takes a race screen's layers in the object form of Stage 4 (`{ world: { data, w, h }, hud: { data, w, h } | null, logical: { w, h } }`, `layerParts`) as well as the two bare arrays the page hands it today. Only the canvas's size is accepted; a HUD of null shows the world alone. The page still hands over the bare arrays, so nothing it shows changes.

**The relief's pixel lists.** The lists of the pixels a picture draws, for its relief, were one module-level buffer of 64,000 entries that every enhancer (the page's, each preview's) shared; each enhancer now has its own (`createCollect`), grown to the largest picture it has drawn.

**Checks.**
- `npm test`: `test/enhance.test.js` (the choices' defaults; settings stored before Stage 4; values outside their lists; Original off; each choice away from its default custom, and the four that draw turning `active()` on; the presets keeping or resetting them; a choice keeping the scene unless the path flips; the RENDERING words), `test/store.test.js` (on a minimal IndexedDB of its own with a browser's connection queue, `blocked` told only to the open that upgrades: a version 1 database with relief maps upgraded to version 2, keeping them and gaining `packs` and `art`; a blocking tab making two opens of one turn both give up, later opens fail at once without asking, and the late connections closed; a connection giving way to a newer version; no IndexedDB), `test/geometry.test.js` (the identity maps; scales 2 and 3 with margins up to 120; the margins 53 and 18; the strip's period check; `cosT` at 0, symmetric, its lerp and wrap, a turned table, a changed entry), `test/display.test.js` (the moved lines, the layer forms) and `test/menu-logo.test.js` (CRT AND HUD's new lines, every page list within six).
- `npm run check:identity`: identical against `3f8af9d` in every configuration (A to D, O and O2) and scenario and in reference mode. `npm run check:enhance` passes unchanged.
- Not checked in a browser: CRT LOOK in its new place. The page routes its action as before (`play.js` chooseItem, NONE does nothing without WebGL 2), and the menu tests drive the list to it.

#### M3a: the general paths at 1x

Built 2026-10-07. No picture changes and no new settings. The plan's M3 is split in two. M3a builds the general floor caster, picture blit and composite that every geometry away from the reference will draw with, and proves each one byte for byte against the function it stands in for at the reference geometry. M3b, the artwork packs in the race, follows with the pack milestones (M1, M2), and the packs plug into the seams left here.

**Identity by dispatch.** At the reference geometry (scale 1, no margin) the enhancer still calls today's functions unchanged: `drawFloor`, `layerTemplate`, `blitLayers`, `blitFlatLayers` and `composite`. The general paths run there only when forced, with `createEnhancer({ force: { caster, blit, composite, slow } })`, for the checks. The race draws nothing away from the reference geometry yet (M5, M6), so the general paths reach the screen only through the checks.

**The floor (`src/enhance/caster.js`).** `castFloor(world, camera, mode, fb, G, hooks)` is `drawFloor` for any geometry `G` (`geometry.js`), driven by tables. The output pixel (X, Y) stands for the reference column u = X/s − m and the row v = Y/s.
- **Rays.** In mode 1, the ray is the TRIG pair at the angle h − angleBias + u, read as signed words and lerped between two entries, never renormalized; the entry 1351, which repeats 1350, stays flat. In modes 2 and 3 the column blocks stay, because detail is gameplay (the steering rate and the link's setup bytes) and is never a resolution. The rays of the reference columns 0, step, 2·step… keep `drawFloor`'s own angle sequence, including its reset to `resetTo` past the end of the table. The margins continue the blocks (c = step·floor(floor(u)/step)) with an ordinary wrap. Every output column of a block takes its ray and that column's distances. The heading is whole in modes 2 and 3; in mode 1 it may hold a fraction.
- **Distances.** Down the rows, 1/n is interpolated, which is linear in the screen row on a ground plane: 1/n = (1 − t)/n[kA] + t/n[kA − 1]. The s − 1 rows under row 199 use 1/n[−1] = 2/n[0] − 1/n[1]. Across the columns, 1/n is lerped between floor(u) and the next column. Outside the columns 0..319 (the sub-columns right of 319, and the margins) the distance is continued from the edge column e: n(u) = n[e]·cosT(e − 160)/cosT(u − 160), with `geometry.js`'s TRIG cosine. The forward distance n·cos therefore stays the edge column's, and it is continuous at the edge. At a whole sample (t = 0 and no column weight) the integer NDIST word is read as it is, never 1/(1/n).
- **Depth.** n·VIEW(u)/2^14, where VIEW is lerped inside the table and continued like n outside it. A VIEW word of 0 counts as 1.0, as `floorDepths` has it, and the result is stored as a Float32. At the samples it is `layerTemplate`'s depth exactly.
- **Texel.** floor((vx·n + fx)/2^16) + ix in a 16-bit word, likewise for y. With an integer n and the signed word, the product vx·n is `drawFloor`'s `imul`. Outside the map's cells it is tile 0.
- **Caches.** Per world: the TRIG pairs, NDIST, VIEW and the sheets in one array (WeakMaps). Per world, geometry and detail level: the blocks, and the distance and depth of every floor pixel (rebuilt when the world's VIEW or TRIG table is another one), with the layer template per sky. Per frame, only the ray of each output column is computed: one multiply-add per axis and one lookup per pixel.
- **Hooks.** The liquid and relief hooks of `drawFloor` are called with `drawFloor`'s arguments at the reference samples. A sample is a cell of the output: one ray block's columns by s rows. Its top-left pixel is the sample itself, and the hooks run there.
  - **Liquid.** The other pixels of the cell take the anchor's light when they hold the same liquid. A pixel whose anchor is dry, or holds the other liquid, is shaded on the spot. In the margins the hook's column is the edge column, whose distance tables are the margins'; its sixth argument, the cell's own reference column, gives the sun's glitter and the dither there (M8, the water in the margins below).
  - **Relief.** Each pixel gets the light of its own texel, computed once per texel of the cell. The light depends only on the texel, so the ground's light is blocky per texel, like its texture.
  - **Tiles.** An optional `tile(id, texel, fu, fv, o)` hook may replace the sheet's pixel. `fu` and `fv` are the sample's place inside its texel, the fractions the texel drops. This is the seam for an artwork pack's tiles, and a floor with a tile hook always takes the general path.
- **Dispatch.** `drawFloorAt` and `floorTemplateAt` call `drawFloor` and `layerTemplate` at the reference geometry unless forced.
- **Exact samples.** At a whole-unit camera and a whole heading, the pixel (s(x + m), s·y) is the reference floor's (x, y) at every scale, margin and detail level (unit tests at 2x and 3x, margins 8 to 53).

**The pictures (`src/enhance/blit.js`).**
- **Shapes and class maps.** `shapeOf(world, picture)` finds a picture's .INF shape, size class and class-0 size (W0 × H0, the frame's own) by walking the cars', shots', pit's and objects' shapes. `classMap(picture, s, info)` builds the picture's source map at a scale from `shapeOf`'s answer, cached per picture and scale. A picture asked without its shape gets the blocks map, kept apart from its class maps, so a call without the world never stands in for them later. A picture is separable when src(i, j) = U(i)·H0 + V(j), with U(i) = floor(src(i, 0)/H0) and V(j) = src(0, j) mod H0. Its output pixel (i·s + r, j·s + q) then reads (U(i) + floor(r(U(i+1) − U(i))/s), V(j) + floor(q(V(j+1) − V(j))/s)), with U(w) = W0 and V(h) = H0. At r = q = 0 that is the INF's own byte; between the samples it is the source texels the INF skipped. A picture that is not separable, or not one of the world's shapes, is drawn as s × s blocks of its INF samples. `blockPictures(world, s)` reports the pictures of the world's shapes that are drawn as blocks; a drawn picture outside those shapes is not listed.
- **`blitAt(fb, L, rec, band, G, { world, collect, rows, at })`.** It draws the record's own window of the picture: its columns from `firstColumn`, `width` of them, and `height` rows, which is the reference clip. The place defaults to s·(left + m), s·top; the `at` argument is the seam for the refined places of M6. It clips per pixel to the output. It writes the layers `blitLayers` writes (kind and depth), the relief's list of drawn pixels with the source byte each read, and the flags of the rows it wrote, for the composite's fast path. It returns `blitLayers`' footprint and silhouette in output pixels. `blitFlatAt` draws the after-blits as s × s blocks at s·(x + m), s·y.

**The composite (`compositeAt` in `src/enhance/composite.js`).** This is `composite` for a geometry, beside it; `composite` itself is untouched.
- **Inputs.** The mask is in output pixels; null means none, as for a world composed under the HUD layer. The splats are in output pixels too.
- **Lookups.** Every per-row table (the sky's tint, the far range's and clouds' colours, the strip's flags) is read at the output row's reference row. The covers of the clouds and the far range stay on the reference grid and are read at the pixel's reference cell.
- **Arithmetic.** It does the same arithmetic in the same order, with the same three stores into the clamped bytes: the base, the splats, the grade.
- **The sky-band fast path.** Above scale 1, a reference sky row (0 to 109) whose s output rows hold only the sky's kind, no flagged row (the blit's flags), no splat (the splats' spans, through their row maps) and no overlay pixel is composed once per cell, graded, and copied over its s × s block. The sky, the covers and the per-row tables are one value per cell, so this gives the per-pixel result by construction. `slow` turns the fast path off. At scale 1 a cell is one pixel, so the fast path is not taken. As built in M3a the split screen passed no flags, because its rows are moved and flipped. The flags must be one per output row: fewer throw, since flags of another geometry would let rows with pictures pass as clean. M3a kept them at the reference height and set them only when the blit is forced. M5 keeps them per geometry, sets them whenever the general blit draws, and cuts and mirrors them with the split screen's rows (below).

**Checks.**
- `npm test`: `test/general-paths.test.js`.
  - The caster at the identity equals `drawFloor` on synthetic tables (TRIG with negative components and a repeated entry, a VIEW word of 0, two liquids) at six whole and three fractional cameras, in modes 1 to 3, including the headings that make modes 2 and 3 reset past the end. The picture, the liquid and relief layers, and the hooks' call logs are equal in the same order.
  - Its template equals `layerTemplate`.
  - At 2x and 3x, with margins of 0, 8 and 27, and at 1x with a margin of 53, the samples equal `renderFloor` and the template's depths, and an all-liquid map gives `drawFloor`'s liquid calls.
  - Above 1x, each liquid pixel takes its cell's light or is shaded on the spot, the relief is each pixel's own texel's, and the tile hook replaces or keeps pixels.
  - The class maps return the INF's byte at every sample, and class 0 at 2x is a nearest copy. A skewed picture and an unknown picture fall back to blocks. A picture blitted once at 2x without its world still gets its class map once the world is given.
  - The blit at 1x equals `blitLayers` for eleven pictures (the ten of a synthetic shape and the skewed one, the block fallback) at eight places: cut on the left, right and bottom, above the top, or not cut. The picture, every layer, the footprint, the silhouette, the relief list and the row flags all match. At 2x and 3x the samples are the INF's bytes. The flat blit equals `blitFlatLayers`.
  - `compositeAt` equals `composite` for 256 effect sets on a synthetic 320 × 200 frame with every layer, covering every sky (none, tint, far range, clouds, all, with and without the strip's flags), fog, water with and without the mirror, relief, both grades on and off the track's sky, the shadows, the fade's cap, overlays and splats (one of them flipped).
  - The sky-band fast path equals the per-pixel path at 2x, 3x and 2x with a margin of 8, with pictures over sky rows, splats and overlays. A cell changed under a fast row changes only the per-pixel result, which shows the fast path ran. A pixel of another kind under that row sends it per pixel, and flags of the reference height above 1x throw.
- `npm run check:enhance` section 6 (general paths):
  - **Coverage.** Every scenario, plus the slides demo, the link race's second seat and a race on track 2 at detail level 3, under check:identity's configurations A to D: Enhanced, Enhanced with the dark full atmosphere (relief included), the same with the HUD layers, and smooth motion only. The demos draw at detail level 2 and the races at 1, so the detail-3 race is the floor's mode 3 (four-column blocks) on the archive's own tables; track 2 has water, so B and C run that mode with the liquid and relief hooks.
  - **Draws.** Up to 160 ticks are drawn every other tick at seeded blends, and every fourteenth tick also at the tick itself. The palette is the page's: the demos fade in and the cycled entries show.
  - **Comparison.** Two enhancers draw the same state, one dispatched and one forced. Their picture, index, overlay mask, the eight layers and, in C, the world and HUD layers are compared byte for byte.
  - **Report.** It also reports the pictures of the worlds' shapes the blit would draw as blocks at 2x.
  - **Result.** On the user's archive, 25 scenarios under configurations A to D give 9,100 pictures, each one the dispatched draw's. At 2x every picture of the 17 worlds' shapes is separable, so no picture of the worlds' shapes falls back to blocks. The report covers those shapes only: a drawn picture that is none of them would take blocks without being listed.
  - **It bites.** Three throwaway copies of this tree were run with `--frames 40`, never the repository itself (before the detail-3 race joined, so 96 runs of 24 scenarios under A to D):
    - one red byte of one pixel (row 120, column 160) flipped at the end of `compositeAt` failed 96 of the 96 runs;
    - one floor pixel (row 150, column 160) flipped at the end of `castFloor` failed 96 of 96 (the index and the picture);
    - the general blit's footprint lift one row too high failed 72 of 96. Only the contact shadows (the `shade` layer) changed, so configuration D, which has no shadows, was unaffected. This is the layer comparison catching what the picture alone might hide.
    - The copies were deleted afterwards. The only other problem in those runs was section 1's "no skid mark", which 40 ticks cannot lay.
- `npm run check:identity`: identical against `3f8af9d` (configurations A to D, O and O2, and the reference mode).
- **Time** (node, 2026-10-07, MacBook Air M2, with the machine busy with other work: load averages 5 to 10).
  - **Interleaved A/B.** The base commit's source and this tree were run in alternation over the four attract demos, three rounds of 300 ticks at five pictures a tick, so that the load hits both alike. Means: smooth motion 2.16 ms against 2.10 ms; Enhanced 5.16 against 5.01; Enhanced with a sunset 5.87 against 5.69 (95th percentiles 2.58 / 2.45, 6.57 / 6.47 and 7.27 / 7.15). The dispatched defaults are unchanged within the noise. Enhanced through the forced general paths at 1x measured 5.03 ms (95th percentile 6.42) beside this tree's 5.01: as fast as the dispatched functions.
  - **`check:enhance -- --time`.** It gained the row *general paths 1x*: Enhanced through the forced general paths, 5.43 ms against *Enhanced (all)*'s 4.74 ms in the same run (95th percentiles 6.80 and 7.16). The run's rows moved by up to a millisecond against each other under the load (the sky layers at 3.44 ms, the water at 1.98), so the interleaved run is the one to read.
  - **Section 6's own cost.** Its ok line prints it: 131 s of a 6 min 49 s `check:enhance` under the same load. The run took 3 min 46 s before M3a on a quieter machine.

#### M5: the geometry threaded through, and the 2x spike

Built 2026-10-07. No picture changes: at the defaults every frame is drawn as before (`check:identity`), and no setting reaches another geometry yet. M5 threads the geometry G (`geometry.js`: a whole scale s, m margin columns a side) through every stage of the enhanced draw, so that M6 (2x) and M8 (the wide view) only raise s and m. It also measures what 2x costs, which decides how M6 keeps the soft layers.

**How a geometry is reached.** `drawSingle` and `drawSplit` take a `geometry` in their frame context, IDENTITY by default. Only the checks and `scripts/spike-2x.mjs` pass one; M6 derives it from the settings and the display (RESOLUTION, `worldReady`). At IDENTITY the enhancer runs the code it always ran, with today's functions and arguments. The draw of any other geometry is built beside it. `createEnhancer({ force: { pipeline } })` runs that draw at IDENTITY for the checks.

**The draw at a geometry.**
- **Buffers** (`buffersFor`): the world's indices and layers (G.W x G.H), the blit's row flags (one an output row, set whenever the general blit draws), the RGBA world, the HUD layer (refW x 200), the kinds of the reference samples, a slide's page, and the covers at refW columns. One set, made on the first frame at a geometry, replaced when it changes and released by a frame at the reference geometry; the split screen's two scenes and layer sets are made on its first split frame.
- **The floor:** `castFloor` at G with its template. The relief's light comes from tables made once per map, sun and strength: an interior texel's depends on its tile texel alone, so all are made at once; an edge texel's depends on its place on the map, so each map cell keeps its own, computed the first time it is drawn. The values are the ones computed on the spot (`test/relief.test.js`). The caster walks a cell along its output rows, where neighbours share a texel more often, so the hook is asked about 68,000 times a 2x frame instead of 87,000. At 1x a cell is one row, so nothing changes there.
- **The sky and the strip** (`src/enhance/sky-hd.js`): read at each output pixel's reference cell, so every reference sample is `renderSky`'s and `renderHorizon`'s. The strip's window starts round(offset x 4 x s) / s pixels in, a step of 1/s of a pixel. A demo's slide page is drawn by the page into a 320 x 200 scratch, then enlarged.
- **The records:** `sceneRecords`, refined on the reference grid as at 1x, drawn by `blitAt` at s times their place (the class maps of M3a), and the own car's after-blits as s x s blocks. Finer places, round(s dc) and the unclipped pictures, come with M6 (docs/TODO.md).
- **The pictures' relief** is lit on the reference grid (the 'reference' look decided below, built for the pictures after M5's review). A picture's reference samples, the pixels it drew at a cell's top-left output pixel, are lit as `pictureLight` lights a 1x picture, and every pixel it drew takes its cell's light. At s times its place the 'classes' blit draws the INF's bytes at the samples, so the light there is the 1x light, to the bit (`test/relief.test.js`; on the archive, Enhanced with the dark full atmosphere and the particles off, 2x against 1x at the tick in two demos and three races, every picture pixel's colour at the samples is the same). A pixel whose sample the picture leaves transparent (a skipped texel a class map reads) takes the light of the drawn sample beside it. With a margin (852 x 400, the same probe) a picture is still cut at the reference screen's edge (the records' reference clip, a stand-in until M8), which is not the edge of the wide grid, so that cut gets a rim and the pixels beside it differ from 1x (47 of 53,429 picture pixels in demo 1, next to the reference screen's left and right edges); every other picture pixel is the 1x one. The first version lit the picture at the output resolution with the rounded body and the depth s times as large: its central differences across a doubled texel became one-sided steps of twice the depth, so the light flipped between the ends of RELIEF.range (on the archive, in demo 1, 30,537 of 53,429 picture pixels differed from 1x, by up to 119 of 255).
- **Contact shadows, sun shadows, skid marks and particles** are worked out in the reference picture's terms. A position x becomes s (x + m) and a row y becomes s y, as the last operation on the same expression, so at IDENTITY every number is the one it always was. Specifics:
  - The smallest contact shadow is still a reference pixel's.
  - The sun casts each drawn output column, its heights and widths read with s x pixelsPerUnit, and is softened by a running-sum box blur of SUN.blur x s pixels (`boxBlurCast`: O(1) a pixel, blurCast's within 1e-6).
  - The skid marks keep their four scanlines an output row.
  - The particles are s times their place and radius.
- **The covers** of the clouds and the far range take `{ width: refW, x0: -m }` and stay on the reference grid. Their reference columns are the standard view's to the bit: the clouds' field is carried from column 0 rightward as before, then leftward into a left margin. The clouds' module comment, which called them perspective, now says what they are: a flat scroll.
- **Grade and per-row tables:** `compositeAt` already read every per-row table (the sky's tint, the range's and clouds' colours, the strip's flags) at the output row's reference row, so `grade.js` needed no change.
- **The decimation:** the page's 320 x 200 index takes each reference pixel's sample (`index[i] = fb[G.sample[i]]`), and the kinds with it. The overlays, the overhead map's first-frame capture and the map rectangle's sky rule work on the reference grid, as always.
- **The composite:** `compositeAt` composes the world under the overlays (no mask) with its sky-band fast path. The page's canvas is the reference view: the overlays' pixels from the palette, the others the world's pixel of their sample. With the display's HUD layer, the overlays go into a refW x 200 layer, moved by m; the caller's 320 x 200 layers also get the world's samples and the overlays. Without it, the overlays are stamped into the world as s x s blocks, so the world layer is the whole picture. Pixels are moved as 32-bit words.
- **`layers()`** returns `{ world: { data, w, h }, hud: { data, w, h } or null, logical: { w, h } }`: at a geometry its world (G.W x G.H) and HUD (refW x 200); at IDENTITY the caller's layers, or the canvas alone.
- **The split screen** (`src/enhance/split.js`), never wide:
  - `composeSplitAt` and `flipViewportAt` cut and mirror LAYOUT's rows times s, the row flags with them; at IDENTITY they call `render/versus.js`.
  - The index takes the samples before the overlays mirror an upside-down viewer's half of it, and the world is mirrored at its own rows afterwards.
  - The canvas then reads row s y + s − 1 inside a mirrored band (`geometry.js bandSample`): after the mirror, that row holds the sample row the overlays' own mirror put at y.
  - The particles' rows are mapped at s times the layout.
  - Not built: the plan's row limit for the split viewers (technique 9: each viewer drawn only from row s x viewRow down). Each viewer is drawn whole, its template copy, clears, sky and pictures in the rows the cut throws away included (docs/TODO.md, M6).
- **Margins** (m > 0): only the checks' override reaches them before M8, and some of what they show is a stand-in until then (docs/TODO.md):
  - built now: the strip runs on modulo its period (a file that does not repeat with it throws);
  - stand-ins: the sky's margin columns read the picture's edge column, the records are the reference fan's alone, and the decals beyond the fan keep the pinhole projection.
- **Stage times:** `createEnhancer({ stages })` makes `stats()` report the mean time of each stage (clear, floor, records, contact, sun, blur, marks, decimate, overlays, particles, covers, composite, hud) and the sky rows the composite took on its fast path (`compositeAt`'s `count`).
- **Faster pieces:** `fillQuad` (`raster.js`) works each row only over the columns its scanlines cross; the values are those of its whole box (`test/enhance.test.js` against the old loop). The sun's long, slanted quads made it a fifth of the first 2x draw.

**The HD block (`config.js`).**
- `hooks: 'reference'`: built.
- `castAt: 'output'`: built.
- `look: 'reference'`: the spike's decision below, for M6 to build.
- `budget`: 8 ms mean, 11 ms 95th percentile, 9.5 ms with a sunset.
- `quiet`: the 1x Enhanced draw the budget was set against, 3.65 and 4.61 ms.

Not built, and when they would be: `hooks: 'output'` (the water's shader at every output pixel) would be worth it only if the reference density's lines looked too coarse at 2x. `castAt: 'reference'` is part of the reference look.

**The 2x spike (`node scripts/spike-2x.mjs`).** It draws track 1's attract demo (detail level 2, the floor's two-column blocks; 300 ticks, five pictures a tick) through the enhancer at 1x, at 2x (640 x 400) and at 2x with the margin for 4 BY 3 (`viewMargin('wide', 'dos')` = 53 columns a side, 852 x 400; the brief's "m = 54" would be 856 wide). The rows are interleaved, three rounds in alternating order, so a busy machine slows them alike. Per row it prints the mean, median and 95th percentile of a frame's draw, the stage times and the sky rows on the fast path. Then it times parts apart: the caster with and without the ground's relief, and the blur, running sum against summed. Finally it scales the 2x rows to the quiet machine. The machine was busy in both runs, so only the ratios within a run are read.

Node v26.8.1 on the MacBook Air (Mac14,2, M2), 2026-10-07 at 03:44 to 03:47 (load average 4.8 to 6.4; a second run at 04:03 to 04:10, load 6 to 14, gave the same mean ratio and is quoted under the decision):

| Row | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 1.07 ms | 1.04 ms | 1.21 ms |
| Enhanced 1x | 4.75 ms | 4.60 ms | 5.58 ms |
| Enhanced 2x | 11.48 ms | 10.98 ms | 14.90 ms |
| Enhanced 2x without the sky-band fast path | 13.66 ms | 13.17 ms | 17.21 ms |
| Enhanced 2x, sunset | 13.80 ms | 13.25 ms | 17.31 ms |
| Enhanced 1x, sunset | 5.38 ms | 5.28 ms | 6.28 ms |
| Smooth motion only, 2x | 5.54 ms | 5.44 ms | 6.19 ms |
| Enhanced 2x wide (852 x 400) | 15.81 ms | 14.41 ms | 19.33 ms |

Stage means (ms) of the same run:

| Stage | 1x | 2x | 852 x 400 |
| --- | --- | --- | --- |
| clear (template, layers, sky, strip) | 0.03 | 0.21 | 0.32 |
| floor (caster, water and relief hooks) | 1.21 | 1.96 | 2.81 |
| records (blit, pictures' relief at the output resolution, since moved to the reference grid) | 0.34 | 0.94 | 1.07 |
| contact shadows | 0.02 | 0.08 | 0.08 |
| sun casts | 0.35 | 1.20 | 1.37 |
| sun blur | 0.22 | 0.35 | 0.43 |
| decimation | none | 0.11 | 0.12 |
| overlays and mask | 0.48 | 0.50 | 0.57 |
| particles | 0.05 | 0.05 | 0.07 |
| covers (clouds, range) | 0.83 | 0.84 | 1.26 |
| composite | 1.22 | 4.80 | 7.20 |
| canvas and HUD | inside composite | 0.44 | 0.50 |

The composite took the fast path on all 110 sky rows in every 2x frame; without it the composite took 2.1 ms more.

Parts apart (medians on the demo's track, forty cameras over the map's middle, mode 1):
- The floor: `drawFloor` at 1x 1.08 ms (2.11 with the relief). The table caster: 0.31 ms at 1x (1.56 with the relief), 1.15 at 2x (3.33), 1.42 at 852 x 400 (4.05). Before the relief's tables, the 2x caster with the relief took about 5 to 6 ms. With them and the cell walked along its rows, the relief at 2x costs about twice what it costs at 1x.
- The sun's blur over half the picture, at SUN.blur x 2 pixels: the running sum 0.95 ms against blurCast's sums 3.39 ms at 2x, and 1.23 against 4.48 at 852 x 400.
- Two changes made while measuring:
  - `fillQuad` (the sun's casts) took a fifth of the first 2x draw, until its rows were worked only where they are crossed.
  - Casting the sun from every s-th output column, with lines s pixels wide (an experiment, not kept), took the sun casts from 1.2 to 0.6 ms at 2x.

**The decision: `HD.look` 'reference'.**
- **The ratio.** In both runs the 2x draw took 2.41 times the 1x draw (mean). The 95th percentile ratio was 2.67 in the first run and 2.26 in the second.
- **The budget's ratio.** The budget (8 ms mean, 11 ms 95th percentile) was set against a 1x draw of 3.65 and 4.61 ms, a ratio of 2.19 and 2.39.
- **Scaled to that 1x draw.** 2x takes about 8.8 ms mean and 12.3 ms 95th percentile (10.4 ms in the second run). With a sunset it takes 10.6 ms (12.2 in the second run), against a budget of 9.5.
- **Scaled by the reference renderer.** The reference renderer was 1.12 and 1.40 times its quiet 0.96 ms in the two runs. This scaling also counts the relief, which Stage 3 added to the 1x draw after the budget was set. Scaled by it, 2x takes 10.3 and 10.4 ms mean and 13.4 and 14.0 ms 95th percentile.
- **The look with every layer at the output resolution ('full') misses the budget** on its mean and with a sunset, under either scaling.
- **Where the time goes.** The composite is 4.8 of the 11.5 ms. Its per-pixel work on the floor and the strip has four times the pixels, while the sky rows already go once per cell. The rest is the relief hook (the floor stage), the sun's casts and the pictures.
- **What the plan's toolkit leaves.** The techniques the plan lists for 2x are built, but for three:
  - built: identity by dispatch; the table caster; the sky-band fast path; the covers on the reference grid; the hooks at the reference density and the ground light's tables; the running-sum blur; the class maps per picture and scale; the buffers made per geometry on its first frame; the overlays, the mask and the decimation at 320 x 200 with the HUD stamped per overlay pixel;
  - not built: the dirty-rectangle clears of the soft layers (technique 7; the clears cost about 0.2 ms of the 2x frame), the split viewers drawn only from row s x viewRow (part of technique 9; the spike's demo is a single view) (both docs/TODO.md, M6), and the wide view's cached probes (technique 11, M8). None of them would close the gap.
  The plan's next knob, casting the sun on the reference grid, would save about 1 ms, which still leaves the mean above the budget's ratio and the sunset over. So the budget cannot be met with every soft layer at the output resolution.
- **'reference'.** The soft layers go on the reference grid and are read at each output pixel's reference cell: the contact and sun shadows, the marks, the water's light and the relief's light. This removes their producers' extra cost (about 2 ms of the 2x draw here: the sun's casts and blur, the relief hooks, the clears). It also lets the composite work them out once a cell.
- **Estimate.** Smooth motion only at 2x (5.5 ms), plus the producers at their 1x cost (about 1.5 ms), plus the composite's effects per output pixel (about 1.9 ms) gives about 9 ms here. That is a ratio of about 1.9, or about 7 ms on the quiet machine. M6 builds the look and measures it again, in node and in Chrome. M5 measured only in node; the page's bench in Chrome comes with M6.
- **852 x 400.** 15.8 ms mean, 1.38 times 2x for 1.33 times the pixels (the wide view at 2x is measured and documented; 60 Hz is not promised).

**Checks.**
- `npm test`:
  - `test/geometry.test.js`: colRef and rowRef at every scale and margin; the identity's band map; `composeSplitAt` and `flipViewportAt` equal `composeSplit` and `flipViewport` at 1x, forced and dispatched; the row flags (always the general code) cut at 1x and mirrored at 1x, 2x and 3x as the rows they flag; at 2x and 3x the cut's samples are `composeSplit` of the inputs' samples, and the mirror read through `bandSample` is `flipViewport` of the samples; the running-sum blur within 1e-6 of `blurCast` and of a brute-force box at radii 1 to 3, up to the picture's edges.
  - `test/sky-water.test.js`: the covers at x0 = 0 equal copies of the covers before Stage 4; a wide cover's reference columns equal the standard one's at margins of 18, 53 and 120; the sky and the strip at 1x to 3x and margins of 18 and 53: every sample is `renderSky`'s and `renderHorizon`'s, a cell's rows are copies, the strip's window in 1/s steps and modulo its period in a margin, a strip that does not repeat throws with a margin, a slide's page enlarged.
  - `test/relief.test.js`: the ground light's tables equal the light on the spot for 6,000 texels of the map and its padding, and for 3,000 texels at another strength, another sun and the first again (a ground keeps only its latest tables); a picture's light at 2x and 3x, nearest copies of a picture with holes on grids of 320 and 426 columns, in the middle and cut by each side, with and without a map of the player's, is the 1x light in every pixel of each cell; a pixel whose sample is transparent takes its neighbour's.
  - `test/enhance.test.js`: `fillQuad` equals the old whole-box loop on 400 quads; at 2x a contact shadow's place and size and the particles are the reference ones s times over (the margin's column added at 852 x 400), the contact shadow's ellipse has s² times the pixels (within a tenth) and the same darkness a reference pixel (within 5%), and the sun casts and the skid marks cover between 3 and 5 times the 1x area, the casts' box within 2 to 3 pixels of s times the 1x box.
  - `test/general-paths.test.js`: the fast path's row count.
- `npm run check:enhance`:
  - Section 6 forces the draw of a geometry too (`pipeline`). Since M5's review it also draws the split screen with its viewers upside down now and then (the first every fourth drawn tick, the second every sixth, both at once some), so the general mirror (`flipViewportAt` forced, the canvas's band map, the splats' rows) is compared with the dispatched one. 26 scenarios under configurations A to D give 9,464 pictures, each the dispatched draw's: the picture, the index, the mask, every layer, and in C the world and HUD layers. It bites: a throwaway copy of the tree without the forced mirror of the layers, run with `--frames 40`, failed the upside-down split screen in all four configurations from its first drawn tick (the layers, and the picture in A to C); 6b, which compares only the index and the canvas, passed it.
  - The new section 6b draws at 640 x 400 and at 852 x 400 (the margin for 4 BY 3) with smooth motion only, at the tick. In 1,081 pictures the index is the reference renderer's picture and the canvas its colours, and every draw was the size of its geometry. It covers every scenario, the slides, the link race's second seat and the split screen with an upside-down half. The split screen is never wide, so it is not drawn at 852 x 400.
- `npm run check:identity`: identical against `3f8af9d` (configurations A to D, O and O2 over the ten scenarios, the HUD layers and the split screen included, its first viewer drawn upside down every fifth tick and the second every seventh, and the reference mode's 42 tracks). The forced flips came with M5's review: before them no split-screen frame of the gate had a car upside down, and a copy of the tree without the enhancer's flip of the world's layers at the reference geometry passed it. With them that copy's hashes differ from this tree's in configurations A, B and C (the split screen's picture from its third picture on, and C's world layer); D (smooth motion only, no effect reads the layers) and O and O2 (the reference renderer) stay equal, as they should.
- **Time at the defaults** (node, 2026-10-07, the machine busy with other work: load averages 7 to 29):
  - **Two runs interleaved by configuration** (the pre-M5 tree against this one, the four attract demos, five pictures a tick). The first ranged from 3% faster (Enhanced, 5.65 against 5.83 ms) to 8% slower (smooth motion, 2.19 against 2.02 ms) in its means. In the second, Enhanced (all) was 23.5% slower on the mean (6.99 against 5.66 ms, 95th percentiles 13.15 against 8.04) during a burst of load (load average 28.9 at its end), and its other rows were within 0.4%. Neither can tell 5% apart.
  - **Interleaved per picture** (a script of the Stage 4 job, not committed: `~/.claude/jobs/2b4fea78/tmp/m5-gate/abfine.mjs`, its output kept beside it as `abfine.log`). The pre-M5 tree and this one, after M5's review, each drew their own copy of each demo, alternately, picture by picture, 5,580 pictures a row each, at load 7.7 to 9.7. The medians of this tree's time over the base's, picture by picture, were 0.999 for smooth motion, 0.983 for Enhanced and 0.984 with a sunset; the means 1.98 against 1.98 ms, 5.27 against 5.41 ms and 6.04 against 6.15 ms. The review's own run of the same script before the fixes (`abfine-review.log`, at load 20 to 127) gave 0.999, 0.983 and 0.987. The defaults are as fast as before, a little faster where `fillQuad` no longer works the whole box of a sun cast.
  - **The clouds.** A first version carried the clouds' field through a function a pixel and took the cover from 0.25 to 0.38 ms. The columns from 0 rightward are now the old loop again (0.287 against 0.288 ms, interleaved), and only a left margin goes through the function.
  - **`check:enhance -- --time`** (load 6 to 17) measured these rows: the reference renderer 1.15 ms; smooth motion 2.15 ms; Enhanced 5.86 ms (95th percentile 9.92); Enhanced with a sunset 5.30 ms; the forced general paths at 1x 4.81 ms. A sunset below Enhanced alone says how far the load moved the rows against each other. The interleaved run above is the one to read.

#### M6: 2x, with the original's stepped sizes in the standard view

Built 2026-10-07. RESOLUTION 2X draws the race world with twice the original's samples each way (640 x 400), the HUD and every other screen at their own 320 x 200 pixels. At the defaults (RESOLUTION 1X) nothing changes: `check:identity` is identical against `3f8af9d`. The view stays the standard one (the wide view is M8) and the sprites keep the game's ten size classes (smooth sizes are M7).

**The setting and how a frame reaches its geometry.**
- RENDER's `scale` (1 or 2) is live. The game menu has it under GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS > RENDERING, on its first line: RESOLUTION 1X, 2X, or NONE where the browser has no WebGL 2 (Enter does nothing then). This milestone's RENDERING list holds RESOLUTION and LEAVE THIS MENU; the other lines come with their milestones. DISPLAY OPTIONS is now full at six lines: SCALING, ASPECT, FULL SCREEN, CRT AND HUD, RENDERING, LEAVE THIS MENU. The menu's line names live in `src/game/display-menu.js`, beside the names of its other lines, and a test holds them equal to `config.js` RENDER_MENU's; the words come from `menuView(settings, { worldReady })`.
- The page's Graphics panel has a Rendering group. It holds a Resolution select (disabled without WebGL 2, the stored value kept), a readout and a hint. The readout reads 'World 640 x 400, HUD 320 x 200, draw N ms' (or 'HUD in the picture') with the stage times (the page's enhancer is made with `stages`). The hint appears while the scale is above 1 and the mean over the last 120 frames (`stats().window`) is longer than `RENDER.budgetMs` (12 ms): '2x draws in N ms here, slower than a 60 Hz frame: 1x is recommended'. The page never changes a setting itself.
- **The frame context.** `drawSingle` and `drawSplit` take `{ worldReady, aspect, wideAllowed }`. The geometry is the settings' scale when `worldReady`, else 1x; the `geometry` override stays for the checks and the spike. The page passes `display.worldReady()` (the graphics card draws and its context is not lost), and the previews and the checks pass true, since they show the RGBA world themselves. `aspect` and `wideAllowed` (false in a link race and a slides demo) are passed already and take effect with the wide view (M8); until then the margin is 0.
- **No deadlock.** The page tells the display the stored scale (`display.setRendering({ scale })`) before its first layout and on every change. While the scale is above 1 the display never uses the page as it was ('plain': square pixels, fit, no CRT look, the HUD in the picture), so the graphics card starts even from plain display settings and `worldReady` can become true. Without WebGL 2 the display falls back to the page as it was, or to the browser's scaling, and the world is drawn at 1x.

**The draw at 2x** (`renderEnhancedScene` at G = 2x, `scene.js`).
- **The floor** is the table caster (M3a) at s = 2. With smooth motion, in detail mode 1, the camera's heading is the blend's rounded to half an entry: round(2h)/2 (`fineHeading`). The floor then turns one output column at a time, and the pictures follow it through the lerped heading vector (`project.js headingVectorAt`). In modes 2 and 3 the heading stays whole and the column blocks stay, because the detail level is gameplay. At the tick, or without smooth motion, the heading is the tick's.
- **The sky and the strip** are drawn at s (M5's `sky-hd.js`), with a slide page enlarged.
- **The records.** Each record is drawn whole at its finer place (`placeAt`): s times the whole camera's place (the unclipped picture's left and top) plus round(s dc) and round(s db), where dc and db are refine's unrounded shifts between the fine and the whole projections. The picture is cut per pixel at the screen's edges, so at a whole place the drawn pixels are the reference window's, s times over. The blit (`blitAt`) counts the footprint and the silhouette only on the output's columns and above its last row, as `blitLayers` counts the reference window, so a picture cut by the screen keeps the shadow of what the screen shows. The own car is not refined: it stands at s times its place, with its after-blits as s x s blocks at the state's 320 x 200 places (the tyre rows, the pit overlay, and the crash, hop and jiggle rows in its record), taken s times and never recomputed.
- **The pictures' 'classes' blit** is M3a's class maps: at r = q = 0 the INF's own bytes, between them the source texels the INF skipped.

**The reference look** (`HD.look` 'reference', M5's decision, now built).
- **On the reference grid.** The contact shadows, the sun shadows (blurred by `blurCast` as at 1x), the skid marks (`marks.stamp` on the grid { s: 1, m }, with no kinds) and the ground's relief light are kept in soft layers at refW x 200 (`createSoftLayers`). They are drawn there exactly as at 1x. `compositeAt`'s `soft` reads them at each output pixel's reference cell.
- **What feeds them.** The shadows come from the pictures' reference samples (`blitAt`'s `sample`: the footprint and the silhouette of the picture's samples, at the place over s), so at a whole place they are the 1x shadows. The ground light is lit once a cell, at its sample, into the reference cells of its block (`castFloor`'s `relief.ref`), which at a whole heading is `drawFloor`'s own relief layer (`test/stage4-floor.test.js`).
- **What stays at the output's resolution.**
  - The pictures' relief light (`pictureLight` above 1x lights them on the reference grid, M5).
  - The water. Its light is worked out once a reference cell (`HD.hooks` 'reference'), but kept per output pixel. The layer `wet` marks the liquid's edge along the texels at the output resolution, and a pixel whose cell's sample is dry, or holds the other liquid, is shaded on the spot.
- **The visual difference against 'full'** (every soft layer at the output resolution, M5's draw, kept for comparison: `createEnhancer({ look: 'full' })`). In 'reference' the shadows, the marks and the ground's light are the 1x layers enlarged: their edges step by two output pixels, as the 1x picture's do. The floor's texels, the sky, the strip and the pictures still have every output pixel's own sample, so a shadow's edge can cross a texel. Near the camera a texel covers several reference cells, so the ground light still follows the texture. Far away a cell covers several texels and takes its sample's light, as at 1x. 'full' draws the shadows' and marks' edges at the output resolution and lights each texel, at the cost measured below.
- **Clears.** In the reference look the output's shade, cast and mark layers are neither cleared nor read; only the reference grid's are cleared.

**The split screen at 2x.** Each viewer is drawn from s times its first row (LAYOUT's viewRow 100; `opts.from`, `blitAt`'s and `blitFlatAt`'s `from`). The template copy, the clears, the sky and the pictures' writes start there, and the footprints are found as before. A picture across that row is still lit as a whole: `blitAt` lists its pixels above the row for the relief alone (writing nothing there), and `pictureLight` reads their indices from the picture's frame by their source bytes, since the viewer's buffer holds the last frame's pixels there. So its light below the row is the 1x split screen's, which lights each viewer's picture whole before the cut. Before M6's review the light took the row as the picture's top edge, and a light rim ran along it. The reference look's soft layers are drawn per viewer on the reference grid, then cut and mirrored there (`render/versus.js composeSplit` and `flipViewport` on the reference grid). The output's layers are cut and mirrored at s times the rows (M5).

**The display** (`display.js`).
- **Textures.** They are sized per layer. The picture and the glow's two passes are at the world's size, and the HUD's three at its size, twice and four times it (`textureSizes`). A frame of another size makes them again (texImage2D); a frame of the same size replaces their pixels (texSubImage2D).
- **The CRT look.** The final pass draws one scanline beam per logical row (`uLines` = 200 at any resolution), and `crtUniforms` fades the scanlines by the picture's rows on the screen over its logical rows. The glow's radius and taps are in the world's pixels: `CRT.glow.radius` x 2 and twice the taps at 2x, the same halo.
- **Placing the picture.** `pictureRect(width, height, settings, logical, grid)` takes the frame's logical size: the ratio is the shape's at 320 columns, and wider by its columns for a wider picture (M8). While the stored scale is above 1, integer scaling counts whole multiples of s x 200 screen rows, so each 2x row is whole too. On a 1080-row screen that is 800 rows instead of 1000, the menus included.
- **What the page hands over.**
  - At 2x it passes `enh.layers()` in every HUD setting: the world with the HUD stamped in as 2 x 2 blocks for 'picture', or the world and the HUD layer.
  - A frame with a HUD layer while the HUD is set to be in the picture shows the canvas instead.
  - The other screens are the 320 x 200 canvas, and the textures go back to its size.
- **Reports.** `worldReady()` is mode 'gl' and a ready context. `stats()` reports the world's and the HUD's sizes and the logical size. The close-up reads the GL canvas, as before.

**The page** (`src/play.js`).
- **The race frames.** `drawEnhanced` passes the frame context and shows `enh.layers()` whenever the world was drawn at another size (`frameLayers`); otherwise it shows the canvas, or its HUD layers, as before.
- **The screens over a race's last frame.** `snapshotScreen` keeps a copy of the last frame's 2x layers (`enh.keepLayers()`), but only when the last picture shown was an enhanced race frame. The menu of a lost race draws its overlay over it with `enh.drawOver({ kept, hudLayer })`: the overlay goes into the HUD layer, over the frame's own HUD, or is stamped into a copy of the world as s x s blocks.
- **The loading card does not follow a race frame** (corrected in M6's review). The plan's gap 11 assumed a card after an Enhanced race, but in the page's flow every card follows another screen: the next race's card follows the leaderboard, a cup's first card the cup board or the menu, a time trial's card the hall of fame, a restored game's card the menu, the bonus race's card its notice, and the attract mode's card the main menu or the title picture. A race ends in the leaderboard, the retry menu, the cup board or the menu, never in a card. So the card's snapshot never holds an enhanced picture, and it draws as before (the snapshot's index in its palette). `drawCard` keeps the branch that draws the banner over a kept enhanced picture (as the retry menu does), for a path that would show a card straight after a race; none does today.
- **The Rendering readout** says 'Resolution: none' (since M8 'Resolution and view: none') without WebGL 2 in the race too (the readout follows it), and the budget hint goes by the size the world was drawn at (`layers()`: its rows over the logical 200), not the stored resolution, so a stored 2x drawn at 1x gives no hint.
- **What reads the 320 x 200 index.** `wackyDebug`, `tools/link-frames.html`, the overhead map's first-frame capture and the map rectangle's sky rule keep reading it: the reference view's samples. `wackyDebug.enh.layers()` and `wackyDebug.display.stats()` show the 2x world for the checks in Chrome.

**The previews.**
- The garage's race view has a Resolution select (1x, 2x).
- At 2x it shows the Original at 320 x 200 enlarged twice, nearest, beside the Enhanced picture at 640 x 400, at the same displayed size. 'Use these in the game' stores the resolution with the rest, and 'Load the game's' reads it back.
- `createRacePreview().draw` returns the Enhanced picture as drawn (`world`, `w`, `h`) beside its 320 x 200 reference view.
- The track editor's atmosphere preview stays 1x: it draws the Enhanced preset with the stored sizes, artwork and angles and the default scale.

**Checks.**
- **`npm test`:**
  - **`test/stage4-floor.test.js`:**
    - At 2x and 3x, whole cameras and headings, and modes 1 to 3: the samples of the floor, the sky and the strip are `renderFloor`'s, `renderSky`'s and `renderHorizon`'s.
    - The reference look's ground light is `drawFloor`'s relief layer, and the liquids' samples are `drawFloor`'s.
    - `fineHeading`.
    - The reference look's composite is the composite of its soft layers enlarged nearest (the ground's light at the cell, the pictures' at the pixel), with and without the sky-band fast path.
  - **`test/stage4-blit.test.js`:**
    - The whole picture at s times a whole place, cut per pixel, is the reference window s times over: its pixels, layers, footprint and silhouette at eight places, cut on every side.
    - At fine places the samples are the INF's bytes.
    - A split viewer's first row: nothing written above it, and the footprint unchanged.
    - A picture across a split viewer's first row is lit as a whole, as at 1x before the cut: its light below the row is the light of the whole picture (M6's review found a rim of light along that row before).
    - The reference look's contact shadow and sun cast, from the picture's samples, are the 1x ones.
    - `placeAt` is within half an output pixel of the fine place.
    - The running-sum blur is within 1e-6 of `blurCast`.
    - `drawOver` over kept layers.
  - **`test/display.test.js`:**
    - The textures are made again on a size change and kept otherwise.
    - `uLines` is 200 at 2x, and the glow is at the world's scale.
    - The ratio is unchanged at 320.
    - Integer scaling works on the 400-row grid.
    - The page as it was is never used at 2x, and `setRendering` starts the graphics card from plain settings.
    - Without WebGL 2 the page stays as it was and RESOLUTION says NONE.
    - The RENDERING list and its names.
  - **`test/menu-logo.test.js`** reaches 'rendering', and every page list keeps to six lines.
- **`npm run check:enhance`:**
  - Section 1 switches between 1x and 2x mid-run (Enhanced at 2x, smooth motion only at 2x, a custom 2x), and the state hashes stay equal. Its seven settings changes come every frames / 8 ticks (62 in the default run of 500), so a run applies every one of them, Original's reference renderer back to the enhanced path among them; a run that goes past the last change and missed one, or that never came back from the reference renderer, fails. (Before M6's review the changes came every 97 ticks, and the last two of the seven were never reached.)
  - Every draw is the size its scale asks for.
  - The `--time` rows have 2x (below).
  - `--only` runs some sections for a quick look; the gate is the run of every section.
- **Section 9** (2x through the settings, at the tick: every scenario, the slides demo, the link race's second seat and the split screen with an upside-down half; each draw asserted at 640 x 400):
  - With smooth motion only, the index is the reference renderer's picture and the canvas its colours. The HUD layer holds exactly the overlay pixels, in the reference picture's colours.
  - **G1b**, with a sunset grade, the sky's layers (clouds 0.9, mountains at full range), the ground's relief and the water at full strength:
    - Every sample of the world that is no picture and no overlay is the 1x Enhanced picture's.
    - The particles are off, because their discs are drawn at the output resolution.
    - The plan's G1b leaves out the pixels under a shadow or a mark. In the reference look the soft layers are the 1x layers, so the check holds those to the 1x colour too.
    - With the relief off, the pictures' pixels are the 1x picture's too.
  - **The result** (the full run, `check:enhance` 22 scenarios, 0 problems):
    - 25 scenarios gave 575 pictures at the tick, each 640 x 400.
    - The index, the canvas and the HUD layer were the reference renderer's (3,833,186 overlay pixels).
    - 63,308,757 samples of the world were the 1x Enhanced picture's.
    - Of the pixels left out, the 1,467,458 under a shadow or a mark were the 1x colour too, as the reference look's soft layers must be. So were all 1,157,413 picture pixels with the relief on (the pictures' relief, lit on the reference grid, is the 1x light at the samples).
    - In section 1 every one of the 22 scenarios (500 ticks each) applied all seven settings changes and drew worlds 320 and 640 wide, with the same state as without a draw. The run after M6's review (the rim fix and the new cadence) gave the same section 9 counts.
  - **It bites.** Two throwaway copies of the tree were run with `--only 9`, then deleted:
    - every record placed one output pixel to the right failed all 25 scenarios at their first sample (the index);
    - the reference look's contact shadows stamped one reference column to the right failed all 25 at their first sample, on a shadowed pixel that is not the 1x colour.
- `npm run check:identity`: identical against `3f8af9d` (configurations A to D, N, O and O2, the reference mode). Since M6's review A to D draw with the frame context the page passes where its display can show a world of another size (`worldReady` true, the display's default shape, `wideAllowed` but in a link race and a slides demo), so the gate hashes the page's call; before, they drew with `worldReady` false, and a copy of the tree that drew the default Enhanced at 2x whenever `worldReady` passed it. With the context that copy differs in A to D (`--ticks 30 --mode enhanced`: 28 differences; the split screen and the link race did not differ in those 30 ticks, likely because they were still in their countdown). N stores RESOLUTION 2X and draws with `worldReady` false, as the page without WebGL 2: the 1x world, A's pictures (the base commit drops the unknown setting).

**Time** (node v26.8.1 on the MacBook Air, Mac14,2, M2, 2026-10-07). `scripts/spike-2x.mjs` interleaves its rows (three rounds in alternating order over track 1's attract demo, 300 ticks, five pictures a tick), and only the ratios within a run are read. Two runs were made. The first (09:11) ran at a load average of about 213: the reference renderer took 5.94 ms against its quiet 0.96, so every absolute time was several times a quiet machine's. The tables below are the second and much quieter run (10:36, load average 4.9, 10.3 and 26.4), where the reference renderer took 1.84 ms.

| Row (spike) | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 1.84 ms | 1.73 ms | 2.42 ms |
| Enhanced 1x | 7.57 ms | 7.24 ms | 10.24 ms |
| Enhanced 2x (the reference look) | 15.63 ms | 15.24 ms | 19.79 ms |
| Enhanced 2x, 'full' | 18.36 ms | 17.53 ms | 24.76 ms |
| Enhanced 2x without the sky-band fast path | 21.91 ms | 19.05 ms | 32.85 ms |
| Enhanced 2x, sunset | 28.49 ms | 20.48 ms | 71.53 ms |
| Enhanced 2x, sunset, 'full' | 28.93 ms | 21.42 ms | 78.17 ms |
| Enhanced 1x, sunset | 12.88 ms | 7.59 ms | 41.17 ms |
| Smooth motion only, 2x | 8.85 ms | 8.60 ms | 11.01 ms |
| Enhanced 2x with the margin of 4 BY 3 (852 x 400) | 19.02 ms | 18.14 ms | 25.76 ms |

Stage means (ms) of the same run:

| Stage | 1x | 2x | 2x 'full' |
| --- | --- | --- | --- |
| clear | 0.07 | 0.32 | 0.35 |
| floor (caster, water and relief hooks) | 2.11 | 2.65 | 3.60 |
| records (blit, pictures' relief) | 0.65 | 1.07 | 1.04 |
| contact shadows | 0.04 | 0.04 | 0.15 |
| sun casts | 0.62 | 0.56 | 1.97 |
| sun blur | 0.37 | 0.36 | 0.60 |
| decimation | none | 0.17 | 0.17 |
| overlays and mask | 0.86 | 0.85 | 0.88 |
| covers (clouds, range) | 0.58 | 0.55 | 0.56 |
| composite | 2.18 | 8.26 | 8.24 |
| canvas and HUD | inside composite | 0.71 | 0.72 |

**Reading the spike.**
- **The ratio.** With the reference look, 2x took 2.06 times the 1x draw on the mean and 1.93 times on the 95th percentile. With 'full' it took 2.42 and 2.42 (M5 measured 'full' at 2.41). The busy run gave 2.11 and 1.86, and 2.51 and 2.20.
- **Against the budget.** Scaled to the 1x draw the budget was set against (3.65 and 4.61 ms), the reference look takes about 7.5 ms mean and 8.9 ms 95th percentile, within the budget of 8 and 11 ms. 'full' takes about 8.8 and 11.1 ms, just over both. Scaled by this run's reference renderer instead (1.92 times its quiet 0.96 ms), the reference look takes 8.1 ms mean and 10.3 ms 95th percentile, so its mean is just over the budget. A third run on a quiet machine (below) puts the reference look over the budget on all three figures.
- **What the reference look saves.** Its soft layers cost what they cost at 1x: the sun's casts 0.56 ms against 1.97, the blur 0.36 against 0.60, the contact shadows 0.04 against 0.15. The floor costs 2.65 ms against 3.60, because the ground's light is asked once a cell (the caster alone at 2x: 2.06 ms, and 5.00 ms with the per-texel light).
- **Where the rest goes.** The composite is about half of the 2x draw: 8.3 of 15.6 ms, 3.8 times its 1x time, for four times the pixels with the sky rows on the fast path. Its per-pixel work on the floor and the strip is what a GPU renderer (Stage 5) would take over.
- **With a sunset.** The sunset grade's lighting more than doubles the composite (17.3 ms at 2x, 5.0 at 1x). Scaled to the budget's 1x draw, the reference look's sunset row is 13.7 ms (the spike's figure, from the means; 14.8 ms scaled by the reference renderer), against a budget of 9.5 ms. Even the medians alone (20.48 against 7.24 ms, a ratio of 2.83, worked out here, not a row the spike prints) would put it at 10.3 ms, still over. Both sunset rows have long tails in this run (2x: 95th percentile 71.5 ms against a median of 20.5; 1x: 41.2 against 7.6), so part of the mean is the machine's other work. 'full' with a sunset (28.93 ms) is above the reference look's (28.49), as it should be; the busy run had them the other way round. Either way, 2x with a sunset grade may drop frames. The panel's hint says so on the player's machine, and docs/TODO.md keeps the measurement on a quiet machine and in Chrome open.
- **Not measured.** Chrome's draw and the display pass at 2x, which the main session's Chrome check records.

**A third run, on a quiet machine** (12:18, at M6's final gate: load average 4.0, 4.4 and 10.1). The reference renderer took 0.91 ms against its quiet 0.96, and Enhanced 1x 3.51 ms against the budget's 3.65, so these times are a quiet machine's own and need no scaling:

| Row (spike) | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 0.91 ms | 0.95 ms | 1.04 ms |
| Enhanced 1x | 3.51 ms | 3.46 ms | 4.34 ms |
| Enhanced 2x (the reference look) | 8.94 ms | 8.06 ms | 12.13 ms |
| Enhanced 2x, 'full' | 10.38 ms | 9.77 ms | 14.56 ms |
| Enhanced 2x without the sky-band fast path | 10.75 ms | 10.46 ms | 12.73 ms |
| Enhanced 2x, sunset | 10.70 ms | 10.48 ms | 12.38 ms |
| Enhanced 2x, sunset, 'full' | 12.10 ms | 11.61 ms | 15.05 ms |
| Enhanced 1x, sunset | 4.81 ms | 4.66 ms | 5.76 ms |
| Smooth motion only, 2x | 5.45 ms | 5.27 ms | 6.38 ms |
| Enhanced 2x with the margin of 4 BY 3 (852 x 400) | 11.21 ms | 10.90 ms | 13.18 ms |

- **The ratio.** With the reference look 2x took 2.54 times the 1x draw on the mean and 2.79 times on the 95th percentile ('full': 2.95 and 3.35), more than the busier runs' 2.06 and 1.93. Why is not settled: the load may have slowed the 1x draw more than its share, or M6's review changes after the 10:36 run may cost more at 2x; neither was measured apart.
- **Against the budget.** Scaled to the budget's 1x draw, the reference look takes about 9.3 ms mean, 12.9 ms 95th percentile and 11.1 ms with a sunset, over the budget of 8, 11 and 9.5 ms on all three (the spike's verdict: 'over the budget'); 'full' takes 10.8, 15.5 and 12.6 ms. The reference look is still the cheaper look, so the decision stands, but the 'within the budget' of the second run came from a busy machine's ratio: on a quiet machine 2x misses the budget with the default atmosphere too.
- **Its stages.** The composite is 4.79 of the 8.94 ms (1.03 ms at 1x, 4.65 times), and 6.63 ms with a sunset; the floor 1.47 ms (1.00 at 1x). The soft layers cost what they cost at 1x (the sun's casts 0.32 ms against 1.17 in 'full').
- **So 2x may drop frames, with any atmosphere.** At about 1.5 times node's time in Chrome (the budget's own assumption, not measured here), 2x would take about 13 ms with the default atmosphere and 16 ms with a sunset, near a 60 Hz frame of 16.7 ms before the display's pass, and over the panel's hint threshold (`RENDER.budgetMs`, 12 ms), so the hint would likely show at 2x on this machine. The page's bench in Chrome (docs/TODO.md) decides; a cheaper composite (half the 2x draw) is the way to bring 2x within the budget.

**`check:enhance -- --time`** gained the rows *smooth only 2x*, *Enhanced 2x*, *Enhanced 2x sunset*, *Enhanced 2x full* and *Enhanced 2x sunset full*. Each draw is checked to be the size its scale asks for. Its rows run one after the other, not interleaved. A short run (`--only none --time --frames 30`, at a load of 147 to 262) measured the reference renderer at 12.41 ms mean (quiet: 0.96) and Enhanced at 77.14 ms. The 2x rows read 66.15 (smooth only), 178.70, 220.15 (sunset), 182.48 ('full') and 221.07 ms ('full', sunset), against 1x sunset rows of 159.20 ms, so the load swamped the effects themselves. The rows run, and the interleaved spike above is the measurement to read. On the quiet machine at M6's final gate (12:24, `--only none --time --frames 100`, load average 3.3, 4.2 and 9.8; all four attract demos, one row after the other) they read: the reference renderer 0.76 ms mean, Enhanced (all) 4.14 ms (95th percentile 4.60), Enhanced, sunset 5.15 ms, smooth only 2x 7.95 ms (9.06), Enhanced 2x 13.10 ms (15.40), Enhanced 2x sunset 14.98 ms (16.64), Enhanced 2x full 16.16 ms (19.60) and Enhanced 2x sunset full 18.30 ms (21.68). That is 3.16 times the 1x draw for Enhanced 2x and 2.91 with a sunset, more than the spike's interleaved 2.54 over track 1's demo alone; scaled to the budget's 1x draw (3.65 ms), Enhanced 2x takes about 11.5 ms mean, over the budget of 8. Every draw was the size its scale asks for.

#### M7: smooth sprite sizes

Built 2026-10-07. SPRITE SIZES SMOOTH draws the karts, the ducks, the scenery, the starter and the shots at sizes between the game's ten size classes, so a thing grows and shrinks without steps, and stands each of them on the floor's own row of its distance down to the row 131 the game stands its far things on, where the row table stands everything from a distance of 800 to 1122 on that one row. It works at any resolution and in either view, and needs no WebGL 2 (the world keeps its size). At the defaults (SPRITE SIZES STEPPED) nothing changes: `check:identity` is identical against `3f8af9d`.

**The setting.**
- RENDER's `sizes` ('classes', the default, or 'smooth') is live. The game menu has it under DISPLAY OPTIONS > RENDERING on the third line, SPRITE SIZES STEPPED or SMOOTH (STEPPED fills the bar's 20 characters exactly); it never says NONE, since it draws at 1x too. The list is RESOLUTION, VIEW, SPRITE SIZES and LEAVE THIS MENU; KART ANGLES and ARTWORK come with their milestones.
- The panel's Rendering group has a Sprite sizes select ('Stepped, as the original', 'Smooth'), never disabled; the garage's race view has another, stored with the rest by 'Use these in the game'. The track editor's atmosphere view already draws with the stored sizes (M0).
- Original's switches with smooth sizes are CUSTOM and draw through the enhanced path (`renderActive`); changing the sizes keeps the scene unless the path comes on or goes off with it (M0).

**The size law** (`blit.js smoothSize`). The game sizes a thing by the class trunc((d − 124) / 70), clamped to 0..9 (`view.js projectPoint`): ten steps of the .INF shape's pictures. Smooth sizes take each class k to stand for the middle of its band, d_k = 124 + 70 (k + 1/2), that is 159, 229, ... 789, where the width and the height are the class's own; between two band middles they go linearly from one class's to the next, before the first middle and past the last they stay the first class's and the last's. This is the game's own law, which is not a perspective (a perspective would make far things up to 2.6 times smaller), without its steps; no fitted rate a class is used. The picture is Wout = max(1, round(s w(d))) by Hout = max(1, round(s h(d))) output pixels at the record's fine distance.

**The pictures** (`blit.js smoothMap`, `blitAt`). A smooth picture is its whole frame (the shape's class 0 size, W0 x H0, the bytes every class reads through its .INF offsets) drawn at Wout x Hout: the output pixel (I, J) reads the texel nearest its middle, U = floor((I + 1/2) W0 / Wout) and V = floor((J + 1/2) H0 / Hout), nearest and symmetric, so at the class 0 size it is the frame itself and nothing is blended. The map depends on those four sizes alone, so the maps are kept by them rather than by shape (the plan's key; the same maps, shared by the shapes of one frame size), in a list of the 256 last used (`SIZES.maps`). `blitAt` draws it like any other record (the pixels, the kinds and depths, the footprint and silhouette, the relief's list, the row flags), cut per pixel at the output's edges. Its reference samples (the shadows of the reference look) are its output pixels s i, s j from its top left, ceil(Wout / s) x ceil(Hout / s) of them: a smooth picture has no INF samples to keep, so they are the picture as the reference grid sees it.

**The floor's own rows** (`geometry.js rowOfDepth`). The floor draws the depth D(k) = NDIST[160][k] VIEW[160] / 2^14 on the row 199 − k of its centre column. Between two samples the row goes linearly in 1/d, as a ground plane's screen row does: k_f = k + (1/D(k) − 1/d) / (1/D(k) − 1/D(k + 1)), row = 199 − k_f. So at the sample depths it is the floor's rows themselves (on track 1 of the maintainer's archive the row table gives the same rows at those depths, but for row 130, which it maps to 131), and it is continuous and strictly decreasing. Beyond either end it goes on linearly in 1/d along the chord of the whole table, from (1/D(0), 199) to (1/D(69), 130). The plan said only "linear in 1/d"; the end segments alone would carry NDIST's whole-unit rounding (D(0) = 115 and D(1) = 116 on the archive, so the first segment would stand a thing at the distance 80 on row 249.75, where the row table has 233), while the chord gives 233.24. On the maintainer's archive the floor's rows are within 0.983 rows of the row table at every whole distance from 80 to 799 on all 42 tracks; past that the table's plateau (row 131 from 800 to 1122: its rounded b is 22 from 800 and 21 from 838, and from 879 on it would round lower and is clamped to 21, `rowMinimum`) becomes the floor's 132.0 to 128.8. A world whose centre-column depths do not increase strictly (none on the archive) gets the row table instead (`rowReport`, printed by `check:enhance`).

**The standing row** (`geometry.js standingRow`). A smooth picture and its decals stand on max(rowOfDepth(d), 131), the floor's own row but never above the row table's last row; rowOfDepth itself keeps no plateau. The floor's last sample is D(69) = 972 on all 42 tracks (the floor's top row 130); past it the floor draws no ground, the horizon strip is there, and rowOfDepth goes on up into it, to 128.76 at 1122. On rowOfDepth alone (the milestone as first built) a far picture's bottom edge stood on row 130 from 972 and on row 129 from 1028 at 1x (from 999 above row 130 at 2x), a strip row between it and the floor, and its contact shadow and sun cast, which the composite lays on the floor's pixels alone, were lost: the review's probe of a far racer on track 1 summed its shade on the floor's rows to 9.31 in the classes at every distance, and in smooth sizes to 1.99 at 972 and 0 from 1028 at 1x (0 from 1060 at 2x). The game refuses the same rise: its rounded b would fall to 20 at 879 and is clamped to 21, row 131, and the floor's own row passes 131 at 878. So in smooth sizes a thing goes down the floor's rows from the camera to about 878 (from 132.0 at 800) and stands on 131 beyond, as the classes do, and everything under it with it. This departs from the plan's letter ("linear in 1/d beyond both ends" holds for rowOfDepth, not for the places); the other choice, keeping the rise and recording the lost shadows, is in docs/TODO.md.

**The place** (`scene.js placeSmooth`). The ground anchor of a smooth picture (the column floor(Wout / 2) of its bottom edge) stands on the fine column and on the standing row of the fine distance: left = round(s (colFine + m)) − floor(Wout / 2), top = round(s rowFine) − Hout, with rowFine = standingRow(dFine). The fine column and distance are the game's whole-camera place, the record's column and distance (`projectPoint`'s, or `wide.js`'s for a margin record), plus the shift of the record's point between the fine and the whole camera's projections (the wide projection with a margin), unrounded: colFine = col0 + dc and dFine = d0 + dd, refine's and `placeAt`'s shifts without their rounding.
- **Why the game's place, not the pinhole alone.** The game works its column and distance out from whole forward and lateral distances (`view.js projectPoint`): on track 1, over every 37th heading and a grid of points to 1200 units, the unrounded pinhole lies up to 7.7 columns (at the distance 89) and 2.8 units from the game's. Placed on the pinhole alone, a near picture would stand several columns off the game's at the tick. Anchored on the game's place, at the tick the anchor is the classes place's column exactly and its row within a reference row of the classes place's at every distance (section 10). Between ticks the steps of that anchor are refine's own (docs/TODO.md).
- A record standing above its row-table row keeps that lift (none does today: every record's bottom is its distance's row).
- **What keeps its class:** the own car (class 0 on the row table's row of its distance, with its pit picture and after-blits, as the plan says), a picture that is none of the world's shapes (none is drawn today), and a frame smaller than its shape's class 0.
- The placed record's distance is the fine one: the depth layer's (the fog) and the order's.

**The order** (`scene.js smoothOrder`). Farthest first by the fine distance; records of one distance in the frame routine's queue order (the intro's human and the racers by index, the objects by index, the own car, the starter, the shots by index), told by what each record shows. A margin record of the wide view takes its place in that queue too, so the order is one total order whatever order the records come in, and M8's merge after the game's sort is not needed here. At the tick the fine distances are the game's whole ones and records of one distance are common; the game's selection sort, which the classes keep, is not stable, so two overlapping pictures of one distance may be drawn in another order than in the classes (docs/TODO.md).

**The decals on the same rows.**
- **Contact shadows** (`shadows.js casterOf`) stand under the drawn picture: its anchor column, its bottom edge, a radius from its drawn width (the scenery's from the blit's footprint, as before).
- **Sun casts** (`castOf`, `castShadow`) start from the drawn picture's anchor and bottom, take their depth from its drawn width and lay their corners on the standing rows (the projections' row law below), so a cast stays under its picture where the picture goes down the floor's rows.
- **Skid marks and particles** (`marks.stamp`, `particles.splats`) stand on the standing rows too.
- **The row law.** `project.js fromCamera`, `fromCameraAt`, `projectFine` and `projectAt` take an optional `row` (`geometry.js rowLaw`: standingRow in smooth sizes, null for the row table as always). The own car's cast keeps the row table (its picture does).

**Dispatch.** Smooth sizes draw at the reference geometry too: there the enhancer keeps its 320 x 200 path (`drawFloor`, `composite`) and draws the pictures through the general blit (`blitAt` at IDENTITY, which for the own car's classes record is `blitLayers` byte for byte: M3a). Above 1x and in the wide view the pictures are drawn at their smooth places with M6's and M8's buffers. With SPRITE SIZES STEPPED every line runs as before: `placeAt` and refine, the game's sort and M8's merge.

**Checks.**
- `npm test`:
  - `test/stage4-smooth.test.js`:
    - the size law: each class's own size at its band's middle, flat before the first and past the last, monotonic and without steps between (an eighth of a unit at a time);
    - the maps: the texel nearest each output pixel's middle, symmetric where no two texels tie, the frame itself at its own size, the list capped at 256 and keeping the recently used (the oldest map, used again, outlives the next oldest when a new size comes);
    - rowOfDepth on a synthetic ground plane: the floor's rows at all 70 sample depths and continuous either side of them, strictly decreasing from 20 to 3000 units, linear in 1/d inside each segment and along the chord before and past the table, a VIEW word of 0 counting 1.0, a floor with equal depths giving the row table;
    - the standing row: the floor's row down to the row table's last row and that row beyond, never up, continuous at the crossing (within a quarter unit of the floor's sample on row 131), the sizes' row law;
    - the order: nine records of one distance (racers, a margin racer, objects, the own car, the starter, shots) in the queue order from 50 shuffles, farthest first, a copy;
    - the place at the tick (1x, 2x, 2x with the margin of 4 BY 3, 3x): the anchor column s times the game's column, the bottom on the standing row (a place at 1000 on the table's last row), the size of the law; with a fine shift within half an output pixel of the unrounded fine place; the own car, a picture of no shape and a short frame keep their class;
    - the blit: at the class 0 size and place it is `blitLayers`' class 0 picture; at sizes between the classes every pixel is its map's texel; the sampled silhouette's columns from the top left;
    - the decals at 840 and 1000: the contact shadow under the drawn anchor with the drawn width's radius, the sun cast's base on the picture's bottom row (at 1000 the picture on the table's last row and the cast the row table's own), the cast on a law of the floor's rows alone with the picture placed on it by hand (on the row table it would stand below the picture), and the projections' row law (the place unchanged, the bottom the standing row; the row table without it).
  - `test/display.test.js` and `test/menu-logo.test.js`: the RENDERING list's four lines and SPRITE SIZES' action.
- `npm run check:enhance`:
  - **Section 10** (smooth against stepped sizes at the tick, Enhanced with the default atmosphere, at 1x, 2x and 1x wide, in every scenario, the slides demo and the link race's second seat; the records matched by what they show):
    - every smooth record's ground anchor within one reference column and one reference row of its classes place, at every distance (the far ones too, since the standing row);
    - the particles and the skid marks (the two enhancers keep the same ones: the same ticks, the same seed): every particle disc of the smooth sizes is the classes' disc moved down by s (standingRow(d) − rowAt(d)) of its distance, to 1e-6, and the skid mark quads are the classes' in their columns; some of each must stand off the classes' rows;
    - a far object swept away from a camera along two rays (straight ahead, the camera facing an eighth of a turn so that the game's box lets it reach 1122, and 140 TRIG entries to the side) at 1x and 2x: its drawn bottom never goes up and moves at most an output row between neighbouring distances, over the plateau it takes several rows where the classes keep one, it never stands above the row table's last row, and its contact shadow (casterOf on the drawn box, stampShadow) darkens the floor's rows at every distance from 800 on; the floor's rows strictly decreasing at quarter units;
    - every track's floor giving its own rows.
    - **The result** (the full run, `check:enhance` 22 scenarios, 0 problems): 72 scenario runs gave 1,656 pictures with 8,852 records, 7,331 of them in smooth sizes (the rest the own car). Below the distance 800 every ground anchor was the classes place's column exactly (0.00 columns) and within 1.00 reference row of its row, and the 1,397 records from 800 on within 1.00 too (on rowOfDepth alone, before the standing row, they stood up to 2.00 rows above it). 108,367 particle discs stood on the standing rows (90,565 of them off the classes' rows) and 4,176 skid mark quads in the classes' columns (3,469 of them on other rows). The far object went from output row 132 at the distance 801 to 131 at 837 straight ahead at 1x and stayed on it to 1122 (264 to 262 from 857 at 2x), the same to the side out to 1032, where the classes keep 131 (262) throughout (on rowOfDepth alone it went on to 129 at 1122, 258 at 2x); it never stood above row 131, and its contact shadow laid at least as much shade on the floor's rows as the classes' at every distance from 800 on; the floor's rows fell at most 0.0046 rows a quarter unit. Every one of the 42 tracks gave its own rows, within 0.983 rows of the row table from 80 to 799.
    - **It bites.** Two throwaway copies of the tree were run with `--only 10 --frames 40`, then deleted: placing the smooth pictures on the unrounded pinhole's column (the fine projection alone) failed all 72 scenario runs (a racer at the distance 126 two columns off its classes place, an object of the shoot-out at 100 five columns off); standing them on the row table's row instead of the floor's failed the plateau sweep (one row over its 322 distances straight ahead). After the review, three more copies (`--only 10 --frames 60`, deleted): rowOfDepth without the standing row's floor at 131 failed 31 scenario runs (an object at the distance 1070 two rows above its classes place) and the sweep (the bottom on row 130 at 924), and with that sweep test switched off the shadow test (no shade on the floor's rows at 1028, the classes' 9.31); the particles without the row law failed 66 scenario runs and the count; the skid marks without it failed the count (none of 132 quads off the classes' rows). Removing the sun casts' law (`grid.row = law`) passes every gate (docs/TODO.md).
  - **Section 1** switches into and out of smooth sizes at 1x, at 2x (each draw 640 wide) and with Original's switches (twelve settings changes, one every frames / 13 ticks), with the same state hashes.
  - The `--time` rows *Enhanced 1x smooth sizes* and *Enhanced 2x smooth sizes*.
- `npm run check:identity`: identical against `3f8af9d` (stepped sizes are the default; smooth sizes draw without WebGL 2 too, so no configuration stores them: the base commit would draw the classes).
- Not checked in a browser (docs/TODO.md: the main session's Chrome check).

**Time** (node v26.8.1 on the MacBook Air, Mac14,2, M2, 2026-10-07 at 19:45, load average 8.8 to 11.1). The four attract demos, 300 ticks, five pictures a tick, every picture drawn by all five rows one after the other in alternating order (an interleaved run of the Stage 4 job, `~/.claude/jobs/2b4fea78/tmp/m7/smoothtime.mjs`, not committed):

| Row | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 1.39 ms | 1.28 ms | 1.91 ms |
| Enhanced 1x | 6.52 ms | 6.23 ms | 8.75 ms |
| Enhanced 1x, smooth sizes | 6.55 ms | 6.28 ms | 8.81 ms |
| Enhanced 2x | 14.20 ms | 13.79 ms | 17.91 ms |
| Enhanced 2x, smooth sizes | 14.29 ms | 13.84 ms | 18.02 ms |

Smooth sizes took 1.005 times the stepped ones at 1x (median 1.008, 95th percentile 1.006) and 1.006 times at 2x (1.003, 1.006): the cost is the records stage (0.53 against 0.56 ms at 1x, 0.93 against 0.96 at 2x: the two projections of each record and its map's lookup), every other stage the same within the noise. The `--time` rows *Enhanced 1x smooth sizes* and *Enhanced 2x smooth sizes* run one after the other, not interleaved; the run above is the one to read.

#### M8: the wide view, with the HUD centred

Built 2026-10-07. VIEW WIDE draws the race world wider than the original's 320 columns, out to a 16:9 picture on the display's shape: 53 reference columns a side on 4 BY 3 (426 x 200, about ±40 degrees) and 18 on 16 BY 10 (356 x 200), at 1x or 2x (852 x 400, 712 x 400). The HUD stays over the original's columns in the middle. It changes what the player sees (a racer at column -22 on the start grid, the scenery beside the road), so it is an explicit choice, and it is never used where sight must be equal or a page is shown: a link race, the split screen and a slides demo draw the standard view. At the defaults (VIEW STANDARD) nothing changes: `check:identity` is identical against `3f8af9d`.

**The setting.**
- RENDER's `view` ('standard' or 'wide') is live. The game menu has it under DISPLAY OPTIONS > RENDERING on the second line, VIEW STANDARD, WIDE, or NONE without WebGL 2 (Enter then does nothing); the list is RESOLUTION, VIEW and LEAVE THIS MENU. The panel's Rendering group has a View select (disabled without WebGL 2, the stored value kept), the garage's race view another.
- **The frame context** (M6) is live: `aspect` (the display's shape) and `wideAllowed` (false in a link race and a slides demo). The margin is `viewMargin('wide', aspect, world)`, 0 in the standard view, without `worldReady` (no WebGL 2 or a lost context), where the screen may not be wide, and for a world that fails its checks. The split screen never asks. A stored HUD place 'edges' (no control sets it yet) draws centred until M9 builds it, and the RENDERING list names the placement drawn (VIEW WIDE) until M9 brings back WIDE EDGES.
- **The per-world checks** (`geometry.js wideReport`). A world gets a margin only if its horizon strip repeats with the panorama's period (640 pixels, from `horizon.bounds`, checked over every row: `stripRepeats`) and its VIEW words are the TRIG cosine: VIEW[c] / VIEW[160] within `WIDE.viewTolerance` (0.003) of `cosT(c - 160)` at every column (`viewWorst`). Both are leads that the continuation outside the table rests on, never literals: on the maintainer's archive the worst VIEW difference is 7.3e-4 (column 0) and every one of the 42 tracks passes both (they share one table; `check:enhance` section 11 prints it). The margin is also capped so the picture is never wider than the strip's period.

**What the margins show, and how true it is.**
- **The centre** (the original's columns) is the standard view's picture, pixel for pixel, except where something from the margins reaches into it or a decal's projection outside the fan differs (section 11 below lists it).
- **The floor** (`caster.js`, M3a's continuation, now live): every margin column casts its own ray, the TRIG pair of its angle; its distances are the edge column's NDIST continued through the TRIG cosine, n(u) = n[e] cosT(e − 160) / cosT(u − 160), so the forward distance stays the edge column's and the floor is continuous at the edge. Extrapolated: the game never drew these rays. Outside the map's cells it is tile 0, as in the game, and a wide view shows more of it.
- **The sky's margins** (`sky-hd.js skyMargins`, per sky picture and margin). A row of one index (every row of BACK3.PCX, a few of the others) is continued exactly. A dithered row (most rows of BACK1.PCX and BACK2.PCX: two or three indices in no period, not an ordered dither) is made again from that row's own indices in their shares: the indices in ascending order, each taking its share of the row's 320 pixels as a band of thresholds, and the margin pixel at the reference column x the index whose band holds bayer(x, y + (x >> 2)) (the 4 x 4 Bayer matrix stepped down a row every four columns, so any 16 columns of a row take all 16 thresholds once and each index fills its share to within a pixel). These pixels are invented, not the game's art; next to the original's edge the made dither has another texture than the row's own, visible on a close look. Only indices the row already holds are used, so the strip's sky-coloured indices and the rows' colours (read from the 320 columns) hold for the margins. `SKY_MARGIN.mode` 'mirror' (the row reflected at the edge) is the alternative. A pack sky with margins will replace them (the pack milestones).
- **The horizon strip** is the panorama's own pixels: the window runs on modulo its period, so the margins continue the strip seamlessly at every offset, and the offsets' wraps (0 to 160 and 240 to 80) change nothing, because they are a panorama apart. Exact.
- **The clouds and the far range** (M5's covers at refW from the column −m) continue their flat field; the 256-texel field repeats about every 171 and 341 reference pixels across the wide sky.
- **The water** in the margins: the liquid hook keeps the edge column's tables (the margins' distances are the edge column's), and now takes the margin's own column for the sun's glitter (along the ray the floor continues there, `project.js rayRatio`) and for its dither cell (`water.js waterShader`'s sixth argument). In detail modes 2 and 3 the first block may start left of the picture (at m = 53 and a step of 2 the block of column −54); the hook then gets the picture's first column, −m, so the glitter is read inside its refW columns (the review found the read one or three columns left of them, which fell back to the shimmer in the leftmost columns).
- **The ground's relief** is per texel and the pictures' relief per picture, so the margins need nothing of their own; a picture is no longer cut at the reference columns, so its relief sees no open side there.
- **The things in the margins** (racers, ducks, the intro's human, the scenery, shots, the starter) are the game's own records, found as below, at the size class of their continued distance, on the row table's row, at the column the wide projection gives.

**The wide projection** (`project.js fromCameraAt`, `cameraPointAt`, `projectAt`). Inside the reference fan (a point at most te TRIG entries off the heading, te = atan(tan / 2^16) in entries = 159.9992) it is the pinhole of `view.js`, unrounded, as before. Only with a margin does a point outside the fan continue equiangularly, a column a TRIG entry as the floor's rays go: column = 160 + sign (160 + |t| − te), t = atan2(l, f) in entries. The column is continuous at the fan's edge (both give 0 and 320 there) and is the floor's column of that ray (to te's 8e-4 of an entry and the table's rounding), so a picture, a shadow, a mark or a particle in a margin stands on its texels; a pinhole would put a point at 40 degrees about 19 columns off its ground. The distance outside the fan is root · VIEW(u) / 2^14 with the VIEW word continued as the floor continues it. One step remains: at the right edge the pinhole reads VIEW[319] up to column 320 while the continuation starts from VIEW[319] · cos(160) / cos(159), so a thing crossing that edge changes its distance by about 0.2% (2 units at 1000), which can move a far picture's size class there once. At m = 0 these functions are `fromCamera`, `cameraPoint` and `projectFine` themselves (the pinhole everywhere with its VIEW clamp), so nothing of the standard view moves. The records (`scene.js placeAt`), the contact shadows' places, the sun casts (`shadows.js castShadow`), the skid marks (`marks.js`) and the particles (`particles.js`) all go through it.

**The margins' records** (`src/enhance/wide.js`).
- **The main list** (`sceneRecords` from the camera, as the reference draws it) decides every thing it holds, one record a thing; its records are drawn whole at their finer place, so the pictures the reference cut at columns 0 and 319 show whole.
- **Candidates.** Every other thing that may be drawn is projected through the wide projection. It is a candidate when its column lies outside the reference columns or within `WIDE.seam` (8) columns of their edges, its middle within [−m − h, 319 + m + h] (h half its class 0 width) and its distance within 80 to 1122. The seam is there because the game's column is worked out from whole forward and lateral distances and the enhancer's from fractions, and near the camera they differ by several columns at the edges, so without it a thing could be in neither list for a frame: over 245 million points of track 1 (every seventh entry of heading, distances 70 to 1150), a point the game culls at its column had its fractional column at most 4.8 columns inside either edge. A thing the game's list drew is never asked about, nor a seam candidate inside the reference columns that lies outside the game's box (`view.js viewSetup`, `projectPoint`'s first test): there the game decides, as it does in the rest of its columns, and only the rounding of its column is second-guessed. The review found the seam band letting box-culled far scenery (distances about 1000 to 1120 near the fan's edges) into the outer 8 columns, where it popped in and out at columns 8 and 311; now such a thing appears and disappears at the reference edges (columns 0 and 319), where the margins, which have no box, begin.
- **Aimed probes.** A candidate not yet known this tick is asked about by calling `sceneRecords` from a probe camera `WIDE.probeDistance` (400) units back from it along the TRIG entry nearest its bearing, facing along that entry. The thing stands at about column 160 and distance 400 of the probe, inside its box, its cone, its columns and its distances, so a probe that does not return it means a game filter dropped it: a consumed object, a racer gone after a head-on crash, the duck game's gone and skipped ducks, no starter in the duck game or once the start decided the lion is unseen. Every record a probe returns makes its thing known for the tick, so one probe usually serves its neighbours; the probe's own car is dropped. What is known is kept per world, tick, seat and frames' heading (the filters and frame bytes are the tick's state) and forgotten on a reset. On track 1's attract demo the wide view takes about one probe a tick.
- **The margin record** keeps the probe's identity, frame bytes and shape. Every record field but the projection is independent of the camera (the racers' frames follow `frames.heading`, the tick's, which the probes get too; ducks the car's heading; the lion heading 0 and its frame; objects `objectFrame`; shots their block and frame), so the frame is the one the game would choose. It is placed by the wide projection from the main camera: its distance, the size class clamp(trunc((d − 124) / 70), 0, 9), its bottom row from the row table, its column whole toward the middle as the game's is, the picture whole (the blit cuts it per pixel), and then the same finer place as a main record (`placeAt`).
- **The order** (a deviation from the plan's wording). The game's own selection sort orders the main list as it always did; the margin records, sorted the same way among themselves, are merged into it by distance, after the main records of their distance (`mergeOrder`). The plan said to merge them into the queue order before the sort, but that sort is not stable: a record merged in can swap two of the game's records of one distance (records at 5, 5 and 9 come out 9, b, a; without the 9, a, b; `test/stage4-wide.test.js`), which would change the centre where they overlap.

**The HUD, centred** (`src/enhance/hud-place.js`). `hudPlaces(G)` gives every overlay pixel its place in the refW x 200 HUD layer, moved right by m onto the original's columns, and the output pixel of its s x s block in the world, where 'picture' (the HUD in the picture) stamps it. Exact, and it cannot tear. `compositeAt`'s HUD layer, the stamping and `drawOver` (the menu of a lost race over the kept frame) all go through it, so M9's 'edges' placement only changes this map. At m = 0 every pixel stays where it is.

**The display** (`display.js`). With the wide view stored (`setRendering({ scale, wide })`) the element is laid out for the widest picture the settings allow (`viewMargin` for the display's shape: 426 x 200 on 4 BY 3), and every frame is placed by its own logical size inside it: a wide race frame fills it, and the 320-wide screens (the menus, the cards, the boards, a slides demo, the split screen, a link race) are pillarboxed in black at the same height, without a layout per frame. As at 2x, a stored wide view starts the graphics card even from plain display settings, and without WebGL 2 the page draws the standard view at 1x and shows the canvas as before. `stats()` reports the element's logical size (`element`) beside the frame's.

**The page.**
- `display.setRendering` is told the scale and whether the view is wide, before the first layout and on every change.
- The readout says 'World 426 x 200, HUD 426 x 200 ...' (or 852 x 400), and the budget hint counts a wide world as above the reference too: '1x wide draws in N ms here, slower than a 60 Hz frame: the standard view is recommended' (at 2x: '1x and the standard view are recommended'). Without WebGL 2 it says 'Resolution and view: none' with what is kept.
- The page's 320 x 200 index is the centre of the wide world's reference samples, the margin records' parts that reach into the original's columns included; the overlays, the overhead map's first-frame capture (rows 60 to 109, columns 0 to 77), `wackyDebug` and `tools/link-frames.html` read it as before (the link race is never wide). If a tall margin record reached into the map's rectangle on a race's first frame, the map's background would keep that piece (not seen in the checks; noted in docs/TODO.md).

**The previews.** The garage's race view has a View select (Standard, Wide (16:9)); its margin is worked out for the display shape the playtest page keeps (`loadDisplay().aspect`). The Original stands in the middle of a screen as wide as the Enhanced one, black either side, enlarged as at 2x, so the columns the two share are side by side; 'Use these in the game' stores the view with the rest. The track editor's atmosphere view stays 1x in the standard view.

**Checks.**
- **`npm test`:**
  - **`test/stage4-wide.test.js`:**
    - The VIEW check accepts a cosine table (worst 1e-4, its words' rounding) and refuses one whose edge word is 1% off, a flat VIEW, and a strip that does not repeat; 53 and 18 columns otherwise.
    - The strip at 1x, 2x and 3x with margins of 18, 53 and 120: at every offset 0 to 240 every column is the panorama's next, the centre is the standard view's, the two wraps give the same picture, the standard view at 1x is `renderHorizon`'s, and a strip that does not repeat throws.
    - The sky's margins: the 320 columns untouched, only the row's own indices, single-index rows continued exactly, and every 16 margin columns of a dithered row (two or three indices in many shares) holding each index within one pixel of its share; drawn at 2x they are these pixels; 'mirror' reflects.
    - The projection: continuous at both fan edges within 1e-9 px, the floor's ray of a margin column projects onto that column within 1e-2 (te and the table's 16.16 rounding), `cameraPointAt` inverts it, the glitter's ray is the projection's, and at m = 0 or inside the fan it is the pinhole itself.
    - The coverage sweep: an object swept through a full turn (every second entry) at 100, 125, 150, 300, 600, 900, 1100, 1150 and 1200 units: never two records; inside the fan only the game's list draws it (its box culls the centre beyond a forward distance of about 972, which the wide view keeps); at a seam inside the reference columns a point outside the game's box is drawn by neither (14 cases); elsewhere outside the inner band it is drawn exactly when its middle lies within [−m − h, 319 + m + h] and its distance in range (548 margin records of 1,721 drawn in 8,640 cases, one of them inside the reference columns at a seam, where the game's whole-unit column dropped it). Without the box test the first far case fails (an object at 154 entries and 1150 units, column 312.75, drawn from the margin).
    - Forged states: a racer and an object in the margins carry the aimed probe's frame bytes (the same buffer and offset); a consumed object, a racer gone after its crash, a gone and a skipped duck, the starter once it is not shown and in the duck game are never drawn there; a forged shoot-out (on the page it is the split screen or a link race, never wide) draws its other human in the margin and never its starter; two neighbours take one probe, the same tick no more, the next tick and a reset ask again.
    - The order: the game's records keep their order, the margin records go after the game's of their distance, and merging before the sort would swap two of the game's.
    - The HUD's places, and a wide frame through the enhancer (426 x 200 on 4 BY 3, 712 x 400 at 2x on 16 BY 10, the overlay pixel moved by m, the standard view without `worldReady`, where the screen may not be wide, or without a shape).
    - The HUD in the picture at a margin (1x and 2x on 4 BY 3, 2x on 16 BY 10): with no HUD layer the overlay pixel is stamped into the world as its s x s block at s(x + m), s y, not at its unmoved place nor beside the block, and `drawOver` with `hudLayer` false over `keepLayers()` stamps a new overlay pixel the same way and keeps the frame's own.
    - The water hook's own column at margins 53, 18 and 8, at 1x and 2x, in modes 1 to 3: from −m to 319 + m, also where the first block of modes 2 and 3 starts left of the picture (the old column failed at 1x, margin 53, mode 2).
  - `test/display.test.js`: the element laid out for 426 and 356 columns, a wide frame filling it and a 320-wide one pillarboxed at the same height in fit and integer scaling, plain settings starting the graphics card; the RENDERING list's VIEW line. `test/menu-logo.test.js`: three RENDERING lines. `test/sky-water.test.js`: a sky margin is `skyMargins`'. `test/geometry.test.js`: the margin with a world's VIEW and TRIG.
- **`npm run check:enhance`:**
  - **Section 11** (the wide view through the settings and the frame context, the display's default shape 4 BY 3, at 1x and 2x: every scenario, the slides demo and the link race's second seat; a sample every seventh tick, every other one at the tick). Each sample draws the same state at the same blend in the standard and the wide view, Enhanced with a sunset, clouds 0.9, mountains, water and relief at full strength (the world and the HUD as layers), and with smooth motion only at the tick, with and without the probes:
    - the world: columns [s m, s (m + 320)) of the wide picture are the standard picture outside E. E is the pictures, contact shadows and sun casts of the margin records and of the records whose reference picture reaches column 0 or 319; the sun casts and skid marks of either view whose boxes cross a crop edge; the particle discs of either view that cross one; and the s x `SUN.blur` columns inside each crop edge. The plan's E had no casts or marks of the other records: outside the fan the two views project their corners differently, the pinhole farther out, so a decal across the fan's edge differs inside it too (the first run found a skid mark at column 1);
    - the world's indices, kinds and depths are the standard view's outside the pictures of the margin and edge records, and with the probes off outside the edge records' pictures alone;
    - the page's 320 x 200 index is the reference renderer's picture outside the margin records' pictures, and with the probes off everywhere; the HUD layer holds exactly the reference overlays moved by m and nothing else;
    - every draw is the size its settings ask for (426 x 200, 852 x 400, or 320 columns where the view may not be wide), the margin written out in the check (`WIDE_MARGIN`: 53 on 4 BY 3, 18 on 16 BY 10) rather than taken from `viewMargin`, which is under test (a world that fails `wideReport` would get none); the per-track VIEW and period results are printed, seven tracks a line.
    - **The result** (the full run after the review's fixes, 2026-10-07, `check:enhance` 22 scenarios, 0 problems): 48 scenario runs gave 1,104 samples (184 of them in the split screen, the slides demo or the link race, never wide, each 320 or 640 columns). 145,030,707 pixels of the centre were the standard view's; 2,169,293 were left out (1,142 margin records and 70 records cut at the reference edges were drawn, with their shadows, and the decals and particles across the crop edges and the blur's border). The indices, kinds and depths were the standard view's in 147,064,638 pixels (147,129,594 with the probes off). The page's index was the reference picture in 58,855,196 pixels outside the margin records (58,880,000 with the probes off: every pixel), and the HUD layer the reference overlays moved by the margin (6,739,070 overlay pixels). The wide views took 942 probes. Every track's VIEW was within 7.32e-4 of the cosine and every strip repeated with its period. The run before the box test at the seams drew 1,155 margin records and took 947 probes; the 13 margin record draws fewer are box-culled things at the seams (the only change to which records it draws; the glitter's column also changes water pixels in the leftmost margin columns at detail levels 2 and 3).
    - **It bites.** Three throwaway copies of the tree, run with `--only 11 --frames 60` and deleted afterwards: the HUD placed one column further right (`hud-place.js`) failed every wide scenario at its first sample (tick 3: the HUD layer at 73,6); one floor pixel flipped at row 150, column 160 + m whenever m > 0 (`castFloor`) failed every wide scenario within its first two samples (14 of the 40 at tick 3, the others at tick 10: the world at 160,150). The third copy merged the margin records into the queue before the game's sort, as the plan words it: it passed in those 60 ticks, which met no two overlapping records of one distance; the unit test's three records show the reorder it can cause.
  - Section 1 switches into and out of the wide view mid-run (Enhanced wide at 1x and 2x among nine settings changes, one every frames / 10 ticks), with the same state hashes; every draw is the size its scale and view ask for.
  - Section 6b draws its 852 x 400 geometry without the margin records (`createEnhancer({ probes: false })`): a thing outside the fan may reach into the reference columns, which section 11 compares outside those records.
  - The `--time` rows *Enhanced 1x wide* and *Enhanced 2x wide*.
- **`npm run check:identity`**: identical against `3f8af9d`, with a new configuration W (Enhanced with VIEW WIDE stored, drawn with `worldReady` false as the page without WebGL 2: A's pictures): 122 comparisons (eight configurations of ten scenarios and the reference mode's 42 tracks). Since the review it also records, per picture, the size of the world the display is handed (`layers()`: 'canvas' for a 320 x 200 world, else its size and logical width; the base commit has no `layers()` and records 'canvas'), so a frame drawn at another geometry at the defaults differs at its first picture whatever its pixels. A throwaway copy whose `geometryFor` ignored the stored view gave `size at picture 0` in A to D for every scenario that may be wide (`compare-enhance.mjs --head <copy> --mode enhanced --ticks 5`); before, its first difference came as late as picture 67, when a pixel near an edge changed.
- Not checked in a browser: the page in the wide view (docs/TODO.md: the main session's Chrome check).

**Faster pieces** (both exact by construction, and covered by section 6's forced pipeline and section 11):
- `compositeAt` at scale 1 takes an output pixel as its own reference cell (the grid is refW wide), without the column map: on a synthetic frame its time a pixel went from 1.12 to 1.05 times `composite`'s.
- The canvas and the stamping of the overlays into the world ('picture') are one pass over the 320 x 200 pixels instead of two (a block is never another pixel's sample): the canvas-and-HUD stage went from 0.57 to 0.40 ms at 1x wide and from 0.62 to 0.45 ms at 2x.

**Time** (node v26.8.1 on the MacBook Air, Mac14,2, M2, 2026-10-07 at 14:06, load average 6.4 to 8.9). The four attract demos, 300 ticks, five pictures a tick, every picture drawn by all five rows one after the other in alternating order (an interleaved run of the Stage 4 job, `~/.claude/jobs/2b4fea78/tmp/m8/widetime.mjs`, not committed), the display's default shape 4 BY 3:

| Row | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Reference renderer | 1.29 ms | 1.22 ms | 1.61 ms |
| Enhanced 1x | 6.02 ms | 5.77 ms | 7.62 ms |
| Enhanced 1x wide (426 x 200) | 8.23 ms | 7.95 ms | 10.16 ms |
| Enhanced 2x | 13.13 ms | 12.68 ms | 16.04 ms |
| Enhanced 2x wide (852 x 400) | 16.67 ms | 16.14 ms | 20.20 ms |

- **1x wide** took 1.37 times the standard view on the mean (1.38 on the median, 1.33 on the 95th percentile), within the plan's budget of 1.4 for 1.33 times the pixels. Two runs before the faster pieces gave 1.40 and 1.41. Where it goes: the floor is faster (1.29 against 1.70 ms: the table caster against `drawFloor`), but the composite takes 3.22 against 1.82 ms, because the wide frame composes the world everywhere, under the overlays too (the HUD layer needs it; about a tenth of the standard frame is overlay pixels it skips), on 1.33 times the pixels, and the draw of a geometry adds the samples, the canvas and the HUD (0.14 and 0.40 ms) and the covers at 426 columns (0.68 against 0.44 ms). The probes cost little: the records stage took 0.59 against 0.49 ms, with 226 to 390 probes in a demo of 300 ticks (about one a tick).
- **2x wide** took 1.27 times 2x and 2.77 times the 1x standard view; scaled by this run's reference renderer to the quiet machine (1.29 against 0.96 ms), about 12.4 ms mean. As planned, it is measured and documented: 60 Hz is not promised, and the panel's hint ('2x wide draws in N ms here ...: 1x and the standard view are recommended') shows when the mean over 120 frames passes 12 ms.
- **Runs that are not interleaved** read higher and vary with the load. Each row in a process of its own, twice (14:19 to 14:23, load 5.6 to 6.9): Enhanced 1x 5.95 and 5.98 ms, 1x wide 8.23 and 9.49 ms (1.38 and 1.59 times; in the second every stage of the wide row was about 15% slower, the load). `check:enhance -- --only none --time --frames 100` (14:11, load 6.1 to 6.9, one row after the other): the reference renderer 1.43 ms, Enhanced (all) 6.42 ms, Enhanced 2x 13.45 ms, *Enhanced 1x wide* 10.33 ms (95th percentile 13.16) and *Enhanced 2x wide* 18.35 ms (23.19), so 1.61 and 1.36 times their standard rows. The interleaved run above is the one to read; the Chrome bench (docs/TODO.md) decides for the page.

#### M1, M2 and M3b: the artwork packs

Built 2026-10-07. The player's own art replaces the archive's in the race world: the floor's tiles, the sky (with the wide view's margins), the horizon strip and every picture of the world's draw list. Packs are made, imported, ordered and compared in the asset garage, kept in the browser, and drawn with ARTWORK ON at 1x and 2x, in the standard and the wide view, in stepped and smooth sizes. The authors' reference is docs/artpacks.md (the manifest, the kinds, the keys, the colour rules, the template, the licence, what packs never replace). At the defaults (ARTWORK OFF), and with ARTWORK ON but no pack stored, nothing changes: `check:identity` is identical against `3f8af9d`, with two new configurations for the second case.

**Using it.**
- **The garage** (`viewer.html`, the header's *Art packs*, or `viewer.html#art-packs`, which the playtest page links to): *Import a pack* from a zip, a folder or several files, with a report of every entry (ok, warning, refused with its reasons); the packs list with *On*, the order (up and down: a later pack wins what two packs replace) and *Remove*; *Use in the game* (stores ARTWORK ON); *Export template* (below); *Compare* a kept entry with the archive's art (below). Quota and blocked-upgrade messages reach the status line.
- **The race view** of a track has an *Artwork packs* switch, and *Compare* gains *Enhanced \| Enhanced + pack* (the same moment without and with the packs) and *Original \| Enhanced + pack*; both draw the packs whatever the switch says. The view is built with the garage's provider; when it opens, the enabled packs' pictures its race may draw are decoded (`wantedFor`; nothing is decoded before a race view opens), and once they are set the view runs to its moment again and draws them (the first pack changes the preview's scene switches). Its fallback to the Enhanced preset and its stats line follow the enhancer's own answer (ARTWORK with no pack on counts for nothing; `draw` returns `active`).
- **The playtest page**: GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS > RENDERING has ARTWORK ON, OFF, or NONE while no pack is stored (Enter then does nothing). RENDERING is RESOLUTION, VIEW, SPRITE SIZES, ARTWORK and LEAVE THIS MENU (five lines; KART ANGLES comes with M4). The panel's Rendering group has *Artwork packs* (disabled with no pack stored) and a status line: the packs in use, how many of their pictures were decoded (or that they are decoded when the artwork is switched on), or why the browser gave none, with a link to the garage's Art packs.
- **The track editor's** race view draws the enabled packs too (the Enhanced preset with the stored artwork switch, M0), by where the frames lie in its patched archive (unchanged members keep their places). With the artwork on it decodes the pictures the edited track's race may draw, read again whenever the view is built or the tab shown, through a cache it keeps.
- **Settings:** RENDER's `art` is live. `renderActive` counts it as a choice that draws (Original's switches with it are CUSTOM), but the enhancer's `active()`, its configure and `afterTick` take the artwork as off while no pack is stored (`index.js enhancedNow`), so Original's switches with ARTWORK ON and no pack draw the reference renderer as before (`check:identity`'s P2).

**The format** (`src/enhance/pack-format.js`, pure). `normalizeManifest` and `normalizeArtEntry` check and normalize with a reason for a refusal and warnings for what is only questionable; with `packContext` (the archive's members, their CRCs and pictures, the strips' periods, the region registry, the cars' slots) an entry is checked against the archive, with its decoded picture against its size, its palette and its ground rows. `readPack` reads a pack's files (`packFiles`: the shallowest `pack.json`, the Finder's leftovers skipped, pictures by their paths, never outside the pack's folder; files picked one by one, which come without their folders, also by their names when the name is not ambiguous), decodes each picture, checks each entry and the pack's total pixels, and keeps the later of two entries of one key. The size rules: tiles 320p x 200p (the sheet's layout); a sky (320 + 2 margin)p x 130p (rows 110 to 129 the strip's background); a strip P p x 20p (one panorama of the archive's validated period); frames and angles `columns` cells a row of `cell` pixels, frame k in the cell (k mod columns, floor(k / columns)), the logical box at `box` inside it.

**The region registry** (`src/enhance/regions.js`). Every picture the world's draw reads, as groups of frames (member, offset, width x height, count, stride), from the game's own exported functions and data: CARS.SP and the driver files (every whole frame of 38X28.INF's class 0, a slot a row by `carFrame`), DIGGER.SP and GENEF.SP's explosions (`duckPictures`), the starter lion (`lionFrame` for every frame the countdown shows: `createStart`, `stepStart` until the race runs), every object of SPRITE.ATR, HOGMIS.SP (every frame of the shots' size: the shots' blocks and the car's rear pictures are frames of that sheet), and the pictures the car routine picks itself, found by asking its exported routines with probe states and reading the byte offsets of the pictures they hand out: the sparks (`stepSparks` for every spark word `sparkShift` knows), the tyre strips (`stepEffects` through a tyre stack's states from `startTyres`), the wheel dust and the puffs of every surface of WACKY.SDX (on the first track whose loader reads them, their counters run until they repeat), the pit state's picture and its splash overlay (for the surfaces that start the pit state, `specialSurfaces`). The plan's list missed the rear pictures, the tyre strips, the splash overlay and the dust's frames past the first (`surfacePicture` hands out only the first); the probes reach them without a new export from `src/game`. On the maintainer's archive: 483 pictures in 75 groups, worked out in about 0.2 s (kept per archive). spriteLayout's curated table is never used.

**The template** (`src/enhance/art-template.js`, exported by the garage as a stored zip). One member or the whole race world (every tile sheet and sky a track's .GAM names, every strip once a CRC with its members listed, every group of the registry), at p = 1, 2 or 4 (nearest), RGBA through a palette (by default each member's first track's, else A_F1.PCX's) or indexed. In RGBA the tile sheets' pixels in the palette cycle's entries (worked out by running `palette-cycle.js` for the tracks that use the sheet: 148, 161 to 164 and 168 to 175 on the beach tracks) and the strip's pixels in its sky indices are at alpha 0, the frames' index 0 transparent; each frame's anchor is its lowest opaque row; the sky has the widest margin the wide view asks for (53), filled with the wide view's own made margins. Its licence is `LOCAL ONLY: contains the original game's art`, which an import takes with a warning (the decision the brief left open: a template must import as it is, and the warning and the list's *LOCAL ONLY* mark keep it from being mistaken for a pack to share), and its NOTICE.txt says that it holds the game's art and stays local.

**The store** (`src/enhance/art-store.js`, on `store.js`, whose new `withStores` makes one transaction over several stores). `packs` records `{ id, name, author, licence, manifest (without its entries), source, enabled, order, saved }`, `art` records `{ id: pack|kind|member|offset|w x h|slot, pack, kind, member, memberCrc, meta (the entry as checked), png, width, height, saved }`; the pictures are the PNG files as imported (a Blob), never decoded pixels. `normalizeArtRecord` is as strict as the relief maps' (the entry must still be valid and of its record's kind, member, CRC, id and picture size). `savePack` keeps a pack and its art in one transaction (a full quota keeps nothing and says so, whether the browser reports it as the transaction's abort or first as the failed request's error event, while the transaction's own error is still null), `removePack` removes them in one, `setEnabled` and `setOrder` change the list; the loaders give no packs where the browser keeps nothing, refuses, or an older tab blocks the upgrade.

**The pictures** (`src/enhance/png.js`). PNG files are read and written by the page's own code rather than createImageBitmap (the plan's): it reads the bytes as saved (no colour management, no premultiplied alpha, which some browsers apply even when asked not to) and runs in node, so the checks and the tests take the race's own path. Non-interlaced RGBA, RGB, grey and grey with alpha at 8 or 16 bits, and palettes of 1, 2, 4 or 8 bits are read (all five filters); anything else is refused with the reason. A picture larger than `ART.maxSide` a side or `ART.maxImagePixels` is refused from its header, before its data is inflated, and the data is inflated no further than the picture's rows (read piece by piece), so a small PNG that claims a large picture or inflates to gigabytes allocates nothing much (a 300 MB inflation of a 4 x 4 picture: about 1 MB). The zip reader and writer (`src/zip.js`, page code) take stored and deflated files (DecompressionStream('deflate-raw')), sizes from the central directory (the Finder's stream zips), and refuse zip64, encryption, other methods and, from the garage, a file whose directory size passes `ART.maxFileBytes` (a 16-bit RGBA PNG of `maxImagePixels` stored, about 129 MB) before it is read; a deflated file is inflated no further than its directory's size.

**Indexed packs are palette PNGs of the game's indices** (a deviation from the plan, which mapped colours to indices). The game's palettes repeat colours: the 17 tile sheets' palettes have 38 to 73 entries whose colour an earlier entry has (entries 4 and 90 of A_F1.PCX are index 0's black). Colours cannot name those indices: an opaque black pixel would come back as the transparent 0, a strip's sky colour as an index without the sky flag, a cycled entry as a still one. So an indexed entry is a palette PNG whose pixel bytes are the indices, its PLTE checked against the palette member at every index it uses (a re-sorted palette is refused).

**The provider** (`src/enhance/art.js`). `toArt(entry, image)` keeps an indexed picture's indices (with a flag for each transparent index: tRNS alpha 0, and index 0 in frames) or an RGBA picture's bytes and words; `createArtCache` keeps decoded pictures across races (a least recently used list of `ART.cacheBytes`, 128 MB); `createArtProvider(archive)` gives `tiles(member)`, `sky(member)`, `strip(member)` and `frame(bytes)` (a Map from the frame's absolute byte offset in the archive to `{ art, k }`, built when the arts are set and again when the archive changes, so `bytes.buffer === archive.buffer` and the length w x h are required: a copy of the bytes is never matched), `angles(slot)` (null until M4), `forWorld(world)` (the world's tile sheets' art, its sky's, its strip's, and its own sky picture for the strip), `active(world)`, `load(records, cache, wanted)` and `hits` (the checks' counts). A later art in the order wins its keys. Loads may overlap (a race started while the last one's pictures are still decoding): only the newest load or `set` applies its list, and an older load stops decoding once a newer one has begun (`load` gives whether it set its list), so a slow load of another track's pictures never replaces the newer list.

**Drawing** (art is drawn while ARTWORK is on and the provider has art that may change the world's frame: a tile sheet, the sky or the strip of the world, or any picture; `index.js artFor`).
- **Where:** at the reference geometry on the reference geometry's own path (the page's index and canvas, its layers), with the general caster, blit and compositeAt where art needs them; at any other geometry with that geometry's buffers. The art layers (`createArtLayers`: the RGBA words `px`, `direct`, `beneath`, `through`) are made on the first frame with art and set on the layers only while art is drawn, so without art no blit or composite touches them.
- **Tiles** through the general caster's tile hook (`tileHook`, even at 1x): the pack pixel of the texel the ray reaches, at the sample's place inside it (texel p + floor(fraction p)); an indexed pixel's index, or an RGBA colour in the art layers over the archive's texel (which stays the index, and `beneath`). Alpha 0 and a transparent index keep the archive's texel, which cycles.
- **The sky and the strip** through `sky-hd.js` (`drawPackSky`, `drawPackStrip`): the pack pixel at the output pixel's reference place times p; a pack sky's margin replaces the made margins where it reaches; at p > 1 the sky's rows are flagged so compositeAt's sky-band fast path (one value a cell) does not take them. A strip's 'sky here' (alpha below `ART.alphaCut`, 128, or a transparent index) keeps the archive's strip pixel where it is one of the strip's sky indices (its own dither: an identity pack stays exact) and takes the sky picture's pixel of that row elsewhere (the pack sky's where it reaches, else the archive's), with `through` 1; any other pixel is the pack's scenery (`through` its index's flag, or 0 for a colour). The strip is drawn against the track's own sky picture, also in the split screen, whose world draws BLANK.PCX behind its strips. The fog's colour stays the archive strip's.
- **The pictures** through `blit.js` (`blitArt`, `blitFlatArt` for the effects after the own car): the logical box is the archive picture's (its size class's map, or its smooth size), each output pixel reading the pack pixel under its place; inside the box that place is kept within the p x p pack pixels of the archive texel the class map reads there. The plan's formula, u = U(i) + (r + 1/2)(U(i+1) - U(i))/s, reads the next texel on a class that skips texels (class 9 of 38X28.INF skips about three a column) even at p = 1, so an identity pack would not be exact (`test/art.test.js` shows it); the clamp makes p = 1 the archive's own texel and keeps p > 1's finer pixels. Art in the cell around the box (the overhang) is drawn around the picture at its mean scale. An indexed pack writes its index; an RGBA pack its colour in the art layers, the archive's index kept in fb where the archive's picture is opaque there and the index beneath elsewhere, so the page's 320 x 200 index is the archive's wherever the two pictures coincide. Every drawn pixel takes the sprite's kind and the record's distance (fog, relief, grade). The footprint and the silhouette, and so the contact and sun shadows, are the pack's opaque pixels inside the window of the logical box; an indexed picture drawn over an RGBA one clears its colour (art pictures sort with indexed ones by the game's order). The loops visit only the output's columns and the rows that can do anything (the overhang's rows above the output's first row draw nothing; the box's own rows there still count for the footprint and the silhouette), so a cell that overhangs its box by far more than the screen costs no more than the screen (a probe of the Stage 4 job, not committed, compared the bounded loops with the earlier ones on 1,298 synthetic blits, stepped and smooth, at 1x, 2x and wide, with overhangs up to 120 rows and 315 pictures whose top is above the output: the pixels, layers, collected pixels, footprints and silhouettes all equal; a copy that also skipped the box's rows above the output differed in 265).
- **The composite** (`compositeAt`): an RGBA pixel's components are capped at the demo's fade (the 6-bit widening is monotonic, so an RGBA copy of the palette fades exactly as the palette does) and partial alpha blends over the colour of the index beneath; an overlay's pixel over art is the overlay's; with a pack strip the strip's sky test reads each pixel's `through`, else the per-index flags as always. RGBA pixels never take the palette cycle.
- **The relief** of a picture: the player's height maps by the logical source byte (-1 in the overhang: the generated body), the generated body's brightness from the pack's index or `lumaOf`, paletteLuma's own expression for an RGBA colour (an RGBA copy of the palette gives paletteLuma's Float32 values bit for bit).
- **compositeAt's per-row pass is now its own loop** rather than a closure (and the grade a module function): the per-pixel work reads its tables from local variables. On a real frame (Enhanced, demo 1) it went from 1.55 times `composite`'s time to the same (0.661 against 0.660 ms, interleaved), which every geometry above 1x gains too.

**The page's loading.** `play.js` builds the provider against `state.dat` and reads the packs' list when the page opens (the ARTWORK line and the panel's switch know a pack is stored before the first race) and again at every race start (`reloadArt`: the garage may have changed them in another tab). With ARTWORK on it decodes what the race may draw (`art.js wantedFor`: every picture, the track's own tile sheets, sky, the split screen's background and strip; a whole-world template at 4x, about 27 million pixels, is mostly tile sheets) and takes the pictures decoded before from the cache; with ARTWORK off nothing is decoded until the artwork is switched on (`setGraphics` on the switch from off to on decodes for the current track; the art then applies from the frame it is ready on). A race whose artwork is on and for which the last read found a pack stored waits for its pictures before its first tick (`state.artWait`: the screen before it stays) up to `ART.decodeTimeoutMs` (1.5 s), after which it starts and the art applies from the frame it is ready on; with no pack stored it never waits, and a link race never waits (the other player does not). Reads may overlap: only the newest one's answer reaches `artInfo` and the status line (and the provider sets only its newest load's pictures). The plan placed the wait on the loading card, but no card follows a race and free races, the duck game, the shoot-out and the demos start without one (M6's finding), so the wait is at the race's start. `wackyDebug` gains `art`, `artCache`, `artInfo` and `reloadArt`.

**Departures from the plan, and why.**
- Indexed packs are palette PNGs of the game's indices, not colours mapped to indices (the palettes repeat colours: above).
- The pictures are read by the page's own PNG reader, not createImageBitmap (exact bytes, and the same code in node).
- A picture's pack pixel is kept inside the archive texel's p x p pixels (the plan's continuous place reads the next texel on classes that skip texels, even at p = 1).
- The region registry has more than the plan's list (the rear pictures, the tyre strips, the splash overlay, the dust's later frames), found by asking the car routine's exported functions, with no new export from `src/game`.
- A frames entry's anchors are checked and shown, never used to move the art (docs/TODO.md).
- The race waits for its packs at its start, not on the loading card (no card follows a race, and most races have none).
- The template's licence is LOCAL ONLY and an import takes it with a warning (the brief's open choice).
- The garage's template is its own module (`art-template.js`); `src/sprite-sheet.js` gained no scale or grid options (the plan's file list), since the template lays out the registry's groups, not a sprite sheet's frames.
- The plan's 'unmatched picture' count in the garage is not built (docs/TODO.md); section 5's recorder is the gate.

**Checks.**
- **`npm test`** (25 new tests, all synthetic: no game file, no template output, no identity pack in the repository):
  - `test/pack-format.test.js`: the manifest (unknown keys dropped, the format, the version, the name, the licence, the entries, the source; a LOCAL ONLY licence taken with a warning); every kind's size rule and the frame order; each refusal of an entry's own fields; an entry against an archive's facts (a missing member, another CRC, frames past the member's end, a frame that is no registry picture, a strip period that is not the archive's, strips of two periods, a slot CARS.SP lacks); an entry against its picture (the exact size and its message, the caps, an indexed picture's palette at the indices it uses, the ground row's warning and a declared anchor); the registry of a synthetic archive (the cars a slot a row, the lion at 4449 and the explosions at 7641, the sparks and the tyre strips from the routines that draw them, `has` a byte off and with the size swapped).
  - `test/zip.test.js`: a written zip read back (names in UTF-8, an empty file); a deflated entry, and one written as a stream with its sizes only in the central directory; the refusals (no zip, a damaged CRC, encryption, another method); the cap (a file larger than `maxBytes` refused, a deflated file whose directory understates its size refused once it inflates past it); a pack's files (pack.json at any depth, the Finder's leftovers, pictures in any case, never outside the pack's folder, loose files by their names, two of one name finding neither).
  - `test/art-store.test.js` (a minimal IndexedDB of its own with transactions over several stores that keep nothing when they abort): the records' strictness; a pack and its art saved, ordered, switched and removed; a full quota keeping nothing and saying so, also when the request's error event comes first (the stub's `requestError`); no IndexedDB; and an import refusing each entry with its reason (a wrong image size, a region outside the member, a CRC mismatch, a bad N, a strip period not the validated one, colours outside the palette, an oversize image, a missing picture), a pack with an empty licence, two entries of one key, a pack past ART.maxPackPixels.
  - `test/art.test.js`: the PNG reader and writer (RGBA and palette pictures written and read back exactly, the five filters, 2-bit palettes, grey with alpha, 16 bits, the refusals, an interlaced picture with its header's CRC right; a picture past the caps refused from its header, a caller's cap, data past the rows never inflated); `lumaOf` against paletteLuma bit for bit; the provider (frames by their bytes' place, a byte off, another length, a copy of the bytes; a later pack winning; tiles by member; `forWorld`, `active`, `load` through a cache with a broken picture dropped, overlapping loads where the newer one wins and a `set` replaces a load still running, `wantedFor`); the cache's eviction; the tile hook (the sub-texel place at p = 2, alpha 0 and a transparent index falling back, a sheet without art); the composite (an RGBA copy of the palette under the demo's fade equal to the palette's picture, partial alpha, an overlay over art, the strip's flag of each pixel only with a pack strip); the blit (an identity pack is the archive's picture, its footprint and silhouette at 1x to 3x and p = 1 to 3 over classes that skip texels, with the plan's formula shown reading another texel; RGBA keeping the archive's index, an indexed picture over an RGBA one and the other order, overhanging art drawn outside the box, an effect's identity pack); the strip's 'sky here' and scenery, and a pack sky's alpha 0 and flagged rows.
  - `test/enhance.test.js`: ARTWORK ON with no pack stored keeps `active()` off, with a pack on. `test/display.test.js` and `test/menu-logo.test.js`: RENDERING's five lines, ARTWORK ON, OFF and NONE (also without WebGL 2), its action, every page list within six lines.
- **`npm run check:enhance`:**
  - **Section 5 (regions):** an enhancer's recorder (`createEnhancer({ blits })`) logs every picture the 22 scenarios' draws blit, standard and wide (the margins' records), every tick for the full run (smooth motion only: the same records at a fraction of the time): 150,800 pictures in 22,000 draws, 346 of the registry's 483 pictures among them, none outside it. The template of the archive in RGBA and indexed (103 entries, 1,706,108 pixels each) validates with no entry refused. The section fails when the recorder recorded nothing (no blit, or no registry picture among them), so it cannot pass without checking.
  - **Section 6** (the general paths forced) is unchanged and passes with compositeAt's inlined pass: 26 scenarios under configurations A to D, 9,464 pictures, each the dispatched draw's.
  - **Section 7 (pack identity):** identity packs built at run time from the local archive, in memory (`art-template.js` for the scenario's track, each entry checked as an import checks it): indexed at p = 1 (every tile sheet, sky, strip and registry picture) and RGBA at p = 2, nearest-doubled through the track's palette (the tile sheets' cycled entries and the strip's sky-coloured pixels at alpha 0). Two enhancers draw the same state at the same blends, Enhanced with the dark full atmosphere (night, clouds 0.9, mountains, water and relief at full), one with no pack and one with the pack, with the page's palette (the demos' fade-in, the cycled entries shown); their canvas, index and world must be equal byte for byte. Every scenario at 1x, the first demos, the split screen and every fifth scenario at 2x and in the wide view too (the split screen never wide), and the link race's second seat; in the duck game the ducks' explosions are forced on the drawn state every fourth drawn tick (none is shot down in these ticks), put back before the next tick. The result: 78 runs, 6,240 pictures each the no-pack picture byte for byte (1,600 at 2x, 1,280 wide, 480 of the split screen, 160 of a demo's fade-in, the beach tracks 2 and 16), the lookups reaching the tile sheets, the skies, the strips (in 6,720, 5,760 and 6,720 frames) and 48,180 pictures, the lion and the explosions among them, 5,206 at byte offsets of no frame grid and 10,277 effects after the own car. A tinted pack (red and blue swapped) changes 90,587 bytes of demo 1's pictures, so the identity is not the packs doing nothing. On the beach tracks the registry's pictures hold 460 pixels in the palette cycle's entries, all in the water's dust and puffs (EFFECTS.SP from 990 and from 1710): the RGBA identity packs of those tracks leave those two groups out (an RGBA picture cannot cycle; docs/TODO.md), the indexed ones keep them.
  - **Section 1** switches a tinted pack's artwork on and off among its thirteen settings changes: the same state with no draw, the reference draw and the enhanced draw in every scenario.
  - **It bites.** Three throwaway copies of the tree (deleted afterwards): the lion left out of the registry failed section 5 (`--frames 60`: GENEF.SP at 4449, 5513 and 6577 drawn outside it); the fade's cap left off RGBA pixels failed section 7 in every demo from its first fading tick (`--frames 40`, ten runs); a strip's 'sky here' taking the sky picture over the archive's own sky pixels failed section 7 in 36 runs (demos, races, the split screen, the shoot-out, the duck game).
  - Sections 6, 6b, 9, 10 and 11 give the counts they gave before (compositeAt's inlined pass changed no picture). The full run: `check:enhance 22 scenarios, 0 problems`.
- **The template's way through a zip** (a probe of the Stage 4 job on the maintainer's archive, `~/.claude/jobs/2b4fea78/tmp/packs/roundtrip.mjs`, not committed): the whole world's template in RGBA and indexed at p = 1 and 2, its pictures written as PNG (`encodePng`), stored in a zip (`writeZip`), read back (`readZip`) under a folder and imported (`readPack`): 103 entries each, none refused, no entry warned of, the pack's one warning its LOCAL ONLY licence, and every decoded pixel the template's own (6,824,432 RGBA bytes and 1,706,108 indices at p = 1, four times as many at p = 2).
- **`npm run check:identity`:** identical against `3f8af9d` with four new configurations, P (Enhanced with ARTWORK ON and an empty provider: A's pictures), P2 (Original's switches with ARTWORK ON and an empty provider, drawn as the page decides: the reference renderer's path, as O), Q (Enhanced, ARTWORK OFF with a pack stored: A's pictures) and Q2 (Original's switches, ARTWORK OFF with a pack stored, drawn as the page decides: O's). Q's and Q2's pack is the RGBA template at 1x of the whole race world with red and blue swapped, built at run time from the archive in memory, each entry checked as an import checks it (the script throws where it has no art of a scenario's world). It bites: a copy whose `artFor` ignores the switch (the review's mutation) differs in Q in all ten scenarios (P, P2 and the rest identical), and a copy whose `enhancedNow` counts a stored pack with the switch off differs in Q2 (the path) and P2. 162 comparisons (twelve configurations of ten scenarios and the reference mode's 42 tracks).
- **Not checked in a browser** (docs/TODO.md: the main session's Chrome check): the garage's panel and comparisons, the playtest page's ARTWORK and status, a race waiting for its packs.

**Time** (node v26.8.1 on the MacBook Air, Mac14,2, M2, 2026-10-07, interleaved: every picture of the four attract demos, 300 ticks, five pictures a tick, drawn by every row in alternating order; a probe of the Stage 4 job, `~/.claude/jobs/2b4fea78/tmp/packs/ptime.mjs`, not committed). Two runs, the second at a load average of 5.5:

| Row | Mean (run 1) | Mean (run 2) | 95th percentile (run 2) |
| --- | --- | --- | --- |
| Enhanced 1x | 3.88 ms | 5.10 ms | 6.25 ms |
| Enhanced 1x, the general paths forced, no pack | 4.32 ms | 5.68 ms | 6.84 ms |
| Enhanced 1x + pack (RGBA p = 2: CARS.SP and the track's tile sheets) | 4.36 ms | 5.73 ms | 7.02 ms |
| + CARS.SP only | 4.04 ms | 5.32 ms | 6.58 ms |
| + the tile sheets only | 4.27 ms | 5.58 ms | 6.72 ms |

- **The pack row** took 1.12 times Enhanced 1x in both runs (+0.48 ms in the quieter one, whose Enhanced 3.88 ms is about the budget's quiet 3.65, and +0.63 ms at the second's load); scaled to the quiet 3.65 ms that is about +0.45 ms, within the plan's +0.5 ms. The `check:enhance -- --time` row *Enhanced 1x + pack* (one row after the other, not interleaved; 2026-10-08, load average 5.0, `--frames 100`) read 4.75 ms against *Enhanced (all)*'s 4.25 ms, the same 1.12. Where it goes (the stage times): the floor 0.26 to 0.33 ms more (the tile hook, a function call a floor pixel; docs/TODO.md), the pictures 0.1 ms (the art blit), the composite 0.13 to 0.16 ms (compositeAt with the art layers against `composite`).
- **compositeAt**: before its pass was inlined the same probe gave the pack row 1.40 times Enhanced under a load of 9, the composite stage taking 1.3 times `composite`'s. On one real frame (Enhanced, demo 1; medians of a few hundred calls, interleaved) compositeAt took 1.390 ms against `composite`'s 0.896 at 320 x 200 before the change and 0.661 against 0.660 after it, and at 640 x 400 (the reference look's soft layers, the sky-band fast path) 4.59 ms before and 3.75 ms after (the previous commit's composite.js against this one's, both byte for byte the same picture). The 2x budget's measurement (docs/TODO.md, M6) was not run again: `scripts/spike-2x.mjs` is the one to read for it.

#### M4: kart angles

Built 2026-10-08. An artwork pack may give a driver's kart (a slot of CARS.SP) a kart angle set: N = 8q directions instead of the original's eight direction frames. With ARTWORK ON the race then draws a computer racer, the other human of a two player game and the fly-in's human between the game's frames as they turn against the camera, without changing the frame the game chose: the records keep their bytes, sizes, places and order, and the game's state, its glances, its head-on decisions and its spins are never touched. The authors' reference is docs/artpacks.md (`angles`). At the defaults (ARTWORK OFF, with or without sets stored, KART ANGLES LOCKED or FREE), and with ARTWORK ON but no set stored, nothing changes: `check:identity` is identical against `3f8af9d`.

**Using it.**
- **KART ANGLES** (GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS > RENDERING, the fourth line): LOCKED (the default), FREE or OFF, NONE while no enabled pack has a set (Enter then does nothing). RENDERING is now RESOLUTION, VIEW, SPRITE SIZES, KART ANGLES, ARTWORK and LEAVE THIS MENU: six lines, the limit (`test/menu-logo.test.js`); KART ANGLES LOCKED is 20 characters.
- **The panel's** Rendering group has *Kart angles* ('Locked to the game's frame', 'Free', 'Off, the game's eight'), disabled without an enabled set; the status line counts the slots with a set (`artInfo.angleSets`: the distinct slots of the enabled packs' sets, read with the packs' list).
- **The garage's** race view has its own *Kart angles* select, stored with the rest by 'Use these in the game'. The *Art packs* panel exports an angle-set template of a slot or of every slot with its *Angle directions* N, and *Compare* shows a set on the turntable (below). The track editor's race view follows the stored setting (M0).
- **Settings:** RENDER's `angles` is live. It only refines the artwork: Original's switches with another value stay ORIGINAL, and it never turns the enhanced path on by itself (M0).

**The mapping** (`src/enhance/angles.js angleMapping`, from the game's exported functions alone, no literal of the original's numbers). The octants are `frameTable()`'s rows, a sector is the turn (1920 TRIG entries) over them, `rear` = racerFrame(0, humanCompass(0)) the frame of a racer driving the camera's way (4: the kart from behind; the player's own straight picture is entry 4 of its slot) and `sense` +1 when racerFrame(0, humanCompass(sector)) is the next frame (it is: the frame rises as the racer turns one sector on), else −1. A racer turned d = wrapSigned(direction − camera) entries from the camera has the continuous frame x = rear + sense d / sector (mod the octants); with q = N / 8 and the game's frame f:
- **off:** i = q f, the set's picture of the game's frame;
- **locked:** i = (q f + clamp(wrapSigned(round(q x) − q f, N), −floor(q/2), floor(q/2))) mod N: the direction's index, but never more than half an octant from the game's frame, so the game's separate roundings of the racer's octant and the camera's sector are kept (the segment at 119 and the camera at 121: f = 3 while round(x) = 4; at N = 32 locked draws 14, within two of 12). N = 8 is the game's frame exactly;
- **free:** i = round(q x) mod N, monotonic in d; at the edges of an octant it may be an original step from the game's frame (a kart drawn from the front where the game shows it three-quarter on), and N = 8 is not the identity there.

**The directions** (`routeDirections`, `racerOf`; directions stay on the ticks, only the camera turns between them).
- **A computer racer** faces the route entry it drives along: the chord of the entry's rasterised points (`ai.js routeEntries`, points[0] to points[last]), turned into TRIG entries from the loaded table itself (the chord's angle from entry 0's vector, signed by cross(T[0], T[1])). No blended travel or smoothing, which would invent motion: a racer turns where its entry changes, which is where the game's own frame changes.
- **The convention check, per world:** humanCompass of the chord's angle (rounded) must be the entry's own compass word for at least `ANGLES.agreement` (95%) of the entries at least `ANGLES.minChord` (30) units long (`rd.derived-words` [PROVEN]: the chords lie within a cosine of 0.999865 of the angle word the compass word is the octant of). A world that fails, and a short entry anywhere (a single-point entry's chord would read as the direction 0), face the centre of the compass word's octant (k sector where humanCompass(k sector) is the word). On the maintainer's archive all 42 tracks keep the convention in every long entry (`check:enhance` section 8).
- **The other human** of a two player race or shoot-out faces its car's heading at the tick (the heading its compass word is made from, `versus.js viewRacers`); **the fly-in's human** (compass word 0, `render/scene.js introHuman`) faces that word's octant centre.
- **The camera** is the floor's heading: at 1x the whole camera's (moving between ticks with smooth motion), above 1x in detail mode 1 the fine heading round(h s) / s, the tick's with smooth motion off. The game's frame f is racerFrame at the heading the records were made by (`sceneRecords`' frames.heading: the tick's), so a record's bytes are the frame the game chose.

**Which records** (`angleRecords`, run in `renderEnhancedScene` once the records are built and the wide view's margin records joined). A record whose bytes are a direction frame (entries 0 to 7) of a slot of CARS.SP with a set:
- is **remapped** by its direction when it is a racer's record (type 1) of that slot, its bytes the direction frame the game's rule chose (racerFrame at the tick's heading and the racer's compass word) and the racer not hit (a hit racer's hitSpin walks the entries 0 to 7);
- is drawn from the set at its **own entry** q e otherwise, when it is another racer's record: a hit racer's spin, a racer's frame of another slot's bytes, so a slot's art stays one sheet;
- never: **the own car** (type 0, as the brief and the plan ask: its straight picture is entry 4 of its driver's slot, but its lean, drift, spin and crash pictures are the driver files', so all of them keep the archive's art or a frames entry's and the kart does not change its art as the player steers), entries 8 to 11 (the idle and glance pictures), GENEF.SP's crash and wreck pictures, the lion, the objects, the shots and the ducks (their DIGGER.SP frames follow another rule: frames packs may replace them).
- **An empty cell** (no opaque pixel: `art.js toArt`'s `filled`) is drawn as the game's frame from the set (its cell q f), and where that is empty too as the archive's (or a frames entry's picture of those bytes). So the template, whose in-between cells are empty, draws the original as it is.
- **Precedence.** A slot's set draws its eight direction frames for the other karts whatever frames entry of CARS.SP another pack has (a frames entry keeps the slot's other entries and the own car's straight picture); of two sets of one slot the later pack's wins.

**Drawing.** The remapped record is a shallow copy with `art: { asset, index, direct }`; `renderEnhancedScene` hands { art: asset, k: index } to `blit.js blitArt`, which samples it as a frames entry's picture (the cell of index k), at any scale, in stepped and smooth sizes, in the standard and the wide view. The contact and sun shadows follow the drawn silhouette, the fog and the grade its distance, the relief its logical source bytes (the game's frame's: the player's height map of that frame, else the generated body of the art itself). `opts.angleLog` (createEnhancer's `angleLog`, the checks') is told every record drawn from a set; `provider.hits.angles` counts them.

**The provider and the format.** `createArtProvider` keeps the sets by slot (`angles(slot)`, a later pack winning; `angleSlots`), and a pack of sets alone is active (`active(world)`). `normalizeArtEntry` takes an `angles` entry with N a multiple of 8 up to 64 and a whole number of the original's octants, a slot of CARS.SP whose eight direction frames are pictures the race draws (the region registry), the cars' 38 x 28, a box that fits its cell, `anchor` and optional `anchors` (a ground row a direction); the ground-row warning reads each direction's anchor, and empty cells are not checked.

**The template** (`art-template.js`, select 'ANGLES:<slot>' or 'ANGLES:ALL', `directions` N, not part of the whole world's template). q cells a row, a row an original frame: the original frame f in the row's first cell (index q f), the in-between cells empty, the anchors the originals' ground rows (an in-between cell the nearer original's). Beside it a guide picture (`extras`: no entry names it, an import never reads it): every cell's box and ground row, the originals, and in each in-between cell the two original frames around it faded in by how near each is (`ANGLES.guide`). NOTICE.txt explains it.

**The turntable** (the garage's *Art packs*, *Compare* a set). *Direction* turns the kart d entries from the camera (its compass word humanCompass of its heading), *Camera* turns the camera, *Turn* sweeps d through a full turn. It shows the archive's frame the game shows beside the set's locked and free index (an empty cell as what the race draws for it), each with its ground rows (red the archive frame's, cyan the art's lowest opaque row, yellow the declared anchor) and stood on the ground with its contact and sun shadows (`anchorStage`), and the whole set with the game's frame's cell (red), the locked (yellow) and the free one (cyan) marked.

**Departures from the plan, and why.**
- An empty cell draws the game's frame (from the set, else the archive's): the plan had no rule for one, and the template's in-between cells are empty, so imported as it is the template must draw the original rather than no kart at all.
- The template's guide is a picture beside the set, not in its cells: any pixel of a cell with an alpha above 0 is art to the race.
- A set draws its slot's direction frames over a frames entry whatever the packs' order: the two have different keys (the slot, the byte offset), and an in-between index has no frames entry to stand for.
- A short entry faces its octant's centre in a world that keeps the convention too (the plan used the centres only for a failing world): its chord gives no direction.
- `anchors` (a ground row a direction) beside the plan's single `anchor`, optional; the slot's direction frames must be registry pictures.
- The record carries `art: { asset, index, direct }`: the plan's { asset, index } and whether it was remapped, for the checks.

**Checks.**
- **`npm test`** (11 new tests, synthetic data only; 446 in all):
  - `test/angles.test.js`: the mapping from the game's functions (rear 4, sense +1, the octant centres; a mirrored table gives sense −1, a shifted one and a compass word that is the sector itself their own rear, and free at N = 8 is each table's frame at the sector centres, which a wrong sense misses); N = 8 locked and off are racerFrame for every camera heading 0..1919 times every segment angle 0..1919 (3,686,400 pairs: the plan's gate, but at N = 8 they are the game's frame by construction, q = 1 and floor(q/2) = 0, so this half cannot fail on the mapping), and over the same pairs free at N = 8, which can: it must be the game's frame moved by round(sense δ / sector), δ the racer's remainder in its octant less the camera's in its sector (the game rounds the two separately, free their difference), so the game's frame on three quarters of the pairs and one frame on in the sense on the other 921,600; a rear one off and a flipped sense both miss it (checked on a sample); through `angleRecords` at every heading for racers on 184 entries (every octant edge and three entries either side, every 16th entry): each record remapped to the game's frame; locked within floor(q/2) of q f for every N from 16 to 64 (every heading, every third segment angle), using the whole half octant, and the 119/121 case (f = 3; free at N = 8 draws 4; locked at N = 32 draws 14; off 12); free monotonic in d and wrapping once a turn for N = 8, 32 and 64 at three cameras (0, 121 and 1000.5: the racer's direction camera + d wrapped into the turn, wrapSigned of it less the camera, as `angleRecords` takes it; falling with the mirrored table); forged records never drawn from a set (the own car, entry 9, a hit racer at q f, a glance, GENEF.SP's crash and lion, an object, a shot, a racer of another slot's bytes, a skipped record, the ducks; the racer beside them remapped off q f, the game's records untouched); the fly-in's human and the other human of a shoot-out (its tick heading against a fractional camera); the convention check accepting a synthetic route (each chord within half an entry of its angle, a short entry at its octant's centre) and refusing a mirrored one (every entry at its word's centre) and a world of short entries; an empty cell drawn as the game's frame and, that empty too, as the archive's; `toArt`'s `filled` (indexed and RGBA), the provider's sets by slot (a later one winning) and a pack of sets alone active; the template of a slot (indexed p = 1 at N = 16, RGBA p = 2 at N = 24, indexed at N = 8): its choices, the entry taken with no warning, the originals in the cells q f and nothing else filled, the guide's faded originals, N = 8 drawing the archive's frame at every fifth heading.
  - `test/art-store.test.js`: two kart angle sets kept with their pack and read back (the slot in the id, the directions, `anchor` and `anchors` in the record), a picture of another size and an id of another slot refused.
  - `test/pack-format.test.js`: an `angles` entry against an archive (its slot's eight direction frames among the registry's pictures, the cars' size, N, the slot, `anchor` and `anchors`, the ground-row warning by each direction's anchor). `test/display.test.js` and `test/menu-logo.test.js`: RENDERING's six lines, KART ANGLES LOCKED, FREE, OFF and NONE (also without WebGL 2), its action and its place, the cycle LOCKED, FREE, OFF, every page list within six lines.
- **`npm run check:enhance` section 8 (kart angles):**
  - **The convention check** of all 42 tracks of the maintainer's archive: all keep it, in 100% of their long entries.
  - **Identity sets:** indexed N = 8 sets of every slot at p = 1 (the template's, built at run time from the archive) in locked mode; two enhancers draw the same state at the same blends, Enhanced with ARTWORK ON, one with no pack and one with the sets, with the page's palette (the demos' fade-in): every scenario, the link race's second seat and the slides demo at 1x, the first demos and the split screen also at 2x, wide and in smooth sizes: 32 runs, 2,560 pictures, each the no-pack picture byte for byte (the canvas, the index, the world).
  - **The bytes:** every record drawn from a set is logged (`angleLog`); for each remapped one the check works out the direction frame the game's rule chose from the drawn state itself (the seat's tick heading by `sceneCamera`, the racer's compass word and slot from the state or the seat's two player list, the fly-in's human's word 0, `carFrame`): 4,735 records (with the N = 32 runs), each with those bytes, and no record showing such a frame left unremapped; 16 hit racers' spins drawn at their own entries, and the own car never drawn from a set (before M4's review its straight picture was, 804 times in these runs).
  - **N = 32 sets** (RGBA, every in-between cell drawn as the nearer original) in locked and free mode on every fourth scenario: 392 karts moved off the game's frame in each mode, locked never more than two directions from q f.
  - It fails when the own car is drawn from a set (any logged record of type 0), and when nothing was remapped, no hit racer's spin drawn at its own entry, no set looked up or no kart moved. **It bites** (three throwaway copies of this tree in the system's temporary directory, deleted afterwards, `--only 8`): the game's frame worked out at the camera's heading instead of the tick's failed 11 of the 32 identity runs and 28 records of the N = 32 runs (direction frames left unremapped between ticks); locked drawing free's index failed 23 identity runs (index 4 where the game's frame is 3, and the picture with it) and 11 records of the N = 32 runs (more than two directions off); hit racers remapped failed the one run in which a hit racer's spin showed the direction frame (a remapped record whose racer the game shows spinning).
  - **Section 1** switches the tinted pack's N = 32 sets in free mode on and off among its fourteen settings changes: the same state with no draw, the reference draw and the enhanced draw in every scenario. The other sections give the counts they gave before; the full run: `check:enhance 22 scenarios, 0 problems`.
- **The template's way through a zip** (a probe of the Stage 4 job on the maintainer's archive, `~/.claude/jobs/2b4fea78/tmp/angles/roundtrip.mjs`, not committed): the angle sets of every slot at N = 32 (p = 1 and 2), N = 64 (p = 4) and N = 8, RGBA and indexed, with their guides, written as PNG, stored in a zip, read back under a folder and imported (`readPack`): 8 entries each, none refused, none warned of (the pack's one warning its LOCAL ONLY licence), every decoded pixel the template's own, every record kept as `savePack` keeps it (`normalizeArtRecord`), and each set's drawn cells exactly its originals' (q f).
- **`npm run check:identity`:** identical against `3f8af9d` (182 comparisons): the default settings (ARTWORK OFF, KART ANGLES LOCKED) and ARTWORK ON with no pack stored draw as before, and so does a pack with kart angle sets stored and ARTWORK OFF. Since M4's review Q's and Q2's tinted pack holds RGBA sets of 32 directions of every slot beside the whole race world (the template's, each in-between cell drawn as the nearer original's, red and blue swapped, each checked as an import checks it; the script throws when the provider has no set), and two new configurations, QF and Q2F, are Q and Q2 with KART ANGLES FREE (A's and O's pictures; the base commit drops the unknown setting). Before, the pack had no set (`buildTemplate`'s 'all' holds none), so the state every player who imported a set and left the artwork off is in went unguarded. It bites (throwaway copies of this tree, deleted afterwards, `--mode enhanced --ticks 40`): an `artFor` that draws the packs with ARTWORK OFF once a set is stored (the review's mutation, which the gate missed before) differs in Q and QF in all ten scenarios (20 differences); one that hands the scene the sets alone with ARTWORK OFF differs in Q and QF in demo 1, races 2, 3, 6 and 7 and the slides (12 differences), and a control copy handing it the same provider with no set is identical, so those differences are the sets'. Q2 and Q2F stay identical under both (Original's switches draw through the reference renderer's path).
- **Not checked in a browser** (docs/TODO.md: the main session's Chrome check): the turntable, the template's directions and guide in the garage, the race view's and the panel's *Kart angles*, KART ANGLES in the menu, a race with a set on the playtest page.

**Time** (node v26.8.1 on the MacBook Air, Mac14,2, M2, 2026-10-08, load average 3.8 to 4.8; a probe of the Stage 4 job, `~/.claude/jobs/2b4fea78/tmp/angles/atime.mjs`, not committed): every picture of the four attract demos, 300 ticks, five pictures a tick, drawn by every row in alternating order. The plan's budget is +0.1 ms over the pack's own row.

| Row | Mean | Median | 95th percentile |
| --- | --- | --- | --- |
| Enhanced 1x | 3.767 ms | 3.700 ms | 4.497 ms |
| Enhanced 1x + pack (RGBA p = 2: CARS.SP and the track's tile sheets) | 4.149 ms | 4.072 ms | 5.006 ms |
| + angles N = 32, locked (RGBA p = 2 sets of every slot, every cell drawn) | 4.155 ms | 4.063 ms | 4.997 ms |
| + angles N = 32, free | 4.150 ms | 4.069 ms | 5.016 ms |

- The sets cost 0.006 ms a picture (paired by picture, locked; free 0.002 ms): the records stage, where `angleRecords` runs and the sets' pictures are found, 0.400 ms against the pack's 0.375. `angleRecords` reads `carFrame`'s claim twice a frame, not once a record (it costs about 6 microseconds a call), and `racerFrame` once a remapped record (about 0.4 microseconds).
- The `check:enhance -- --time` row *+ angles N = 32* (one row after the other, not interleaved; `--frames 100`, load average 4.5) read 4.89 ms beside *Enhanced 1x + pack*'s 4.89 ms.


### Tools that make later milestones easier

Built: the viewer's previews (above) and the track editor's atmosphere preview (Stage 3). The roadmap's note: add an enhancement preview to the viewer and track editor after the first gameplay integration: a fixed camera, effect toggles, intensity controls and an Original/Enhanced comparison. The viewer can preview sprite anchors and replacement sheets; the editor can preview track atmosphere. Store enhancement metadata in a separate project section or sidecar with sensible defaults so existing tracks remain usable.

For efficient Canvas work, cache reusable visuals and separate layers with different update needs where profiling supports it; see [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
