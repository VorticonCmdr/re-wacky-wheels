// The design values of the Enhanced presentation (docs/enhancements.md). Everything here is an artistic or engineering choice of this
// port: none of it is evidence about the DOS game, none of it has a claim, and nothing outside src/enhance reads it. The constants the
// effects share with the game (the screen, the view, the turn, the horizon strip, the tick) are not repeated here: src/enhance reads them
// from the reconstructed modules (view.js, sky.js, floor.js, horizon.js, clock.js). `npm run lint` keeps the numbers of src/enhance in
// this file: any other module of the directory may use only 0, 1 and lines tagged `// @math <reason>`.

// The presets. Original is the reference renderer of the port, untouched; Enhanced turns every effect of the first milestone on.
export const EFFECTS = ['smooth', 'shadows', 'sceneryShadows', 'sunShadows', 'particles', 'skidMarks', 'fog'];
export const PRESETS = {
  original: { smooth: false, shadows: false, sceneryShadows: false, sunShadows: false, particles: false, skidMarks: false, fog: false },
  enhanced: { smooth: true, shadows: true, sceneryShadows: true, sunShadows: true, particles: true, skidMarks: true, fog: true },
};

// The intensity controls of the page (each 0 to 1) and their defaults; `sunAngle` is the sun's direction in the world as a part of a turn
// (the same for every track: the tracks carry no sun of their own).
export const LEVELS = { shadowStrength: 1, fogStrength: 1, particleAmount: 1, sunAngle: 0.375 };
export const LEVEL_STEPS = 40; // levels are kept in fortieths (the sliders move in twentieths, the sun in the menu in eighths)

// The game menu of the effects (GAME OPTIONS > DISPLAY AND EFFECTS, src/game/graphics-menu.js): the words it shows and what Enter does to a level. A strength goes up by a
// quarter and from full back to off; the sun goes round in eighths of a turn. The sun's names say where it stands with the track map's top as north (the shadows fall
// the other way): the shadows of the angle 0 fall toward the map's right.
export const MENU = {
  presets: { original: 'ORIGINAL', enhanced: 'ENHANCED', custom: 'CUSTOM' },
  strengthStep: 0.25,
  off: 'OFF',
  percent: 100,
  sunNames: ['WEST', 'NORTH WEST', 'NORTH', 'NORTH EAST', 'EAST', 'SOUTH EAST', 'SOUTH', 'SOUTH WEST'],
};

// The settings a visitor starts with: the Original preset, so the port plays as the game did until the player chooses otherwise.
export const DEFAULTS = { preset: 'original', ...PRESETS.original, ...LEVELS };
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

// The display (Stage 1 of docs/enhancements.md): how the finished 320 x 200 picture is put on the visitor's screen, after every renderer, for
// the Original preset as for the Enhanced one. Nothing here changes a pixel of the picture itself.
// - `aspects`: the shape of the whole picture. 'wide' is the page's square pixels (320 by 200, 16:10); 'dos' the 4:3 a VGA monitor of the time
//   stretched every 320 x 200 mode to, which makes a pixel 1.2 times as tall as it is wide.
// - `scalings`: 'fit' fills the space with the largest picture of the shape, its pixels drawn sharp with a soft edge one screen pixel wide
//   where a pixel does not cover whole screen pixels; 'integer' uses whole screen pixels for every row (and for every column when the pixels
//   are square), so all rows are the same height (and with square pixels all columns the same width).
// - `window`: the largest picture beside the panel when not in full screen (the page's 960 pixels), and the gap kept below it.
// - `plain`: square pixels and fit, with no CRT look, are the page as it was: the browser scales the canvas itself, without WebGL.
// - The defaults are 4:3 (the maintainer's choice, 2026-10-06: the shape the game had on a monitor), fit, and the CRT look off with its
//   curvature off.
export const DISPLAY = {
  aspects: { wide: 1.6, dos: 4 / 3 },
  scalings: ['fit', 'integer'],
  window: { maxWidth: 960, gutter: 16 },
  plain: { aspect: 'wide', scaling: 'fit' },
  defaults: { aspect: 'dos', scaling: 'fit', crt: false, scanlines: 0.5, glow: 0.25, curvature: 0 },
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
};
