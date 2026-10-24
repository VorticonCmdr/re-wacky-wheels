# Live voxel kart prototype

Branch: `codex/live-voxel-karts`.

## Run

Run `npm run dev`, open `http://127.0.0.1:5173/?voxels`, and load your local game.
The checkbox above the game switches live geometry on and off without changing
simulation state. Add `&debug` to expose the existing resolution, wide-view,
smooth-motion, shadow and fog controls. Resolution 2x is recommended for seeing
the voxel surfaces clearly.

The eight local models are copied into ignored `.local/voxel-karts/`. Vite serves
only the eight explicitly named JSON files from this directory in development.
They are not included in production builds. On a static build, use **Load kart
models** and select any or all of:

- panda-kart.json (UNO)
- camel-kart.json (SULTAN)
- moose-kart.json (MORRIS)
- pelican-kart.json (PEGGLES)
- shark-kart.json (RAZER)
- raccoon-kart.json (RINGO)
- elephant-kart.json (BLOMBO)
- tiger-kart.json (TIGI)

On 2026-10-24 all eight local kart JSONs were replaced with the 32-cell models
from `/Users/valentin.pletzer/projects/python/voxel-mcp/output/`. Previous assets
are retained in ignored `.local/voxel-karts-before-32/`. Replacement files are
byte-for-byte copies; all eight validate and retain four animated wheels plus
the driver part. Wheel detection supports both the old 48-cell construction and
the new wheel centres/radius/colours. The fixed sprite-width calibration and
continuous perspective are unchanged, so the new shorter proportions are kept
without making resolution determine physical size. Reload the game to replace
models already held in browser memory.

Kart calibration was compared live against the original sprites at the same
paused race position on 2026-10-24. The former 92-unit, downward-tilted chase
camera made the kart too wide and placed it high on screen. The track camera now
sits 124 units back, 39.5 units above the ground, with a level view. A shared
physical-scale helper accounts for the near side of a 3D mesh; wheels, shadows,
reflections and skid contacts use that scale. All eight compact meshes measure
35.69 projected pixels wide and contact row 192.35, versus 36 and 192 for the
original rear sprites. Their unmodified driver silhouettes remain taller than
the flat sprites (about 33–35 pixels overall versus 26–27). Models stay grounded
at world height zero, and size continues to vary smoothly with distance.

The legacy track renderer and original sprites remain selectable. The fly-in
and countdown share the calibrated camera, checked across all 42 layouts.

Imports stay in memory for this page session. Files are Voxel Studio projects:
`{size, voxels: [[x,y,z,r,g,b], ...]}`; +Y is up and +Z is the nose. Invalid
coordinates, duplicate cells and excessive geometry are rejected. A missing
model retains its original sprite.

## Rendering

### Voxel terrain on all tracks

**Reduce distant shimmer** defaults on. The 3D scene uses up to four-sample
multisample antialiasing (the common supported color/depth sample count) and
distance mipmaps for the track texture. Magnification remains nearest-neighbor;
there is no full-frame blur or temporal accumulation, and the HUD is unchanged.
The checkbox restores single-sample rendering and nearest texture sampling
immediately for comparison. Unsupported or incomplete multisample targets fall
back to the ordinary framebuffer while retaining the texture improvement.

**Panorama and detailed sky** restores each track's original `.PAR` skyline in
the 3D view. It scrolls smoothly with camera heading at infinity, behind all
terrain and scenery. The archive's sky palette ramp is transparent so a new
gradient and slowly drifting cloud layer show through. Night adds sparse,
gently twinkling stars; dawn and dusk add a warm horizon. Existing time-of-day
controls drive the sky and panorama lighting. The toggle restores the previous
plain sky for comparison. Water reflections include the same skyline, clouds and stars, mirrored behind
the reflected geometry and distorted by the existing waves. The outer voxel
landscape and its trees, rocks and bushes also appear in the reflection pass.
**Sky color only comparison** retains the previous simple water fill.

**Voxel terrain (all tracks)** defaults on in the 3D track renderer for all 42
layouts. Dry road surfaces are identified from each track's route, including
sand, ice and boost surfaces, and remain at height zero. Existing route
crossings through liquid stay liquid. The map's surface masks produce
8-unit terrain cells with exposed side faces: 1.5-unit checker curbs, stepped
sandy verges up to 6 units, a raised grassy infield up to 12 units and solid
12-unit barrier edges. Horizontal faces are merged into runs to reduce geometry.
Outside the 2048-unit track map, a cached decorative voxel landscape continues
the ground in all directions. Coarser 64-unit terraces form low hills, colored
for grass, sand, snow or earth from the track artwork, and fade into distance
haze. It never overlays the playable map or expands the collision boundaries.
The panorama base fades into the horizon instead of ending in grey filler.
Turning off voxel terrain also removes the exterior for comparison.
The exterior includes deterministically scattered voxel trees, rocks and bushes.
Grass uses leafy trees and green shrubs; sand and earth use sparse dry canopies,
scrub and warm rocks; snow uses capped conifers, shrubs and stones. Placements
keep the entire footprint outside the map and on one supporting terrace.
These decorative models are baked into the exterior mesh, so they share its
lighting and fog without adding per-object draw calls or gameplay collisions.
Scenery and off-road karts stand on the rendered terrain; the chase camera
follows the player's ground height. Driving physics and wall collisions remain
the original two-dimensional rules; this is not a hills-and-ramps physics pass.
Player and AI karts sample four tyre footprints for terrain pitch and roll.
Damped suspension gives curb crossings a short compression and rebound, with
no periodic bounce on level roads. Tilt is limited to about 18 degrees per axis;
the camera follows the support height with gentler damping. Wheels share the
body transform and retain their steering and spin. Crashes, jumps and dives
keep their existing poses, and respawns reset suspension momentum. Turning off
voxel terrain also disables this terrain response for the flat comparison.
**Off-road dust and dirt** defaults on and can be toggled separately for comparison.
Moving player and AI rear tyres leave short dust puffs and small tumbling dirt
clumps on dry verges and banks. Emission follows distance travelled, starts at
the terrain height, and skips road cells, walls, water, jumps and crashes.
Trails stop while stationary, expire within 1.1 seconds, and share a bounded
128-event budget. Flat-terrain comparison disables these trails as well.
Each tyre picks its particle material from the underlying tile's masked artwork:
warm sandy dust and grains, green grass flecks mixed with brown soil, neutral
dirt, or pale snow powder with gentler gravity and more drift. Mask-region color
averages keep speckled textures from flickering between materials. The material
is retained for each particle's lifetime, and uses the base palette so night
lighting does not turn snow into dirt. Snow is selected on pale, low-saturation
surfaces rather than by a hard-coded track number.
Existing water and red liquid retain their original colors and locations,
with stepped shoreline banks. Non-diving blue water now has a bed 2 units below
the road, a surface 0.6 units below it and gentler waves, making crossings shallow.
Diving surfaces (6 and 15), red liquid and the decorative pond retain recessed
water 8 units below the road and deeper beds. Road cells take priority at mixed shoreline cells. Kart
and scenery placement, periscopes, splashes, shadows and water reflections use
the recessed level. Dry tracks do not gain invented ponds.
Splash droplets use the local water height. Moving-water trails also emit small
sprays beside both tyres so the kart body does not hide all crossing feedback.
Shallow blue water blends over a grainy sandy bed. The liquid mask carries
water depth for absorption and opacity: deeper pools become darker and more
opaque, while grazing angles increase reflection and surface coverage. The
existing skyline, cloud, star and scenery reflections remain visible above the
bottom. Red liquid remains opaque; flat-terrain comparison retains its prior look.

Track 1 originally has no water. A decorative pond is added inside the existing
infield barrier, away from the racing route, with terraced sloping banks, a bed
18 units below road level and water 8 units below road level. Waves and planar
reflections use that recessed level. The pond does not add a new gameplay water
hazard. Flat-water comparison keeps a still pond surface. Turning off Voxel
terrain restores the original flat track and original water level, and removes
track 1's decorative pond. Terrain also occludes headlight beams. All 42 layouts
are checked for finite meshes, level dry routes and preserved liquid types.

### Kart headlights

**Kart headlights** switches on two warm emissive lamps per kart in the 3D
track renderer. A soft forward beam lights actual world surfaces ahead of each
kart, using its position and heading. Beams reach 280 world units, fade at the
edges and end, and become stronger at dusk/night while staying subtle by day.
The player and up to seven AI karts share this bounded light pass. Switching the
checkbox off clears both the lamps and illumination on the next frame.

Lamps follow body tilt and appear in water reflections. Hidden karts emit no
light; airborne, sinking or rolled karts keep visible lamps without a road
beam. The original renderer remains selectable.

**Headlight shadows** (on by default) makes solid voxel scenery and other karts
block each beam using the current animated geometry. Eight filtered 256-pixel
depth maps share a reusable atlas; objects outside each beam are skipped.
Disable this separately to compare unoccluded lighting or reduce GPU work.
Original billboard scenery is not a solid shadow caster. If the depth target
is unavailable, the renderer keeps the unshadowed headlights.

**Smooth voxel motion** (on by default) interpolates camera position, kart
heading, steering lean and opponent direction between simulation ticks. Lamps
and shadow maps follow the same interpolated poses, including across heading
wraparound. Disable it to compare the original stepped motion; the sprite
renderer keeps its separate Smooth motion setting. Neither changes physics.

### Tail and brake lights

**Tail and brake lights** adds two red emissive rear lenses to every visible
voxel kart in the 3D track renderer, including water reflections. The normal
tail lights stay dim red; accepted player brake/handbrake input makes them
bright red-orange, even when stopped. AI racers have no brake pedal: a decrease
in their route advance triggers a three-tick brake-light pulse. Hits and crash
poses suppress that pulse. These signals do not change driving physics.
The switch is independent of Kart headlights and defaults on.

**Lamp glow** (on by default) adds soft warm headlight halos and red rear-light
halos in the 3D track view. They fade in with dusk/night lighting and disappear
in daylight; braking widens and strengthens the rear glow. Halos follow kart
tilt and physical size, fade when viewed edge-on, and are depth-tested against
the scene. This is a lightweight additive halo, not full-screen bloom; water
reflections retain the emissive lamp lenses. Disabling it preserves the lamps,
brake signals and track illumination for comparison.

### Time-of-day selection

The always-visible **Time of day** selector above the race offers **Day**,
**Dusk**, **Night**, **Now (local time)** and **Track settings**. Changes take
effect during racing or while paused and are remembered in browser storage.
Selecting a mode enables Track lighting. The Original graphics preset can still
disable lighting for an ungraded comparison. Soft / Sunny / Toy-like remain
independent voxel lighting styles.

Now uses the computer's local clock: dawn 06:00–08:00, day 08:00–18:00,
dusk 18:00–20:00, and night 20:00–06:00. It is a clock-based artistic preset,
not a location-based sunrise calculation. Track settings restores the saved
track-editor atmosphere; changing the race selector never overwrites it.

Sprite rendering uses the existing atmosphere grades. Voxel rendering applies
the same selection to sun/sky fill, surface tint, sky background, water and
reflections; the HUD and menus keep their original colours. Day, Dusk and Night
were checked in a live 3D race, and Dusk was checked with original sprite karts.

`src/voxel/mesh.js` builds exposed-face meshes once at import. Internal faces are
removed. Colors and flat normals are interleaved in one GPU buffer per model.
This is real geometry rendered every frame, not a directional sprite atlas.

`src/voxel/karts.js` adapts the enhanced renderer's already-placed kart records.
The mesh keeps the game's ground anchor. Its fixed physical size is calibrated
to the opaque rear sprite's width at the player's camera distance, then scales
continuously with depth. It rotates using
camera-relative heading. The own kart also has a small whole-body steering pose.
It never writes simulation state. Special animations without a mesh adapter fall
back to sprites; screen-relative hops continue to use the existing record anchor.

`src/voxel/gpu.js` draws into the existing display's world texture. A GPU depth
attachment resolves mesh faces and intersections between karts. A float texture
of existing scenery/effect distances provides billboard occlusion. The HUD is
composited after the meshes, followed by the existing display pipeline. There is
no per-frame GPU-to-CPU pixel readback. GPU buffers remain cached for up to eight
slots; replacing a visible slot releases its previous buffer.

Voxel karts always receive model-sized contact shadows through the enhancer’s
floor-only shade layer, alongside its existing fog ramp/color. Saved
race layers retain the mesh draw description and a copy of their occlusion mask.
Context loss falls back to the CPU renderer; restoration rebuilds GPU resources.

## Deliberate prototype limits

- The track and scenery remain the original renderer. Kart geometry uses a local
  perspective projection at the existing record anchor, not a unified 3D world
  camera. Widescreen positions use the port's established projection; the shape
  of each mesh is an approximation of that projection, especially near edges.
- Scenery remains flat depth-tested billboards. Flat ground is behind the anchored
  karts, not a reconstructed 3D terrain mesh. There is no terrain-height collision.
- Lighting follows the track sun direction and elevation, with warm sunlight,
  cool hemispherical sky fill, linear-color shading and vertex ambient occlusion.
  Meshes cast their geometry onto a flat ground plane; scenery and other karts
  do not receive these shadows, and there is no mesh self-shadowing.
- Wheels on the eight supplied models roll and steer; driver parts remain rigid.
  Lean is a presentation pose. Spin, crash,
  pit and other unsupported own-kart animation tables retain original artwork;
  hit/crashed opponents likewise retain sprites. Idle head poses are static.
- Local split-screen and duck mode retain sprites. Single-view network races use
  the same adapter, but have not been manually validated in two connected browsers.
- CPU-composited particles do not write the scenery depth texture, so mesh/particle
  overlap is not yet fully depth-correct. Model colors do not receive the full
  track color-grade pipeline.
- Snapshot CPU image data and the developer close-up's CPU fallback do not contain
  mesh pixels; the visible WebGL display and retained GPU draw descriptions do.

## Verification

- `npm test`: existing suite plus mesh validation and adapter/fallback tests.
- `npm run lint` and `npm run build`.
- Manual browser checks: eight models loaded, intro lineup, driving and turning,
  1x/2x rendering, widescreen, pause overlay, and live/original toggle. Browser
  graphics logs were checked for errors.
- `npm run check:enhance` exercises the existing reference/enhanced presentation
  invariants with local originals. It does not by itself validate GPU mesh pixels.

Performance counters in the page are CPU submission/composition timings, not GPU
benchmarks. A target-device GPU benchmark and full effect/animation matrix remain
necessary before treating this prototype as a release renderer.

Completed validation on 2026-10-23: 459 tests passed; lint reported zero problems;
production build passed; `check:enhance` completed all 22 scenarios with zero
problems. The preview screenshot is in ignored `.local/live-voxel-preview.png`.

## Lighting comparison

The **Lighting** selector above the race switches instantly, including when paused:

- **Soft**: broad sky fill, gentler sunlight, light crevice shading.
- **Sunny** (default): warm direct sunlight and cool shaded faces, balanced AO.
- **Toy-like**: brighter light, stronger crevice contrast and restrained glossy highlights.

The choice is remembered locally. Presets change only presentation uniforms; no
model rebuild or simulation reset occurs. AO is baked into mesh vertices at load
time from adjacent occupied cells, with diagonal selection to reduce interpolation
seams. It affects ambient fill and highlights rather than painting dark outlines
on every voxel. RGB asset colors are decoded to linear light and encoded back to
sRGB before entering the existing display/fog pipeline. Highlights currently use
one material response for the entire kart; per-material tires/paint/metal remain
future work.

Lighting validation: 460 tests passed, including exposed/sheltered AO corners;
lint and production build passed. All three presets were checked in a paused
race, with no browser graphics errors.

## Ground contact shadows

Live voxel karts cast a soft footprint sized from each model's bounds and rotated
with its heading. This is enabled whenever a live kart is rendered, including
with the Original graphics preset; the general Contact shadows checkbox still
controls sprite karts. The existing Shadows strength scales the contact shading.
The replaced sprite's shadow is omitted, so enabling both does not double-darken
the voxel footprint. Overlapping contact patches use the stronger shadow.

The player shadow stays at the ground row during hops, shrinking and fading as
the kart rises. The patch shares the mesh's scale, pitch and ground offset, works
on both reference and output grids (including widescreen), and darkens only floor
pixels before fog and HUD composition. Crash/pit and missing-model fallbacks keep
the original sprite-shadow rules. These contact patches accompany the GPU directional silhouettes described below.

Ground-shadow validation: 461 tests passed; lint and production build passed;
the full `check:enhance` run completed 22 scenarios with zero problems. Browser
checks covered 1x/2x, widescreen, driving and turning, with no graphics errors.
Focused tests cover footprint rotation, hop fading, clipping, non-additive overlap
and matching reference/output grids. Preview: `.local/voxel-shadow-preview.png`.

## Directional shadows and kart sizing

The GPU draws each live mesh a second time, projecting its vertices away from
its lighting sun onto the ground plane. Rotation and hop height affect the cast.
All faces and karts combine into one R8 mask using maximum coverage, so overlapping
triangles do not stack darkness. A small weighted filter softens the mask before
floor-only compositing, then the solid karts and HUD draw above it. The mask is
reused across frames, resized with the view, and requires no GPU readback.

The lighting presets also control cast shadows: Soft is lighter and broader,
Sunny balanced, Toy-like darker and sharper. Shadow opacity fades with the
caster's fog amount. Direction/elevation use the same track sunlight as the mesh
shader. Voxel casts are automatic; the general Sun shadows checkbox continues to
control the existing sprite casts. Contact shading remains beneath the tires.

The old fit constrained the full model to the sprite rectangle's height as well
as width. For the tiger's 40 x 43 x 41 model, this made its body about 20 reference
pixels wide versus the original rear sprite's 36 opaque columns. The new fit
uses that measured rear width, keeping a stable scale across heading changes and
preserving the model's proportions. Tall drivers can extend above the original
sprite rectangle. This changes presentation only, not collision or driving.

Directional-shadow validation: 463 tests passed; lint and production build
passed. Browser checks covered preset switching while paused, sun-direction
changes, mesh/sprite comparison and the GPU's graphics logs. The full renderer
regression from the contact-shadow pass remains the previous baseline; it was
not rerun for this GPU-only shadow pass and voxel sizing change.

## Wheel animation

The eight supplied 48-cell models share four complete cylindrical tire/hub
assemblies at the axle positions documented in their build scripts. Import
recognizes that complete construction and meshes the body and each wheel as
separate ranges in one cached buffer. Faces between moving parts are retained;
ambient occlusion does not bake one moving part into another. Unknown or edited
models that fail the complete-wheel check remain rigid.

All four wheels roll around their axle. Only the front two steer, using the
player's steering pose; opponents derive steering from heading change relative
to distance travelled. Roll phase accumulates signed world travel divided by
wheel radius, scaled consistently with the kart. Per-racer phase is interpolated
between simulation ticks using the frame blend, even with body smooth motion off.
Repeated redraws and pauses do not advance phase; stops hold it, reversing rolls
backward, and race resets, teleports or visibility gaps rebase it.

The vertex shader rotates positions and normals around each wheel pivot before
kart yaw. The geometry and directional-shadow passes use the same wheel pose.
No source asset or physics data changes, and no meshes are rebuilt per frame.

Wheel validation: focused tests cover complete-part extraction, retained boundary
faces, unknown-model fallback, distance/speed scaling, reverse/stop/pause/reset,
steering interpolation, opponent turns, and adapter integration without state
mutation or geometry rebuilds. All eight local models produce four moving wheels.
Live browser verification was blocked by the browser tool's URL security policy;
visual motion and performance still need a manual race check.

## Continuous perspective

Voxel size no longer comes from the original renderer's ten sprite-size classes
or its optional smooth interpolation between those classes. The opaque rear
sprite width calibrates a fixed number of world units per voxel at camera
distance 124. Every draw uses focal length times physical size divided by depth.
For a 36-pixel reference width, distances 124, 248 and 496 produce centre-plane
widths of 36, 18 and 9 reference pixels. Rendering at 2x doubles output pixels,
not physical dimensions. Tall drivers retain their model proportions.

Opponent depth comes from the existing fractional camera projection of their
current presentation position, including the intro human and network opponent.
Ground anchors and widescreen placement continue to follow the track renderer.
The player's camera distance stays fixed. GPU vertex depth, rolling wheel radius,
wheelbase, contact footprints and projected sun shadows share the same physical
scale; wheel roll per travelled world unit cannot change with camera distance.
This remains a local mesh projection over the original track, not a conversion
of the entire track/scenery to a unified 3D scene.

Perspective regression tests cover inverse-depth sizing, fixed wheel dimensions,
1x/2x scaling, shrinking contact shadows, fractional opponent depth and crossing
sprite-size boundaries without jumps. Live browser inspection remains unavailable
because of the previously reported browser URL security restriction.

## Track 1: live 3D scene prototype

Choose **Renderer → 3D track 1 prototype** in the voxel controls. This enables
voxel rendering; all eight kart models must be loaded. Choose **Current renderer**
to compare during the same race. The default remains the current renderer, and
the selection is session-only.

The first track now has a separate WebGL scene sharing one perspective camera
and depth buffer across a textured ground plane, articulated karts, scenery, and
remaining object billboards. The ground texture is decoded directly from the
64 × 64 tile map and the two original tile sheets, preserving the road, terrain,
and start-line layout. The camera follows 92 world units behind the player and
38 units above the ground. Kart sizes remain fixed in world units. Steering,
wheel roll, lighting presets, and directional planar shadows apply in this view.
Nine placements of OB1.SP and OB8.SP use fully volumetric voxel models: three
rounded, hollow tyres with recessed tread grooves, and a shorter stack around a
wooden post with grain and end rings. The models are authored procedurally in
`src/voxel/scenery.js`, independently of sprite pixels. Both have a 28 × 28
footprint; heights are 27 and 28 cells, retaining the original approximate size.
Only exposed faces are uploaded, with vertex AO and the shared scene lighting
and shadows. Object positions, consumption, and collision logic are unchanged. Other objects retain their
animated, transparent artwork as depth-tested billboards. Fired projectiles have
small voxel markers. No simulation, route, collision, pickup, or lap logic changes.

Scope: track 1, single-player, after the countdown. The fly-in, countdown (with
its starter), other tracks and multiplayer retain
the current renderer. Crashes, hits, and pit sequences stay in the 3D scene: the
player follows the crash height and spin, pit karts sit lower in the ground,
and the simulation’s hidden/gone states remove karts until they reappear.
These are voxel approximations of the original animation frames. The camera
stays attached to the player’s position throughout. A missing
kart model also retains the current renderer rather than hiding a racer. Road
geometry is flat; there are no elevation changes or volumetric water. Shadows
are planar silhouettes, not a shadow map on scenery. Original sky artwork,
particles, skid marks, and the original per-frame crash/pit artwork are not yet ported to this scene.
The prototype uses a simple sky color and distance haze.

Resources are cached per loaded world; replaced kart meshes and old track
resources are released. The existing HUD, pause layers, resolution settings,
CRT processing, and WebGL context-loss fallback remain in the display pipeline.
The existing CPU renderer still runs underneath this prototype, so this pass
should not yet be treated as a performance optimization.

Validation: real track 1 data decoded successfully (2048 × 2048 texture, two
scenery meshes); a 400-tick simulation produced finite 3D frames with eight
racers. All 468 existing tests, lint, and the production build pass.
Live browser inspection is still blocked by the browser URL policy rejection;
visual appearance, shader execution, and interactive renderer switching have
not been verified in the browser.

Crash/pit continuity validation: eight scenarios using the loaded track 1 state
(normal, crash flight, pit, hidden player, gone wreck, AI hit, gone AI, recovery)
kept the 3D scene and the same camera, respected visibility, and left simulation
state unchanged. The 28 existing voxel/display tests, lint, and build pass.
Browser visual verification remains unavailable.

Scenery revision validation: inspected a standalone angled mesh preview, checked
full depth and open tyre centres, and ran the 28 existing voxel/display tests,
lint, and production build successfully. This preview is not a browser race
capture; in-race visual verification remains unavailable.

### Voxel Studio comparison

The **3D scenery** selector switches between **Procedural** (default) and
**Voxel Studio** during the same race, including while paused. It applies only
to the 3D track view. Both asset sets use the same positions, physical width,
lighting and shadows; the switch rebuilds only the scenery meshes, releases
superseded GPU buffers, and leaves the road texture, camera and simulation alone.
The two editable Studio projects are bundled under `src/voxel/assets/`, with
MCP authoring details in that folder's README. Running Studio is not required
for playing. Changes in Studio are not automatically synchronized to the game;
the bundled JSON files are the exported versions.

Validation: Studio front/top views and the post's right view inspected; standalone
four-model comparison inspected; finite mesh coordinates and full-depth bounds
checked. All 28 existing voxel/display tests, lint, and production build pass.
In-race visual verification remains unavailable due to the earlier browser policy
block. The standalone comparison is `.local/scenery-comparison.png`.

### All track 1 objects in Voxel Studio mode

**3D scenery → Voxel Studio (all track 1 objects)** now replaces the remaining
matchbox, bomb, newspaper hedgehog and yellow-prop hedgehog pickups. These models
were created and inspected through the Voxel Studio MCP and exported as editable
JSON. They receive the scene's lighting, AO and planar shadows and use a small
idle sway driven by each object's frame counter. Collection still removes the
object according to the original consumed flag. The original frame-by-frame
pickup gestures are approximated, not replicated.

**Procedural + original pickups** keeps the earlier comparison: procedural tyre
props plus animated pickup billboards. Switching restores the correct object
representation in either direction without changing simulation state.

Validation: all 13 stock track 1 placements resolve to finite voxel meshes in
Studio mode; exactly nine resolve in comparison mode, leaving the four intended
billboards. MCP views and a standalone angled preview were inspected. The 28
existing voxel/display tests, lint and build pass. Browser race verification
remains blocked; `.local/studio-pickups-preview.png` is a standalone mesh preview.

### Articulated pickup animation

Studio hedgehogs now have separate head and prop meshes: the reader nods and
turns its head while lifting/tilting the newspaper; the yellow-prop hedgehog nods
and sweeps its arm/prop. Feet and bodies remain planted. The bomb ember flickers
in scale, warm tint and emissive brightness, without moving the bomb or glove.
This replaces the earlier whole-object sway. Matchboxes and tyre props remain
static. The comparison selector still restores procedural props and original
animated pickup billboards.

`pickup-motion.js` splits the exported Studio cells into rigid parts before
meshing, exposing joint faces and calculating AO separately for each part.
Original exported JSON stays editable and unchanged. Mesh buffers are uploaded
once; only part uniforms change during animation. The same part transforms are
used in the solid and directional-shadow passes. The ember's emissive material
does not add a point light to nearby surfaces. All uniforms reset per part so
pickup animation does not affect karts, track or billboards.

Animation uses the existing interpolated presentation time, with a stable phase
per object; paused frames and retained snapshots keep their pose, without wall
clock timers or simulation writes. Consumed pickups continue to be omitted.

Validation: all three rigs have finite vertices, complete part coverage and
repeatable poses at the same time; their animated parts change over time while
the body pose stays fixed. Procedural mode still returns billboard fallback for
these pickups. The 28 voxel/display tests, lint and build pass. Standalone motion
preview: `.local/pickup-motion-preview.gif`; browser visual verification remains
blocked, so this is not a race capture.

### Voxel collection feedback

Confirmed pickups now briefly pop upward, spin and shrink away, accompanied by
eight gold voxel fragments. The effect lasts 650 ms and applies to whichever
objects have voxel models in the selected comparison mode (all pickups in Studio
mode, tyre pickups in procedural mode). Original billboard pickups retain their
previous comparison behavior. Moving collection meshes and fragments also cast
planar shadows.

The presentation observes `player.taken` after simulation ticks and accepts only
objects marked consumed. It does not infer collection from visibility, proximity
or a missing sprite, and never changes inventory, rewards, collision or sound.
Events are deduplicated per tick, bounded to 32, and cleared on presentation
reset, track change or time rollback. Effect poses use interpolated presentation
time, freeze when paused, and are retained in frame snapshots. Meshes and the
shared fragment cube are cached; animation does not rebuild geometry.

Validation: checked confirmed/refused events, duplicate ticks and duplicate event
indices, pause-repeatability, expiry, rollback, reset and simulation immutability.
The 28 existing voxel/display tests, lint and build pass. Live visual verification
remains unavailable because of the browser access restriction.

### Voxel impact feedback

The 3D track renderer adds six bright spark voxels and four small debris cubes
on confirmed contact transitions: object hit markers, player/racer contacts,
new AI stun or crash states, projectile collision codes, and the player's
collision spark reset/crash onset. Sparks scatter quickly and disappear after
360 ms; tumbling debris follows a gravity arc and shrinks over 700 ms. Wooden
obstacle contacts use brown debris; kart contacts use blue-gray metal debris.
These are visual chips, not persistent destruction or additional collision bodies.
Debris casts planar shadows; bright sparks do not cast shadows or illuminate
nearby objects.

The effect works in both 3D scenery comparison modes. It uses presentation time,
freezes on pause, retains snapshot poses, and never writes simulation state.
Existing crash, damage, projectile and sound behavior is unchanged. Nearby reports
within 160 ms are coalesced, persistent hit/stun states emit once, and at most 24
recent bursts are retained. A new world, rollback or presentation reset clears
old events. Normal collection and projectile expiry without a collision code do
not create impact bursts. Particle geometry is shared and uploaded once.

Validation: exercised obstacle hits, kart stuns, projectile collisions, bump
signals, repeated ticks, persistent hits, coalesced reports, pause-repeatability,
expiry, rollback/reset, non-impact collection and unchanged simulation state.
Fragment lifetimes and finite positions checked. The 28 existing voxel/display
tests, lint and build pass. Browser visual verification remains unavailable.

### Impact camera shake

The **Impact camera shake** checkbox controls a presentation-only translation of
the 3D chase camera. Small hits decay over 240 ms; major crashes decay over
420 ms with stronger motion. Nearby coalesced impact reports can upgrade from a
bump to a crash without spawning another debris burst. Distance attenuation is
measured from the player and reaches zero at 180 world units. Combined camera
translation is capped at 1.1 world units, with no roll, zoom, or HUD movement.
The original renderer is unaffected. Existing impact particles remain visible
when shake is disabled.

The preference is stored as `wacky.voxel.cameraShake`; with no saved preference,
reduced-motion users start with shake off. Changing it takes effect on the next
race draw without resetting the simulation. Shake samples the same presentation
time as impact effects, so pauses freeze it and resets clear its source events.

Validation: checked disabled/distant/expired/initial-time zero offsets,
deterministic paused sampling, stronger crash response, stacked-impact bounds,
and an existing bump upgrading to a crash. The 28 existing voxel/display tests,
lint and build pass. In-race visual tuning remains unverified because browser
access is still blocked.

### Tyre smoke and skid marks

The controlled voxel kart now leaves paired ground marks and gray voxel smoke
when the game's snapshot reports a skid (drift/handbrake state or the braking
skid sound). Rear contact points use the actual articulated wheel pivots and
fixed physical kart scale. Marks follow wheel travel, rather than the camera or
sprite anchors. Stationary wheels, normal driving, airborne/crashed/pit states,
unsupported surfaces, and teleport-sized movements do not emit trails. Models
without a recognized rear-wheel rig do not invent contact points. AI racers have
no explicit brake/drift state in this port and do not emit speculative trails.

Marks are depth-tested ground strips, held for 5.5 seconds then faded over 2.5
seconds; the newest 256 segments are retained. Smoke puffs expand, rise and fade
over 800 ms, emitted at most every 75 ms per rear wheel, capped at 48 puffs.
Smoke is depth-tested and blended back-to-front without writing depth. Neither
marks nor smoke cast shadows. Both use the presentation clock and freeze on
pause; resets and track/tick changes clear history. The feature applies to the
3D track renderer in both scenery comparison modes. Existing CPU-renderer skid
settings remain separate. Driving physics and race state are unchanged.

Validation: checked emission, stationary/normal/airborne/pit/crash/water/teleport
suppression, duplicate ticks, deterministic paused frames, expiry, caps and
reset. The 28 existing voxel/display tests, lint and build pass. In-race visual
verification remains unavailable because browser access is blocked.

### Kart animation coverage in both voxel renderers

Loaded kart models no longer fall back to sprites for lean/drift, spin, bump and
look-back, wobble, finish pose, crash flight/fall, pit or wreck states. The shared
`kart-pose.js` maps every driving picture table to live geometry transforms.
The eight known kart constructions also have a separately meshed upper-driver
section for look-back and finish poses, in addition to the four moving wheels.
The cut is based on the model height; these are stylized rigid-part adaptations,
not anatomically rigged or frame-for-frame reproductions of the original driver
sprites. Unrecognized models remain rigid but still use the whole-kart poses.

Both the original-track voxel overlay and the full 3D track use the same pose
mapping, including their directional-shadow passes. The original-track overlay
retains the simulation's projected crash/hop height; the 3D track retains world
height and pit sinking. Hidden/gone states still remove the mesh intentionally.
In both voxel rendering modes, the water swimming state now replaces the kart
with a voxel periscope: a metal tube, forward elbow and blue glass lens. It bobs
and scans using presentation time, so pausing freezes the animation. Entering
the original swimming state starts a 650 ms eased dive: the kart sinks while
the periscope rises. Leaving swimming restores the kart at its ground anchor
immediately and removes the periscope, even halfway through a dive, so it cannot
rise through a solid bank. Crashes, jumps, teleports and race resets also clear
the transition. The fully submerged kart emits
no headlight beams, rear lights or halos.
In the 3D track view, **Dive bubbles and splash** adds a short stream of hollow
voxel bubbles during sinking and one small droplet/foam burst when the kart resurfaces. The exit burst stays at the last wet position, and all
particles are clipped to water and follow the animated surface. Emission is
bounded, uses presentation time, freezes when paused, and clears on restarts,
teleports or crashes. The switch defaults on and provides an independent
comparison without changing the dive animation, initial splash or wakes.
Flat-water comparison also disables these effects.
The periscope participates in depth, shadows and water reflections. Lava,
jumps and crashes keep their separate poses; the current renderer remains
selectable for comparison with the source sprite animation.
The intro human can be captured as a voxel racer. The track's fly-in/countdown
still use the existing track renderer, but their karts can remain voxel models.
Non-kart sprite effects and HUD art are not converted by this change. Missing
models, unavailable WebGL, duck mode and local split-screen retain their existing
fallbacks; animation-table selection itself no longer causes a sprite fallback.

Validation: all eight local models retain four wheel parts plus one driver part,
with complete finite mesh ranges and unchanged source JSON. Every table across
17 rows produces finite deterministic poses. Updated the previous fallback
regression assertion to require voxel capture across all kart animation tables,
crash and pit states. Focused voxel/display checks, lint and build pass. Browser
visual verification remains unavailable; joint cuts and poses need in-race review.

### Voxel weapons and prototype defaults

Live voxel mode now starts with **3D track 1** and **Voxel Studio scenery**
selected. The current renderer and procedural scenery remain selectable, and
turning live mode off/on preserves comparison selections within the session.
The existing track/mode/model-availability restrictions still apply.

The 3D track now draws separate volumetric hedgehog, fan fireball, devil, bomb,
oil, inverted hedgehog and ice models. These small models are generated in
`src/voxel/weapons.js`; they are not new Voxel Studio MCP exports. Moving weapons
have tumbling or trailing voxel details; bombs have a flickering fuse. The
simulation's three explosion frames produce expanding voxel fragments, with ice
shards and oil droplets for those weapons. Existing longer-lived collision sparks
and debris remain in place. Solid weapons cast the same sunlight shadows as
scenery; fire and sparks are emissive. Sizes use world units and camera depth.

Shot snapshots preserve slot indices, type, block, animation state and lane;
heading comes from the same helper as gameplay movement (including fan lanes and
devil reversals). No hit rules, spawn limits, damage or lifetimes change. Effects
are deterministic from presentation time and shot frames, so pausing freezes them
and empty/restarted shot lists leave no trails behind. The current-renderer
comparison retains its original weapon sprites.

Validation: 470 tests pass, lint reports zero problems, and production build
passes with the existing large-chunk warning. A standalone mesh preview was
inspected for all seven weapons. Live browser visual verification remains blocked
in this session; this preview is not an in-race capture.


### Voxel Studio weapon comparison

Seven higher-detail weapon alternatives are now bundled from Voxel Studio MCP
exports (see `src/voxel/assets/README.md` for authoring provenance). The new
**3D weapons** selector defaults to **Voxel Studio** and offers **Procedural
comparison** independently of scenery. Selections last for the current session.
Both model sets remain cached when switching, including in paused scenes.

Tumbling, trails, explosions, shadows and sunlight use the existing presentation
path. Model bounds are normalized to the original maximum physical extent, and
the bomb spark follows the exported fuse tip rather than a hard-coded position.
Simulation, collision sizes and original-renderer weapon sprites are unchanged.

Front and side views of every model were inspected using the MCP. Regression
checks cover all model bounds, finite geometry, switching defaults, animation
repeatability and fuse placement at multiple headings. Live in-race browser
verification remains unavailable in this session.


### All-track voxel coverage

The 3D renderer no longer restricts the map to track 1. Every loaded track uses
its own original ground texture and placements, with the same live voxel karts,
weapons, lighting, shadows, collection/impact effects and tyre effects. The
controls now read **3D tracks (prototype)** and **Voxel Studio (all tracks)**.

Thirty more 32³ models were authored via Voxel Studio MCP revisions 14–43 and
exported to `src/voxel/assets/track-scenery.json`. Together with the six existing
scenery assets, these cover all 36 object types in the archive's 42 layouts.
They include three barrel colors, striped posts, plain posts, reeds, a cactus,
a bush, the red glove and oil-can pickups, and all remaining hedgehog variants.
Each was inspected with MCP front renders. New hedgehogs share a movable head
joint and have variant accessories; these are interpretations of the source art,
not reproductions of every sprite animation frame. Props now fit both original
width and height limits while preserving their model proportions.

**Current renderer**, **Procedural + original pickups**, and the independent
weapon comparison remain available. The procedural scenery comparison preserves
its original scope (tyres/posts in voxels, other objects as original billboards).
Studio mode supplies meshes for every stock object, with billboard fallback only
for unknown custom object types. Maps and collision/pickup behavior are unchanged.

Coverage means track layouts, not additional game modes: the existing single-player,
after-countdown 3D camera remains. Fly-ins/countdowns, duck mode and multiplayer
keep their established renderer paths. Ground is still the flat textured 3D mesh,
not voxel terrain, and water retains its existing prototype limitations. Live
browser verification remains blocked in this session.

`npm run check:voxel-tracks` reads the user's own WACKY.DAT and validates every
layout's complete ground texture, Studio model coverage, finite meshes and
placement scales. Unit coverage also builds a scene for each of the 42 map names,
checks track changes and comparison switching, and verifies mesh parts and pivots
for all 36 types.


### Continuous 3D race opening

The 3D track renderer now stays active during the single-player fly-in, countdown
and green-light transition on every track. It follows the interpolated legacy
camera's slide and swing, translating the original camera distance to the 3D
chase distance. The small rounding offset in the original integer camera is
cancelled so the final fly-in sample, countdown and racing camera meet exactly.
The player's kart keeps its physical starting-grid heading while the camera
orbits; the final blended intro frame carries that distinction into countdown.

A new Voxel Studio lion and traffic-light assembly replaces the starter within
the 3D scene. Red, amber and green follow `stepStart(...).start.lion`, exactly as
the source renderer's next-frame presentation does. Active lenses are emissive;
the assembly has a fixed world orientation, casts a shadow, and follows the
existing starter visibility flag. Sound, launch timing and race state are
unchanged. Current-renderer comparison, missing-model/WebGL fallback, duck and
multiplayer paths retain their existing behavior.

`npm run check:voxel-start` walks the real intro on all 42 archive layouts,
checking 3,630 interpolation/countdown samples for finite cameras, fixed kart
headings and continuous handoffs. Regression tests cover light boundaries,
intro interpolation, model geometry, immutable presentation state and comparison
switching. MCP front/right model previews were inspected; live in-race visual
verification remains blocked in this session.

### Animated 3D water and entry splashes

**Water → 3D waves + splashes** is now the default in the 3D track renderer;
**Flat water comparison** restores the previous flat textured surface and hides
splash effects. This choice is independent of scenery, weapons and renderer.
Switching water mode clears pending splash events. The classic renderer retains
its existing water presentation.

The renderers share `src/liquids.js`, extracted without changing the existing
liquid classification. The game's tile masks identify exact liquid texels;
nearby liquid-coloured surfaces retain the existing classification heuristic.
The 3D surface uses an eight-world-unit wave grid, drawn only over occupied
liquid cells and clipped to the exact mask in the fragment shader. Wave amplitude
falls away at shore vertices, and all displacement stays above the original
floor to avoid intersection flicker. Analytic wave normals supply warm sunlight
glitter, a sky-coloured reflection approximation and a thin shoreline highlight.
This is not a rendered reflection of karts or scenery. Red liquids keep their
palette and move more slowly. The depth buffer hides submerged kart geometry.

Player and AI water-entry transitions create short voxel droplet bursts and an
expanding foam crown. Airborne crossings wait until landing; initial loading,
teleports, repeated submerged frames and restarts do not create repeated bursts.
Foam samples the same displaced mesh triangles as the water and is clipped away
from land. Events are capped at twelve, last 1.2 seconds, and use presentation
time, so pausing freezes both waves and splashes. Collision, sinking, respawn
rules and sounds are unchanged.

Validation: all 42 layouts checked, including 20 containing liquids (22,532,322
liquid texels total). Every wave mesh and mask is finite/in bounds; the largest
mesh has 77,808 triangles. Tests cover exact shoreline masks, dry tracks, bounded
waves, player/AI entries, airborne crossings, repeat suppression, teleports,
resetting and comparison selection. All 477 tests pass; lint and build pass with
the existing bundle-size warning. Live GPU/in-race visual verification remains
blocked in this session, so visual tuning and on-device frame rate need review.

### Reflections of the 3D world

**Reflections → Karts and scenery** now defaults on for animated 3D water.
**Sky only comparison** retains the previous water appearance, independently of
**Flat water comparison**, scenery choices and the current renderer. Reflections
are skipped on dry tracks and in flat-water mode.

A half-resolution planar reflection pass draws the same articulated opaque
geometry as the main view, including karts, voxel scenery, pickups, starter and
voxel effects. World-space positions mirror around the shoreline water plane;
fragments originally below that plane are clipped so submerged parts do not
appear above the water in the reflection. Lighting uses the source geometry's
normals. The reflection has its own colour/depth buffer, and water never renders
into its own reflection. The main water shader samples the reflected image with
wave-normal distortion, blends it with the water tint according to viewing angle,
and fades the texture edges. Exact liquid masks keep reflections off land.
Original billboard comparison objects and tyre smoke are not reflected.

The reflection target is reused, resized when render resolution changes, and
cleared each frame; no temporal history survives track changes or toggles.
An incomplete reflection framebuffer falls back to sky-only water. Pause uses
the same frozen poses and wave time as the main scene. This is one planar
reflection with distorted sampling, not per-wave ray tracing or recursive water
reflection. It adds one geometry pass on wet tracks; live GPU performance and
visual tuning still need in-race review because browser verification remains
blocked in this session.

Recorded-GL regression tests verify pass order, pose equality, distinct depth
buffers, absence of render-target feedback, resize/reuse, comparison switches,
dry tracks and incomplete-framebuffer fallback. These tests validate API usage;
they do not compile shaders or replace a visual GPU check.

### Kart wakes and expanding ripples

Moving player and AI karts now leave water trails after the initial entry splash.
Slow travel creates expanding rings; faster travel strengthens and suppresses the
front of each ring into a trailing wake. Events use actual world displacement,
so reversing and turning change their direction correctly. They stay anchored
where emitted, rather than following the kart. Rings last 1.8 seconds and fade
while the kart is stopped; stationary karts do not continually emit new ones.

Trail displacement is evaluated on the water mesh, changes its normals and thus
its highlights/reflection distortion, and adds a foam highlight at the ripple
crests. Splash foam rides the same displaced triangles. Exact water masks clip
all surface effects to liquid; shoreline displacement still fades at the shore.
Red liquids keep their warm appearance and slower ripple expansion.

**Water trails → Wakes and ripples** defaults on. **Splash-only comparison**
removes these new trails while keeping existing animated waves, entry splashes
and reflections. **Flat water comparison** still disables all animated water
and trails. Both controls clear trail history, and the reflection comparison
remains independent. Choices last for the session.

Trail sampling requires continuous grounded movement through the same liquid.
Loading, jumps, hidden karts, dry crossings, large teleports, time discontinuities
and world changes do not draw connecting trails. Events are capped at 24 with
minimum distance/time spacing; overlapping wave displacement is clamped to
±0.6 world units. Presentation time freezes trails and ripples while paused.
Simulation, speed, collisions, respawning and sounds are unchanged.

Tests cover player/AI emission, speed response, fixed world positions, expiry,
repeat suppression, airborne/hidden states, shore crossings, teleports, resets,
reverse motion and matching emission at two tick rates. Recorded-GL checks
verify wake uniforms reach the water pass and are zero in flat comparison.
Live shader appearance and frame rate still need in-race review: browser/GPU
visual verification remains blocked in this session.

### Rendering error recovery

GPU initialization, upload, shader and draw exceptions now disable the broken
pipeline for the remainder of the page session. The source canvas takes over,
and subsequent race frames use the CPU renderer instead of retrying the error.
CPU-side voxel preparation errors during race drawing use the same recovery.
Race state and the animation loop continue without restarting the race.

An alert inside the game area (also visible in fullscreen) shows the failure
and expandable error details. **Use original renderer** turns off live voxel
karts and selects the Original graphics preset, then dismisses the alert.
Reload before trying the GPU renderer again; changing settings does not retry a
known-broken pipeline. Shader errors are inserted as text, never HTML.

Display tests inject upload, lazy shader and draw failures, verify the source
canvas becomes visible, and ensure subsequent frames/settings changes do not
retry the GPU or replace the original error. These are mocked-GL checks, not
live browser/GPU verification.

Live recovery verified on track 1 in the in-app browser (2026-10-24): all eight
kart models loaded and the 3D scene was visible before failure. The development
`?debug` control **Force 3D error (debug)** throws once from the next real
`drawArrays` call, restoring that method before throwing. It only arms during
an active live-voxel race and is excluded from production builds.

The alert displayed `Forced 3D draw failure (debug fallback check)`. Race ticks
advanced from 138 to 181 with the alert open. **Use original renderer** dismissed
the alert, unchecked live voxels, selected Current renderer / Original graphics,
and continued the same race at tick 261. Holding Up for 2.5 seconds then reached
tick 337, throttle 84 and speed 19; the camera moved from (1279,1492) to
(1168,2403). No reload or race restart was needed for recovery.

### Enhanced fireballs

Fireballs in both weapon comparison modes now have animated hot-core flame trails,
rising embers and a depth-tested additive orange halo. On impact, a widening fiery
burst and fading flash retain the fireball identity even after the simulation
switches to its shared explosion sprite. Particle counts are bounded and paused
frames remain stable. Projectile speed, collisions, damage and lifetimes are unchanged.

### In-game presets

GAME OPTIONS → DISPLAY AND EFFECTS → PRESET cycles ORIGINAL (sprites),
ENHANCED (sprites) and VOXEL. The preset is saved in the browser. Voxel uses the
3D track renderer and bundled kart models; the debug URL and local model server
are no longer required. Existing comparison controls remain available.

LIGHTING AND TIME → TIME OF DAY supports RANDOM (the new default), TRACK, DAY,
DUSK, NIGHT and NOW. It applies to Enhanced and Voxel; Original shows NONE.
Random chooses day, dusk or night at each race start and remains stable through
pauses and renderer changes. Saved explicit time choices are respected. Voxel
lighting defaults to Toy-like; saved lighting choices are also respected.
