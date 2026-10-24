// The design values of the Enhanced presentation (docs/enhancements.md). Everything here is an artistic or engineering choice of this
// port: none of it is evidence about the DOS game, none of it has a claim, and nothing outside src/enhance reads it. The constants the
// effects share with the game (the screen, the view, the turn, the horizon strip, the tick) are not repeated here: src/enhance reads them
// from the reconstructed modules (view.js, sky.js, floor.js, horizon.js, clock.js). `npm run lint` keeps the numbers of src/enhance in
// this file: any other module of the directory may use only 0, 1 and lines tagged `// @math <reason>`.

// The presets. Original is the reference renderer of the port, untouched; Enhanced turns every effect on (Stage 3 added the clouds and the
// track lighting, then the far range and the water). The switch `clouds` is the sky's layers: the clouds and the far range behind the
// horizon strip (SKY LAYERS in the game menu, whose two lists of switches have room for five each).
export const EFFECTS = ['smooth', 'shadows', 'sceneryShadows', 'sunShadows', 'skidMarks', 'particles', 'water', 'fog', 'clouds', 'lighting']; // in the order of the menu's lists and the panel
export const PRESETS = {
  original: { smooth: false, shadows: false, sceneryShadows: false, sunShadows: false, particles: false, skidMarks: false, fog: false, clouds: false, lighting: false, water: false },
  enhanced: { smooth: true, shadows: true, sceneryShadows: true, sunShadows: true, particles: true, skidMarks: true, fog: true, clouds: true, lighting: true, water: true },
};
// The switches that only change how the picture is coloured: switching them keeps the scene (the snapshots, particles and skid marks).
export const LOOK_EFFECTS = ['clouds', 'lighting', 'water'];

// The intensity controls of the page (each 0 to 1) and their defaults; `sunAngle` is the sun's direction in the world as a part of a turn
// (the game's tracks carry no sun: this one serves every track that has no sun in its atmosphere, ATMOSPHERE below).
export const LEVELS = { shadowStrength: 1, fogStrength: 1, particleAmount: 1, sunAngle: 0.375 };
export const LEVEL_STEPS = 40; // levels are kept in fortieths (the sliders move in twentieths, the sun in the menu in eighths)

// The game menu of the effects (GAME OPTIONS > DISPLAY AND EFFECTS, src/game/graphics-menu.js): the words it shows and what Enter does to a level. A strength goes up by a
// quarter and from full back to off; the sun goes round in eighths of a turn. The sun's names say where it stands with the track map's top as north (the shadows fall
// the other way): the shadows of the angle 0 fall toward the map's right.
export const MENU = {
  presets: { original: 'ORIGINAL', enhanced: 'ENHANCED', voxel: 'VOXEL', custom: 'CUSTOM' },
  strengthStep: 0.25,
  off: 'OFF',
  percent: 100,
  sunNames: ['WEST', 'NORTH WEST', 'NORTH', 'NORTH EAST', 'EAST', 'SOUTH EAST', 'SOUTH', 'SOUTH WEST'],
};

// Stage 4 (docs/enhancements.md, Stage 4 as built): how the race world is rendered, a group of choices beside the effects and the levels,
// kept with them in the graphics settings. Each is a list of allowed values; a stored value that is missing or not in the list takes the
// default, and the defaults are the presentation before Stage 4 (settings stored before it load as they were).
// - `scale`: the world drawn at 1 or 2 times the original's samples in each direction (the tests also use 3).
// - `view`: 'standard' (the original's 320 columns) or 'wide', margins added on both sides up to the shape in `views` (16:9).
// - `hudPlace`: where the overlays go in a wide view, 'centred' over the original columns or 'edges' (it matters only while the view is wide).
// - `sizes`: 'classes', the pictures at the size of the game's ten size classes at any scale (the original's steps), or 'smooth', a
//   continuous size between the classes.
// - `angles`: how a kart's direction picks among the frames of an artwork pack's extra angles: 'locked' to the game's own frame, 'free',
//   or 'off' (the game's frames); nothing without the artwork on and a pack with angles.
// - `art`: whether the player's artwork packs replace the archive's art in the race world.
// Only the scale, the view, the sizes and the artwork change what is drawn by themselves (settings.js renderActive); the HUD place and the
// angles only refine them.
// - `budgetMs`: the page's panel recommends 1x when the mean draw over TIMING_FRAMES frames is longer than this (a 60 Hz frame is 16.7 ms,
//   and the display's pass and the browser need the rest); the page never changes a setting itself.
export const RENDER = {
  scales: [1, 2],
  views: { standard: null, wide: 16 / 9 },
  hudPlaces: ['centred', 'edges'],
  sizes: ['classes', 'smooth'],
  angles: ['locked', 'free', 'off'],
  defaults: { scale: 1, view: 'standard', hudPlace: 'centred', sizes: 'classes', angles: 'locked', art: false },
  budgetMs: 12,
};
// The words of the game menu's RENDERING list (DISPLAY AND EFFECTS > DISPLAY OPTIONS > RENDERING; its lines come with the Stage 4 milestones
// that bring their settings): letters, digits and spaces only, and a name, a space and its longest word within a bar's 20 characters
// (SPRITE SIZES STEPPED is exactly 20). NONE is said where a choice cannot be shown (no WebGL 2, no pack, no pack with angles).
export const RENDER_MENU = {
  item: 'RENDERING',
  scale: 'RESOLUTION',
  scales: { 1: '1X', 2: '2X' },
  view: 'VIEW',
  views: { standard: 'STANDARD', wide: 'WIDE', edges: 'WIDE EDGES' },
  sizes: 'SPRITE SIZES',
  sizeNames: { classes: 'STEPPED', smooth: 'SMOOTH' },
  angles: 'KART ANGLES',
  angleNames: { locked: 'LOCKED', free: 'FREE', off: 'OFF' },
  art: 'ARTWORK',
  none: 'NONE',
  width: 20,
};

// The HUD at the screen's edges in the wide view (Stage 4, M9: RENDER.hudPlace 'edges', the RENDERING list's VIEW WIDE EDGES; docs/enhancements.md,
// Stage 4 as built): which of the game's HUD elements go with which edge of the picture, and how far each group moves right in a picture of m
// margin columns a side (`shift` times m). hud-place.js measures where each element can draw (its footprint: every place and every value it
// can show, its pictures made opaque) and gives each pixel of the 320 x 200 grid the group whose footprint holds it.
// - `left` stays at the picture's left edge (dx 0): the top banner (the place panel, the lap and count labels), the place digit, the driver's
//   name, the speedometer, the lap text, the overhead map's rectangle, the attract demo's logo and the duck game's banner (its score, its icon
//   and its hog counter; the duck game's name is the driver's name).
// - `right` goes to the right edge (dx 2m): the timer (the duck game's too), the held item, the reaction figure, the attract demo's DEMO MODE and
//   the finish labels. A pixel both groups claim is the right group's.
// - Every other overlay pixel is the centre's (dx m, where 'centred' puts them all): the WRONG WAY sign, and whatever no footprint holds. The
//   overlays that must stay whole over the original's picture (the in-race menu, the message box, the crack: the caller's forced overlays) are
//   centred whatever their pixels' groups.
export const HUD_PLACE = {
  left: ['banner', 'place', 'name', 'speedometer', 'lapText', 'minimap', 'demoLogo', 'duckBanner'],
  right: ['timer', 'held', 'figure', 'demoText', 'labels'],
  shift: { centre: 1, left: 0, right: 2 },
};

// Stage 4's drawing above the reference geometry (docs/enhancements.md, Stage 4 as built, M5): the choices it is built with, the 2x spike's
// decision for the next milestone (scripts/spike-2x.mjs), and the budget the spike measures against. The docs name the alternatives and what
// would make them worth building.
// - `hooks`: where the floor's liquid and relief hooks run above 1x: 'reference', once per reference sample (a cell of the output, at its
//   top-left pixel: caster.js), so the water's lines and its dither keep the original's density and cost about what they cost at 1x. Built.
// - `castAt`: where the sun shadows are cast in the 'full' look: 'output', at the output resolution, softened by a running-sum box blur of
//   SUN.blur x s pixels. Built. (The 'reference' look casts them on the reference grid.)
// - `look`: where the soft layers are kept above 1x: 'reference' (built in M6, the default), the contact shadows, the sun shadows, the skid
//   marks and the ground's relief light on the reference grid (refW x 200), drawn there as at 1x and read by the composite at each output
//   pixel's reference cell, as the covers of the clouds and the far range are; the pictures' relief is lit on the reference grid too (relief.js
//   pictureLight above 1x). The water's light is worked out once a reference cell (`hooks`) but kept per output pixel with the liquid's own
//   edge (the layer `wet` follows the texels at the output resolution, and a pixel whose cell's sample is dry is shaded on the spot). 'full'
//   keeps every soft layer at the output resolution (M5's draw), for comparison: createEnhancer({ look: 'full' }), the checks' --time rows
//   and scripts/spike-2x.mjs. The spike's decision (2026-10-07): 'full' misses the budget below; on a quiet machine 'reference', the cheaper,
//   misses it too, so 2x may drop frames (docs/enhancements.md, M6, Time).
// - `budget`: the most a 2x Enhanced draw may take on the maintainer's MacBook Air (node on a quiet machine; Chrome takes about 1.5 times as
//   long): `meanMs` and `p95Ms` with the default atmosphere, `sunsetMs` with a sunset grade. `quiet`: the 1x Enhanced draw the budget was set
//   against on that machine (mean and 95th percentile); a run on a busy machine is scaled by its own 2x / 1x ratio.
export const HD = { hooks: 'reference', castAt: 'output', look: 'reference', budget: { meanMs: 8, p95Ms: 11, sunsetMs: 9.5 }, quiet: { meanMs: 3.65, p95Ms: 4.61 } };

// The wide view (Stage 4, M8: docs/enhancements.md, Stage 4 as built): what a world must pass to get one, and how the things in its margins are
// found (src/enhance/wide.js).
// - `viewTolerance`: the floor's distances and the pictures' sizes outside the original 320 columns are continued through the TRIG cosine
//   (geometry.js cosT), which assumes the world's VIEW words are 2^14 times the cosine of each column's angle (a lead, never a claim). A world
//   whose VIEW[c] / VIEW[160] differs from cosT(c - 160) by more than this anywhere gets no wide view (its margin is 0). Measured on the
//   maintainer's archive (2026-10-07): 7.3e-4 at worst (column 0) on all 42 tracks, which share one table; this leaves about four times that.
// - `probeDistance`: world units back from a thing the margins may show to the probe camera that looks straight at it (wide.js): the thing
//   stands at the probe's column 160 and distance about 400, well inside every cull of the reference draw list (its box, its cone, its columns,
//   its distances 80 to 1122), so a thing the probe does not return is one a game filter dropped.
// - `seam`: reference columns inside each edge of the original 320 where a thing the reference draw list dropped is still asked about. The
//   game's own column is worked out with whole forward and lateral distances (view.js projectPoint), the enhancer's with fractions; near the
//   camera the two differ by several columns at the edges, so without this a thing could be in neither list for a frame. Measured on the
//   maintainer's archive (2026-10-07, 245 million points over every heading a seventh of an entry apart, distances 70 to 1150): a point the
//   game culls at its column has its fractional column at most 4.8 columns inside either edge; this leaves room. A thing the reference list
//   drew is never asked about again (one record per thing), nor one inside the reference columns that the game's box culled (that is the
//   game's decision, not a rounding of its column).
export const WIDE = { viewTolerance: 0.003, probeDistance: 400, seam: 8 };

// The wide view's sky margins (Stage 4, M8): the columns of the track's sky picture beyond its 320, which the game never drew. A row of one
// index is continued exactly; a dithered row (BACK1.PCX and BACK2.PCX: two or three indices in no period) is made again from that row's own
// indices in their proportions, by an ordered dither on the reference cell: 'redither' (sky-hd.js skyMargins), or 'mirror', the row reflected
// at the picture's edge. Both are invented pixels (documented, never the art of the game); columns 0..319 are always the picture's own.
export const SKY_MARGIN = { mode: 'redither', modes: ['redither', 'mirror'] };

// Smooth sprite sizes (Stage 4, M7: docs/enhancements.md, Stage 4 as built; RENDER.sizes 'smooth'): a picture is its frame drawn at a size
// between the game's classes, each output pixel reading the frame's texel nearest its middle (blit.js smoothMap). Such a map depends only on
// the frame's size and the drawn size; the last `maps` of them are kept (a least recently used list), so a picture whose drawn size has not
// changed since a recent frame needs none made again.
export const SIZES = { maps: 256 };

// The settings a visitor starts with: the Original preset, so the port plays as the game did until the player chooses otherwise.
export const DEFAULTS = { preset: 'original', ...PRESETS.original, ...LEVELS, ...RENDER.defaults };
export const STORAGE_KEY = 'wackywheels.graphics';

// Smooth motion: what counts as a discontinuity between two completed ticks rather than movement. The fastest legitimate steps seen
// in headless races are about 70 world units of the camera and 115 of a computer racer a tick, and 120 compass units of the hand brake
// turn (scripts/check-enhance.js prints the largest it meets); anything beyond these limits is drawn at once instead of travelled through.
export const MOTION = { snapDistance: 192, snapTurn: 240 };

// Contact shadows: a soft ellipse on the ground under the anchor of a racer's or an object's picture.
export const SHADOW = {
  opacity: 0.42, // the darkening at the centre at full strength (the colour is multiplied by 1 - opacity)
  widthOfPicture: 1, // the ellipse's width against the width of the drawn picture (racers)
  objectWidth: 0.7, // against the width of the opaque bottom of an object's picture (trees, signs and crates are narrower at the base)
  aspect: 0.3, // the ellipse's height against its width
  rise: 0.2, // the centre stands this part of the vertical radius above the anchor row: the shadow lies under the body and peeks out below the wheels
  falloff: 0.8, // the soft edge: the darkening is (1 - q) ** falloff for q the squared elliptic radius (smaller is firmer)
  liftFade: 24, // rows of jump height over which a lifted car's shadow shrinks and fades to half
  minRows: 2, // no shadow smaller than this
  bottomBand: 0.25, // the part of an object's picture, up from its lowest opaque row, whose opaque columns give its footprint
};

// Sun shadows: every picture that has a contact shadow also casts its silhouette on the ground, away from a sun at `LEVELS.sunAngle`.
export const SUN = {
  length: 1.1, // the ground length of a shadow per unit of height (the cotangent of the sun's elevation, about 42 degrees)
  opacity: 0.46, // the darkening of a cast shadow at full strength
  blur: 1, // the radius in pixels of the box blur that softens the cast shadows' edges
  depth: 0.9, // the depth a picture's subject is given against its drawn width (a flat card would cast a line when the sun is to the side)
};

// Skid marks: two tyre tracks laid behind a car's rear wheels on the ticks the game itself counts as a skid (a slide, the hand brake
// turn, a hop, or a SKID sound while braking). By design no marks are laid on the five surface values terrain.special-values lists apart
// from the boost strip: the wall, the value a stopped car is drawn four rows shorter on, the pit state's two and the fall (what they are
// is not read, so they are left unmarked rather than guessed at). Where the surface has a wheel-dust picture the marks are wider and
// lighter. They darken the ground they lie on, keeping its colour, fade with age and live in a bounded ring.
export const MARKS = {
  cap: 768, // segments kept (a segment is one wheel for one tick: about 34 seconds of skidding)
  width: 2.2, // world units, a tyre on hard ground
  looseWidth: 3.6, // a rut in loose ground
  strength: 0.62, // the darkening at full strength, hard ground
  looseStrength: 0.42, // loose ground
  holdMs: 5000, // a mark stays at full strength this long
  fadeMs: 7000, // then fades out over this time
  wheelSide: 6, // world units from the car's centre line to each rear wheel; the marks start at the car's point, where its picture stands on the ground
  minStep: 0.5, // world units a wheel must travel in a tick to leave a mark
  near: 24, // world units ahead of the camera where a mark is clipped
};

// Particles: world-space puffs and sparks, emitted on simulation ticks from events the game itself classifies (the dust picture a surface
// has on the track, the pit state's splash, the spark of a wall or racer contact), aged on presentation time, bounded in number.
export const PARTICLES = {
  cap: 384, // the most particles alive at once
  seed: 0x2f6e2b1, // the visual random source's seed (never the game's)
  wheelBack: 7, // world units from the car's point back to the rear wheels
  wheelSide: 6, // world units from the car's centre line to each wheel
  dust: { every: 9, lifeMs: 650, size: [2, 3.4], grow: 7, rise: 22, spread: 5, drag: 1.8, inherit: 0.75, alpha: 0.5, minStep: 2, racers: true }, // world units, seconds; `inherit` the part of the car's velocity a puff starts with, `drag` slows its travel and its rise alike
  splash: { perTick: 4, lifeMs: 520, size: [0.9, 1.6], speed: [16, 34], up: [26, 46], gravity: 120, alpha: 0.85 },
  sparks: { perEvent: 10, lifeMs: 300, size: [0.45, 0.8], speed: [30, 70], up: [12, 30], gravity: 90, alpha: 1, ahead: 6 },
  minPixels: 0.6, // a particle is drawn at least this wide on the screen
  fadeInMs: 60, // dust swells in over this time
  nearFade: 16, // world units past the nearest drawn distance over which particles fade in (puffs that pass the camera vanish)
  colorLighten: 0.15, // dust colours are taken from the original effect pictures and lightened a little toward white
};

// Distance fog: the ground, the racers, the objects and the particles fade toward an atmospheric colour taken from the track's own
// horizon strip, by the same distance the game sorts its sprites with.
export const FOG = {
  start: 0.32, // the fraction of the farthest drawn distance where the fog begins
  amount: 0.42, // the blend at the farthest distance at full strength
  curve: 1.4, // the exponent of the ramp from start to the far end
  horizon: 0.22, // the blend over the horizon strip (the scenery stays recognisable)
  neutral: 0.35, // how far the colour taken from the strip is pulled toward its own grey
  stripRows: 4, // the top rows of the horizon strip the colour is averaged over
};

// The frame time readout averages this many frames.
export const TIMING_FRAMES = 120;

// The player's own art kept in this browser (IndexedDB, src/enhance/store.js): the version of the page's database. Version 1 had the relief
// maps only; version 2 (Stage 4) adds the artwork packs and their art. The relief maps carry over unchanged.
// The artwork packs (Stage 4: docs/artpacks.md, the authors' reference; pack-format.js checks them, art.js draws them):
// - `maxScale`: the most pack pixels a side an entry may give one of the original's pixels (its scale p, a whole number from 1);
// - `maxSide`, `maxImagePixels`, `maxPackPixels`: the largest picture side, picture and pack (all its pictures) an import takes, so that a pack
//   cannot exhaust the browser's memory when it is decoded (CARS.SP at p = 4 is about 1.6 million pixels, the whole world's template at 4 about
//   27 million, 16 times its 1.7 million at 1); a PNG's header is checked against the first two before its data is inflated (png.js);
// - `maxFileBytes`: the largest file of a pack a zip gives (its directory's size is checked before the file is read, and a deflated file is
//   inflated no further): a PNG of `maxImagePixels` at 16 bits a sample of RGBA stored without compression (8 bytes a pixel), and room for its
//   chunks;
// - `alphaCut`: a strip pixel whose alpha is below this says 'sky here' (the strip's sky goes on there: the tint and the far range over it);
// - `cacheBytes`: the decoded pictures kept across races (a least recently used list of this many bytes; the pictures are kept as PNG in the
//   store, decoded when a race needs them);
// - `decodeTimeoutMs`: how long a race's start waits for its packs to be decoded before it starts anyway (their art then applies from the
//   frame they are ready on);
// - `templateScales`: the scales the garage's template export offers;
// - `directions`: the kart angle sets' directions (M4): a whole number of times `step`, at most `max`.
export const ART = { dbVersion: 2, maxScale: 8, maxSide: 16384, maxImagePixels: 16e6, maxPackPixels: 64e6, maxFileBytes: 16e6 * 8 + 2 ** 20, alphaCut: 128, cacheBytes: 128 * 2 ** 20, decodeTimeoutMs: 1500, templateScales: [1, 2, 4], directions: { step: 8, max: 64 } };

// The kart angle sets (Stage 4, M4: angles.js, docs/artpacks.md): how a computer racer's direction is read from the route it drives, and the
// garage's template of a set.
// - `minChord`: a route entry whose rasterised points span less than this many world units gives no direction of its own (a few points, or
//   none: a single-point entry would read as the direction 0); such an entry faces the centre of its compass word's octant, and the
//   convention check leaves it out (the route records' angle words were checked the same way: rd.derived-words skipped the segments shorter
//   than 30);
// - `agreement`: the share of a world's long-enough entries whose chord's octant (humanCompass of the chord's TRIG angle, rounded) must be the
//   entry's own compass word for the world's chords to be used; a world below it (its route's words would not follow the game's convention)
//   faces every racer to the centre of its compass word's octant instead, and check:enhance section 8 reports it;
// - `templateDirections`: the directions of the garage's angle-set template unless another N is chosen;
// - `guide`: the guide picture written beside an angle-set template (never a picture of the pack: an import ignores it): the in-between cells
//   show the two original frames around them faded in by how near each is (`ghost`, the alpha of a ghost at its own frame), the cell's box
//   outline (`box`) and its ground row (`ground`), RGB colours.
export const ANGLES = { minChord: 30, agreement: 0.95, templateDirections: 32, guide: { ghost: 160, box: [128, 128, 128], ground: [255, 90, 90] } };

// The display (Stage 1 of docs/enhancements.md): how the finished 320 x 200 picture is put on the visitor's screen, after every renderer, for
// the Original preset as for the Enhanced one. Nothing here changes a pixel of the picture itself.
// - `aspects`: the shape of the whole picture. 'wide' is the page's square pixels (320 by 200, 16:10); 'dos' the 4:3 a VGA monitor of the time
//   stretched every 320 x 200 mode to, which makes a pixel 1.2 times as tall as it is wide.
// - `scalings`: 'fit' fills the space with the largest picture of the shape, its pixels drawn sharp with a soft edge one screen pixel wide
//   where a pixel does not cover whole screen pixels; 'integer' uses whole screen pixels for every row (and for every column when the pixels
//   are square), so all rows are the same height (and with square pixels all columns the same width).
// - `window`: the largest picture beside the panel when not in full screen (the page's 960 pixels), and the gap kept below it.
// - `plain`: square pixels and fit, with no CRT look and the HUD in the picture, are the page as it was: the browser scales the canvas itself,
//   without WebGL.
// - The defaults are 4:3 (the maintainer's choice, 2026-10-06: the shape the game had on a monitor), fit, and the CRT look off with its
//   curvature off.
// - `huds`: how the race screens' overlays (the HUD, the overhead map, the labels and messages, the split screen's strips, the in-race menu)
//   reach the screen. 'picture' as part of the picture (as the page always did); 'crisp' as a layer of their own over the picture after the
//   CRT look (no scanlines, glow or vignette on them; the curvature's shape kept), each pixel drawn sharp; 'smooth' the same layer enlarged
//   four times by Scale2x twice (the edge-preserving pixel-art scaler of AdvanceMAME) before it is scaled to the screen, so its letters'
//   diagonals are smooth on a dense screen. The overlays keep their pixels' places either way.
export const DISPLAY = {
  aspects: { wide: 1.6, dos: 4 / 3 },
  scalings: ['fit', 'integer'],
  huds: ['picture', 'crisp', 'smooth'],
  window: { maxWidth: 960, gutter: 16 },
  plain: { aspect: 'wide', scaling: 'fit', hud: 'picture' },
  defaults: { aspect: 'dos', scaling: 'fit', crt: false, scanlines: 0.5, glow: 0.25, curvature: 0, hud: 'picture' },
  storageKey: 'wackywheels.display',
  levelSteps: 20, // the CRT levels are kept in twentieths (the sliders' steps)
  closeUp: { width: 240, height: 150, zoom: 4, at: [0.5, 0.78], everyMs: 100 }, // the panel's close-up: its size in CSS pixels, how many times it enlarges the screen's pixels, the point of the picture it looks at (parts of the width and height: the own car's road) and how often it is redrawn
};

// The CRT look: a final pass on the graphics card over the scaled picture, three levels of 0 to 1 the player sets.
// - Scanlines darken the space between the picture's rows, each row lit as a beam of `beam` rows' width (the standard deviation of its
//   profile); `depth` is the darkening between rows at full level, `boost` how much of the lost light comes back on the row's middle. Below
//   `fadeRows` screen rows a picture row they fade out (too few screen pixels to show a line without moiré), fully shown from `fullRows`.
// - Glow is a soft halo of the picture, blurred over `radius` picture pixels (the Gaussian's standard deviation, summed `taps` pixels to either
//   side) and added with `gain` at full level (a screen blend).
// - Curvature bulges the picture like a tube's face: `bulge` at full level is how far the corners are drawn in, `vignette` darkens toward
//   the corners (as the corner distance's power `falloff`: smaller keeps the middle brighter), `corner` rounds them (a part of the picture's height).
export const CRT = {
  scanlines: { beam: 0.3, depth: 0.55, boost: 0.6, fadeRows: 2, fullRows: 3.5 },
  glow: { radius: 2.5, taps: 6, gain: 0.5 },
  curvature: { bulge: 0.11, vignette: 0.35, falloff: 0.25, corner: 0.035 },
};

// The display's game menu (GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS, src/game/display-menu.js): the words for the shape and the scaling (the menu font
// has letters, digits, the space and the hyphen only); a CRT level goes up a quarter in the menu, from full to off.
export const DISPLAY_MENU = {
  aspects: { wide: '16 BY 10', dos: '4 BY 3' },
  scalings: { fit: 'FIT', integer: 'INTEGER' },
  huds: { picture: 'PICTURE', crisp: 'CRISP', smooth: 'SMOOTH' },
};

// Stage 3 (docs/enhancements.md): the atmosphere of each track, set in the track editor and kept in this browser under `storageKey` by track
// number, apart from the game files. A track with nothing stored has the defaults, which draw exactly as before Stage 3 apart from the
// clouds, the far range and the moving water: the sun of the game setting (SUN FROM) at the height of SUN.length, the fog colour taken from the horizon strip at the strength of
// the game setting, and no lighting grade.
// - `sunAngle`: null for the game setting, else a part of a turn; `sunHeight`: null for SUN.length, else 0 (a sun `sunElevation[0]` degrees
//   above the horizon: long shadows) to 1 (`sunElevation[1]` degrees: short ones).
// - `fogTint`: null for the strip's colour, else '#rrggbb'; `fog`: the fog's strength against the game setting, 0 to `fogMax`.
// - `clouds`: how much of the cloud banks is cloud (0 none, the default about a fifth of their middle rows, 1 nearly all); `cloudSpeed`:
//   how fast the wind moves them.
// - `grade`: one of GRADES.names; `gradeStrength`: how much of it, 0 to 1.
// - `range`: how tall the far range behind the horizon strip is (0 none, 1 RANGE's `rows` of its shape); `rangeShape`: one of RANGE.names.
// - `water`: how strongly the water and the red liquid move (0 still, as the game draws them).
// - `relief`: how strongly the track lighting shows the relief of the ground and the pictures (RELIEF; 0 none).
export const ATMOSPHERE = {
  storageKey: 'wackywheels.atmosphere',
  defaults: { sunAngle: null, sunHeight: null, fogTint: null, fog: 1, clouds: 0.35, cloudSpeed: 0.3, grade: 'none', gradeStrength: 1, range: 0.5, rangeShape: 'hills', water: 1, relief: 0.7 },
  fogMax: 2,
  steps: 40, // levels kept in fortieths
  sunElevation: [10, 70], // degrees
};

// The clouds: two banks of a cloud field over the track's sky (never the slides of a demo, never the split screen, whose sky rows are the
// strips' picture), behind the horizon strip, the pictures and the overlays, in the manner of the clouds some of the game's own horizon
// strips have (lit tops, shaded flat bases, a few dithered steps). The whole sky moves with the horizon strip as the car turns (the strip's
// own scroll, without its wraps, so no seam), and the wind moves each bank across it.
// - `texture`: the cloud field's size in texels, repeating both ways; `octaves`: the layers of value noise summed in it, the coarsest with
//   `cells` cells across (fine enough that every bank's rows cross many clouds).
// - per bank: `rows` the sky rows it lies in (its flat base at the second), `base` the rows over which its base fades in and `top` those over
//   which its top fades out, `scale` the texels a screen pixel across and a row down, `wind` texels a second at full cloud speed, `cover` the
//   field's coverage against the track's cloud amount, `opacity` the most a cloud hides of the sky, `light` how near white its lit colour is
//   (against the sky's colour of that row), `shade` how far its shaded base goes from the lit colour toward the sky's.
// - `soft`: the width of a cloud's edge in field values; `coverage` and `curve`: the part of the field that is cloud at a cover c is
//   coverage x c ** curve (the field value clouds begin at is read off the field's own distribution), so the default amount gives about a
//   fifth of a bank's middle rows and the full amount nearly all of them; `edge`: how far the field is lowered where a bank fades out (its
//   top and base).
// - `relief`: the rows above and below a pixel the field is compared over to tell a lit top from a shaded base.
// - `brightSky`: the grey (0 to 1) of a sky row from which a bank's light reaches its full whiteness; a darker row (the red skies of some
//   tracks) lights its clouds less, down to `dimLight` of it, so they keep the sky's colour. A bank's shaded base lies between its lit
//   colour and the sky's (`shade` toward the sky), never darker than the sky.
// - `levels`: how many steps of cover a pixel is drawn with and `lightLevels` of light, ordered dithering between them (the original skies
//   are dithered ramps).
export const CLOUDS = {
  seed: 0x2c1d07,
  texture: 256,
  octaves: 4,
  cells: 8,
  layers: [
    { rows: [62, 102], base: 3, top: 26, scale: [1.5, 2.8], wind: 7, cover: 0.9, opacity: 0.7, light: 0.72, shade: 0.22, seed: 1 }, // the far bank: small, flat puffs just above the strip
    { rows: [14, 84], base: 4, top: 40, scale: [0.75, 1.3], wind: 14, cover: 1, opacity: 0.92, light: 0.9, shade: 0.3, seed: 2 }, // the near bank: bigger clouds higher up
  ],
  soft: 0.08,
  coverage: 0.95,
  curve: 1.44,
  edge: 0.45,
  relief: 3,
  brightSky: 0.6,
  dimLight: 0.35,
  reliefGain: 3, // the light of a pixel: one half plus this times how much denser the field is below it than above
  levels: 4,
  lightLevels: 3,
};

// The far range: a second, more distant horizon of hills or mountains behind the horizon strip's scenery, in the haze. It stands on the
// strip's last row and shows on the strip's sky-coloured pixels (those in the indices of the sky picture's row under them) and the sky rows
// above, over the track's sky in a single view only (never a demo's slide, never the split screen). It turns with the strip at `parallax` of
// the strip's scroll (without its wraps), so it moves slower than the strip's scenery and reads as farther away; its profile repeats every
// `period` pixels, so a full turn has no seam. The clouds' far bank lies above it.
// - per shape: `rows` the tallest it stands at the track's full range, `cells` the coarsest lattice of its profile across the period and
//   `octaves` the finer ones (each twice as fine, half as strong), `ridged` folds each octave into ridges (peaks), `low` the profile's
//   lowest point against its highest (a range without gaps), `snow` the part of its height above which its tops are snow (null for none).
// - the colour of a row: the sky's colour of that row pulled `haze` of the way to the track's haze (its fog colour, `dark` darker); a
//   slope rising to the right faces the light and goes `lit` of the way back to the sky, one falling to the right `shade` of the way to the
//   dark haze (the slope in rows a pixel, taken over `reach` pixels either way, times `relief`, a half either way); the last `mist` rows above the foot fade toward the haze by
//   up to `mistAmount`; snow goes `snowLight` of the way to white as far as the sky is bright (CLOUDS' brightSky and dimLight), then
//   `snowHaze` of the way to the range's colour.
// - `levels`: the steps of light; a pixel whose light lies within `dither` / 2 of the middle between two steps is dithered between them, the
//   rest are flat faces, as the strips' own dunes are drawn.
export const RANGE = {
  names: ['hills', 'mountains'],
  seed: 0x6a1e5,
  period: 1024,
  parallax: 0.55,
  shapes: {
    hills: { rows: 22, cells: 10, octaves: 4, ridged: false, low: 0.18, snow: null },
    mountains: { rows: 30, cells: 8, octaves: 5, ridged: true, low: 0.1, snow: 0.72 },
  },
  haze: 0.75,
  dark: 0.45,
  lit: 0.3,
  shade: 0.3,
  relief: 0.6,
  reach: 3,
  dither: 0.6,
  mist: 4,
  mistAmount: 0.4,
  snowLight: 0.75,
  snowHaze: 0.3,
  levels: 3,
};

// The water: the surfaces a car sinks into move. Which they are is the game's own reading (terrain.special-values): the surface a stopped
// car is drawn four rows shorter on and the two that start the pit state, whose pictures (effects.pit) are a splash and the car under
// the surface with only a periscope showing. On the user's archive the first two are blue on every track that has them and the third red
// (tracks 6, 13, 20, 25, 32 and 39, where it is the whole ground off the road): the port draws a liquid whose mean colour is redder than
// blue as the red liquid, the others as water. A surface the game does not treat specially is drawn as one of the track's liquids when
// its mean colour lies within `similar` of that liquid's (the deep patches in the lakes of tracks 7, 14, 23 and 30).
// - the movement: two cloud fields (`texture` texels, CLOUDS' octaves; seeds `seed` and the next) laid on the ground at `scale` texels a
//   world unit, drifting by `flow` texels a second; where the two have the same value a bright line runs (the network of a rippled
//   surface's highlights), `line` pixels to either side at any distance (the difference over its slope; full in the middle `1 / core` of
//   it, fading toward its edges), and between the lines the
//   surface is a little lighter or darker (`shimmer`). Highlights take `levels` dithered steps; they thin out between `far` (distances of
//   the floor's depth table) so the far rows do not sparkle, and are brighter (and `sunWidth` times as much wider) in the columns that look
//   toward the sun (`sun` times the view's alignment with the sun to the power `sunPower`).
// - water: it mirrors the track's haze (its fog colour, the way toward the lighting's sky at the horizon that the sky goes) the more the
//   farther it is, from `reflect.start` of the floor's farthest distance to `reflect.amount` at its far edge; a highlight goes
//   `highlight` of the way from that colour to white. On the beach tracks the game cycles the water's palette itself: there the water only gets the highlights.
// - the red liquid: it moves at `red.speed` of the water's speed, its lines are `red.line` pixels to either side and go toward `red.glow`;
//   it mirrors nothing, and the lighting grade lights it only as much as the pictures (it glows at night).
export const WATER = {
  seed: 5,
  texture: 128,
  scale: 0.4,
  flow: [[1.4, 0.6], [-0.9, 1.2]],
  line: 1,
  core: 2,
  shimmer: 0.08,
  levels: 3,
  far: [260, 640],
  sun: 1.4,
  sunPower: 8,
  sunWidth: 0.4,
  reflect: { start: 0.25, amount: 0.32, curve: 1.3 },
  highlight: 0.7,
  red: { speed: 0.35, line: 0.9, glow: [255, 160, 48] },
  similar: 40,
};

// The relief: the track lighting lights the ground and the pictures by the slopes of height maps, from the track's sun (its direction and
// height, or the game setting's and SUN.length's). The maps are enhancement art, never read from the game: maps the player made and imported
// in the asset garage (relief-store.js) where there are some, else maps made here from the original pictures (the generated relief).
// - the ground's generated map, per tile texel: the texel's brightness times `detail` (the texture's own grain, bricks and ripples), plus
//   `wall` on the wall surface (terrain.special-values), so walls stand up with lit and shaded edges (at most 1); liquids lie flat at `liquid`
//   and keep their own light.
// - the pictures' generated map, per drawn pixel: a rounded body (the pixel's distance to the picture's edge, up to `round` pixels, eased)
//   mixed with the pixel's brightness, `spriteDetail` of it.
// - heights are 0 to 1 and stand `depth` world units (ground) or `spriteDepth` pixels (pictures) at 1; a slope's normal is lit by the sun:
//   the ground as ambient plus diffuse light against a flat ground's (`ambient` of it ambient), the pictures by how far their normal leans
//   toward the sun against a flat picture's (times `spriteGain`); `occlusion` darkens a texel lower than its neighbours (the mean of the four
//   at `reach` texels); the light stays within `range`, and the track's relief level mixes it in.
export const RELIEF = {
  detail: 0.5,
  wall: 0.5,
  liquid: 0,
  depth: 16,
  round: 4,
  spriteDetail: 0.35,
  spriteDepth: 4,
  ambient: 0.4,
  spriteGain: 0.9,
  occlusion: 0.5,
  reach: 2,
  range: [0.55, 1.45],
};

// The track lighting: a colour grade over the finished picture (never the overlays, nor the sky rows of the slides and the split screen),
// a gradient over the track's sky, and the clouds' light. Per grade: `gain`, `lift` (in 8-bit units) and `gamma` per component, applied as
// ((c / 255) * gain + lift / 255) ** gamma; `saturation` against the grey of the result; `sky` the gradient the sky is mixed toward (`top`
// at row 0, `bottom` at the horizon) by `amount`; `cloudLight` the clouds' light instead of the layers' own; `sprites` the part of the grade
// the pictures (racers, objects, shots) get, so the things to drive around stay easy to see.
export const GRADES = {
  names: ['none', 'dawn', 'sunset', 'dusk', 'night', 'overcast'],
  dawn: { gain: [1.04, 0.98, 0.95], lift: [12, 6, 14], gamma: [0.95, 1, 1.04], saturation: 0.9, sky: { top: [118, 132, 206], bottom: [255, 200, 168], amount: 0.5 }, cloudLight: 0.8, sprites: 0.6 },
  sunset: { gain: [1.1, 0.86, 0.7], lift: [14, 2, 8], gamma: [0.94, 1.02, 1.1], saturation: 1.05, sky: { top: [72, 44, 124], bottom: [255, 146, 64], amount: 0.62 }, cloudLight: 0.7, sprites: 0.6 },
  dusk: { gain: [0.74, 0.7, 0.88], lift: [8, 4, 20], gamma: [1.08, 1.1, 1], saturation: 0.8, sky: { top: [24, 22, 74], bottom: [178, 108, 140], amount: 0.62 }, cloudLight: 0.4, sprites: 0.55 },
  night: { gain: [0.4, 0.46, 0.68], lift: [4, 6, 18], gamma: [1.12, 1.08, 1], saturation: 0.6, sky: { top: [4, 6, 22], bottom: [28, 38, 78], amount: 0.86 }, cloudLight: 0.18, sprites: 0.5 },
  overcast: { gain: [0.92, 0.94, 0.98], lift: [12, 12, 14], gamma: [1, 1, 1], saturation: 0.62, sky: { top: [146, 152, 162], bottom: [204, 208, 214], amount: 0.62 }, cloudLight: 0.72, sprites: 0.75 },
};
