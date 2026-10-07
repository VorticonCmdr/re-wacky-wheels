// The display (Stage 1 of docs/enhancements.md): puts the finished 320 x 200 picture on the visitor's screen, after every renderer and for every
// screen of the game. The page keeps drawing into its canvas exactly as before; this module only decides how that canvas is shown.
// - The page as it was (square pixels, fit, no CRT look, the HUD in the picture, not in full screen): the canvas itself, scaled by the browser.
// - Otherwise, with WebGL 2: a second canvas of the screen's own pixels, which a small shader fills from the picture: sharp scaling to the
//   shape and size chosen and, when it is on, the CRT look (scanlines, glow, curvature). The picture's pixels are read, never changed.
// - Without WebGL 2: the canvas itself again, sized to the shape and scaling (the CRT look is then not available).
// Full screen shows the picture alone, centred on black. With a HUD layer (DISPLAY.huds) the page hands the race screens over as two layers, the
// world and its overlays, and the overlays go on after the CRT look, sharp or enlarged by Scale2x twice; every other screen is the canvas.
// Stage 4: a race screen's world may be drawn at a higher resolution (RESOLUTION 2X: 640 x 400 for the 320 x 200 grid of the overlays, its
// `logical` size) and wider (VIEW WIDE: refW = 320 + 2m reference columns, 426 x 200 for 16:9 on the 4:3 shape). The page tells the display the
// stored rendering choices (setRendering), which then always draws with the graphics card (the page as it was cannot show another size), and
// hands it the layers of each race frame; the textures follow their sizes. With the wide view stored the element is laid out for the widest
// picture the settings allow (geometry.js viewMargin for the display's shape), and every frame is placed by its own logical size inside it: a
// 320-wide screen (the menus, the cards, a slides demo, the split screen, a link race) is pillarboxed in black, with no layout per frame.
import { DISPLAY, CRT, TIMING_FRAMES } from './config.js';
import { normalizeDisplay, isPlain } from './display-settings.js';
import { models } from './models.js';
import { viewMargin } from './geometry.js';

// The picture's place in a space of `width` x `height` screen pixels for the settings, centred: { x, y, w, h, integer }. `source` is the picture's
// logical size ({ w, h }: the canvas's, or a race frame's on the overlays' 320 x 200 grid; a wider one, the wide view's, keeps the shape's height
// and is wider by its columns). 'integer' uses the largest whole number of screen rows for a picture row that fits (and, with square pixels, of
// columns for a column); where not even one fits it fits. `grid` (Stage 4) is the number of screen rows counted whole: the picture's rows by
// default, s times them while the world is drawn at s times the samples (RESOLUTION 2X: 400, so that each of its rows is whole too; some screens
// then show the picture, the menus included, smaller than at 1x). A space one screen pixel short of a multiple in either direction (the
// browser's rounding of an element's size) keeps that multiple, drawn a pixel smaller.
export function pictureRect(width, height, settings, source, grid = source.h) {
  const s = normalizeDisplay(settings), F = models().floor, ratio = DISPLAY.aspects[s.aspect] * (source.w === F.width ? 1 : source.w / F.width);
  let w, h, integer = false;
  if (s.scaling === 'integer') {
    let rows = Math.floor((height + 1) / grid);
    while (rows >= 1 && Math.round(rows * grid * ratio) > width + 1) rows -= 1; // the width the shape gives the rows, rounded
    if (rows >= 1) { h = Math.min(rows * grid, height); w = Math.min(Math.round(rows * grid * ratio), width); integer = true; }
  }
  if (!integer) {
    if (width / height > ratio) { h = height; w = Math.min(Math.round(height * ratio), width); } else { w = width; h = Math.min(Math.round(width / ratio), height); }
  }
  return { x: Math.floor((width - w) / 2), y: Math.floor((height - h) / 2), w, h, integer }; // @math centred
}

// The space beside the panel when not in full screen, in screen pixels: the slot's width up to the page's 960 pixels, and the height of the
// browser's window below the picture's top (less a gap), but at least a screen row for each picture row.
export function windowSpace({ slotWidth, viewportHeight, top, dpr }, source) {
  const W = DISPLAY.window, width = Math.floor(Math.min(slotWidth, W.maxWidth) * dpr), height = Math.floor(Math.max(viewportHeight - top - W.gutter, source.h / dpr) * dpr);
  return { width: Math.max(width, 1), height: Math.max(height, 1) };
}

// How much of the scanlines can be shown: none below `fadeRows` screen rows a picture row, all from `fullRows` (smoothstep between).
export function scanlineFade(rowsPerLine) {
  const { fadeRows, fullRows } = CRT.scanlines, t = Math.min(Math.max((rowsPerLine - fadeRows) / (fullRows - fadeRows), 0), 1);
  return t * t * (3 - 2 * t); // @math smoothstep
}

// The mean brightness of a scanline beam over its row (the beam's profile exp(-d^2 / 2 beam^2) for d from -1/2 to 1/2), which the boost makes up for.
export function beamMean(beam = CRT.scanlines.beam) {
  const n = 64; let sum = 0; // @math the integral by the midpoint rule
  for (let i = 0; i < n; i++) { const d = (i + 0.5) / n - 0.5; sum += Math.exp(-(d * d) / (2 * beam * beam)); } // @math the Gaussian profile
  return sum / n;
}

// The uniforms of the CRT pass for the settings, the picture's size on the screen and its logical size (the scanlines are the overlays' 200
// rows, one beam a game line, whatever the world's resolution).
export function crtUniforms(settings, rect, source) {
  const s = normalizeDisplay(settings), S = CRT.scanlines;
  if (!s.crt) return { crt: 0, scan: 0, scanGain: 1, glow: 0, bulge: 0, vignette: 0, corner: 0 };
  const scan = s.scanlines * S.depth * scanlineFade(rect.h / source.h), mean = 1 - scan * (1 - beamMean(S.beam));
  return { crt: 1, scan, scanGain: 1 + (1 / mean - 1) * S.boost, glow: s.glow * CRT.glow.gain, bulge: s.curvature * CRT.curvature.bulge, vignette: s.curvature * CRT.curvature.vignette, corner: s.curvature * CRT.curvature.corner };
}

// A race screen's two layers for the HUD layer, from indexed pictures: `under` the world before the overlays (flipped as the overlays flip a
// viewer's half), `index` the whole picture, `sentinel` the overlays drawn a second time into a buffer of `blank` values. Fills `layers.world`
// (the world's colour everywhere) and `layers.hud` (the overlays' colours, alpha 0 where there are none) from the RGBA `palette`.
export function overlayLayers(layers, { under, index, sentinel, blank, palette }) {
  const { world, hud } = layers;
  for (let i = 0, o = 0; i < index.length; i++, o += 4) { // @math four bytes a colour
    const over = sentinel[i] !== blank, w = (over ? under[i] : index[i]) * 4, h = index[i] * 4; // @math four bytes a colour
    world[o] = palette[w]; world[o + 1] = palette[w + 1]; world[o + 2] = palette[w + 2]; world[o + 3] = 0xff; // @math opaque
    if (over) { hud[o] = palette[h]; hud[o + 1] = palette[h + 1]; hud[o + 2] = palette[h + 2]; hud[o + 3] = 0xff; } else { hud[o] = 0; hud[o + 1] = 0; hud[o + 2] = 0; hud[o + 3] = 0; } // @math opaque, or nothing (premultiplied)
  }
  return layers;
}

// A race screen's layers as the display uploads them: { world, hud, w, h, hw, hh, logical } with `world` and `hud` as bytes (`hud` null for
// none), the world's size (w x h) and the HUD's (hw x hh). The page hands them over in either of two forms: two bare arrays of the canvas's
// size (`size`; { world, hud }: RGBA bytes), or objects ({ world: { data, w, h }, hud: { data, w, h } | null, logical: { w, h } }: Stage 4's
// form, where `logical` is the picture's size on the 320 x 200 grid the overlays are drawn on and the world may be s times it, RESOLUTION 2X).
// A layer whose bytes are not four a pixel of its size, or a world that is not a whole multiple of the logical size, throws.
export function layerParts(layers, size) {
  const bytes = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength), framed = l => l !== null && typeof l === 'object' && !ArrayBuffer.isView(l);
  const world = framed(layers.world) ? layers.world : { data: layers.world, w: size.w, h: size.h };
  const hud = layers.hud === null || layers.hud === undefined ? null : framed(layers.hud) ? layers.hud : { data: layers.hud, w: size.w, h: size.h };
  const logical = layers.logical ?? { w: size.w, h: size.h };
  for (const [name, l] of [['world', world], ['HUD', hud]]) {
    if (!l) continue;
    if (!(l.w > 0) || !(l.h > 0) || !ArrayBuffer.isView(l.data) || l.data.byteLength !== l.w * l.h * 4) throw new Error(`a ${name} layer of ${l.data?.byteLength} bytes, expected ${l.w * l.h * 4} (four bytes a colour)`); // @math four bytes a colour
  }
  if (world.w % logical.w || world.h % logical.h || world.w / logical.w !== world.h / logical.h) throw new Error(`a world layer of ${world.w} x ${world.h} for a picture of ${logical.w} x ${logical.h}: not a whole multiple of it`);
  return { world: bytes(world.data), hud: hud ? bytes(hud.data) : null, w: world.w, h: world.h, hw: hud ? hud.w : 0, hh: hud ? hud.h : 0, logical };
}

// Scale2x of RGBA bytes (`w` x `h`), as the SCALE2X shader does it: the reference the tests hold the shader's rules to.
export function scale2x(rgba, w, h) {
  const out = new Uint8ClampedArray(rgba.length * 4), px = (x, y) => (Math.min(Math.max(y, 0), h - 1) * w + Math.min(Math.max(x, 0), w - 1)) * 4; // @math four times the pixels; four bytes a colour
  const same = (a, b) => rgba[a] === rgba[b] && rgba[a + 1] === rgba[b + 1] && rgba[a + 2] === rgba[b + 2] && rgba[a + 3] === rgba[b + 3]; // @math the four components
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = px(x, y), A = px(x, y - 1), B = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
    const quarters = [same(C, A) && !same(C, D) && !same(A, B) ? A : P, same(A, B) && !same(A, C) && !same(B, D) ? B : P, same(D, C) && !same(D, B) && !same(C, A) ? C : P, same(B, D) && !same(B, A) && !same(D, C) ? D : P];
    quarters.forEach((from, q) => { const o = ((2 * y + (q >> 1)) * 2 * w + 2 * x + (q & 1)) * 4; for (let k = 0; k < 4; k++) out[o + k] = rgba[from + k]; }); // @math the quarter's row and column; four bytes a colour
  }
  return out;
}

const VERTEX = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// One direction of the glow's Gaussian blur, at the picture's own size.
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uSize; uniform vec2 uDir; uniform float uSigma; uniform int uTaps;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize; vec3 sum = vec3(0.0); float total = 0.0;
  for (int i = -uTaps; i <= uTaps; i++) { float w = exp(-0.5 * float(i * i) / (uSigma * uSigma)); sum += w * texture(uTex, uv + float(i) * uDir / uSize).rgb; total += w; }
  outColor = vec4(sum / total, 1.0);
}`;

// Scale2x (EPX, as AdvanceMAME has it) of an RGBA picture, at twice its size: each pixel becomes four, and a quarter takes the colour of the two
// neighbours it lies between when they are the same and the other two differ (a diagonal edge goes on smoothly, straight edges stay).
const SCALE2X = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform ivec2 uSize;
out vec4 outColor;
vec4 at(ivec2 p) { return texelFetch(uTex, clamp(p, ivec2(0), uSize - 1), 0); }
void main() {
  ivec2 o = ivec2(gl_FragCoord.xy), p = o / 2, q = o - p * 2;
  vec4 P = at(p), A = at(p + ivec2(0, -1)), B = at(p + ivec2(1, 0)), C = at(p + ivec2(-1, 0)), D = at(p + ivec2(0, 1));
  vec4 r = P;
  if (q.x == 0 && q.y == 0 && C == A && C != D && A != B) r = A;
  if (q.x == 1 && q.y == 0 && A == B && A != C && B != D) r = B;
  if (q.x == 0 && q.y == 1 && D == C && D != B && C != A) r = C;
  if (q.x == 1 && q.y == 1 && B == D && B != A && D != C) r = D;
  outColor = r;
}`;

// The picture on the screen: sharp scaling (a pixel's inside is its own colour, its edge blends over one screen pixel where it does not
// cover whole screen pixels; at whole multiples every screen pixel is exactly one picture pixel's), then the CRT look when it is on (a scanline
// beam for each of the picture's `uLines` logical rows, the game's 200 lines whatever the world's resolution), then the HUD layer when there is
// one (premultiplied: its transparent pixels are 0 in every component), sharp at its own size, over everything.
const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform sampler2D uGlow; uniform sampler2D uHud;
uniform vec2 uSrcSize; uniform vec4 uRect; uniform float uCanvasH; uniform vec2 uHudSize; uniform float uHudOn; uniform float uLines;
uniform float uCrt; uniform float uScan; uniform float uBeam; uniform float uScanGain; uniform float uGlowAmt; uniform float uBulge; uniform float uVignette; uniform float uFalloff; uniform float uCorner;
out vec4 outColor;
vec2 sharpAt(vec2 uv, vec2 size) {
  vec2 t = uv * size, base = floor(t), f = t - base - 0.5, scale = max(uRect.zw / size, vec2(1.0)), range = 0.5 - 0.5 / scale;
  return (base + 0.5 + (f - clamp(f, -range, range)) * scale) / size;
}
vec3 sharp(vec2 uv) { return texture(uSrc, sharpAt(uv, uSrcSize)).rgb; }
vec3 withHud(vec3 c, vec2 uv) {
  if (uHudOn < 0.5) return c;
  vec4 h = texture(uHud, sharpAt(uv, uHudSize));
  return c * (1.0 - h.a) + h.rgb;
}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y), uv = (frag - uRect.xy) / uRect.zw;
  if (uCrt < 0.5) {
    outColor = (uv.x < 0.0 || uv.y < 0.0 || uv.x >= 1.0 || uv.y >= 1.0) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(withHud(sharp(uv), uv), 1.0);
    return;
  }
  vec2 p = uv * 2.0 - 1.0; p *= (1.0 + uBulge * dot(p, p)) / (1.0 + uBulge); uv = p * 0.5 + 0.5;
  float aspect = uRect.z / uRect.w; vec2 q = abs(uv - 0.5) * vec2(aspect, 1.0), halfSize = vec2(0.5 * aspect, 0.5);
  vec2 e = q - (halfSize - uCorner); float dist = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - uCorner;
  float px = max(fwidth(uv.y), 1e-6), inside = clamp(0.5 - dist / px, 0.0, 1.0);
  vec2 cuv = clamp(uv, vec2(0.0), vec2(1.0) - 0.5 / uSrcSize), vuv = clamp(uv, vec2(0.0), vec2(1.0));
  vec3 c = sharp(cuv);
  float d = fract(vuv.y * uLines) - 0.5, beam = exp(-0.5 * d * d / (uBeam * uBeam));
  c *= (1.0 - uScan * (1.0 - beam)) * uScanGain;
  vec3 g = texture(uGlow, cuv).rgb; c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - uGlowAmt * g);
  float v = 16.0 * vuv.x * vuv.y * (1.0 - vuv.x) * (1.0 - vuv.y); c *= mix(1.0, pow(max(v, 0.0), uFalloff), uVignette);
  outColor = vec4(withHud(c, cuv) * inside, 1.0);
}`;

function program(gl, fragment) {
  const make = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, make(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const names = new Map(), at = name => { if (!names.has(name)) names.set(name, gl.getUniformLocation(p, name)); return names.get(name); };
  return { p, at };
}

function texture(gl, w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

// The sizes of the textures for a world of w x h and a HUD of hw x hh (Stage 4: the world may be s times the logical picture, the HUD is the
// logical picture's): the picture and the glow's two passes at the world's size, the HUD at its own, twice and four times it (Scale2x).
export const textureSizes = (w, h, hw, hh) => ({ src: [w, h], glow: [[w, h], [w, h]], hud: [[hw, hh], [2 * hw, 2 * hh], [4 * hw, 4 * hh]] }); // @math the HUD at its size, twice and four times it

// The graphics card's part: the picture uploaded each frame (or the world and HUD layers of a race screen), the two blur passes of the glow
// (only with the CRT look and some glow), the two Scale2x passes of a smooth HUD and the final pass. The textures are made at the canvas's size
// and made again (texImage2D) whenever a frame's world or HUD has another size; a frame of the same size only replaces their pixels
// (texSubImage2D). Throws when WebGL 2 or a shader is not available.
function createRenderer(canvas, source) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('no WebGL 2');
  let W = source.width, H = source.height, HW = W, HH = H, lines = H, layered = false; // the world's size, the HUD's, the picture's logical rows
  const sizes = textureSizes(W, H, HW, HH), final = program(gl, FINAL), blur = program(gl, BLUR), scale2x = program(gl, SCALE2X), src = texture(gl, ...sizes.src);
  const target = t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
  const glow = sizes.glow.map(([w, h]) => texture(gl, w, h)), fbo = glow.map(target);
  const hud = sizes.hud.map(([w, h]) => texture(gl, w, h)), hudFbo = hud.map(target);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(gl.createVertexArray());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3); // @math one triangle over the whole target
  const define = (t, [w, h]) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); };
  const sizeWorld = (w, h) => { if (w === W && h === H) return; W = w; H = h; const z = textureSizes(w, h, HW, HH); define(src, z.src); glow.forEach((t, k) => define(t, z.glow[k])); };
  const sizeHud = (w, h) => { if (w === HW && h === HH) return; HW = w; HH = h; textureSizes(W, H, w, h).hud.forEach((z, k) => define(hud[k], z)); };
  return {
    gl,
    sizes: () => ({ world: { w: W, h: H }, hud: layered ? { w: HW, h: HH } : null, lines }),
    // The canvas, or a race screen's layers (layerParts: RGBA bytes, the world at its size and the overlays at theirs with alpha 0 where there
    // are none; a HUD of null shows the world alone).
    upload(layers = null) {
      if (!layers) { sizeWorld(source.width, source.height); gl.bindTexture(gl.TEXTURE_2D, src); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source); layered = false; lines = source.height; return; }
      const parts = layerParts(layers, { w: source.width, h: source.height });
      sizeWorld(parts.w, parts.h); gl.bindTexture(gl.TEXTURE_2D, src);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, parts.world);
      if (parts.hud) { sizeHud(parts.hw, parts.hh); gl.bindTexture(gl.TEXTURE_2D, hud[0]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HW, HH, gl.RGBA, gl.UNSIGNED_BYTE, parts.hud); }
      layered = Boolean(parts.hud); lines = parts.logical.h;
    },
    render(rect, u, hudMode = 'picture') {
      const showHud = layered && hudMode !== 'picture', smooth = showHud && hudMode === 'smooth', scale = H / lines; // the world's pixels a logical row
      if (smooth) { // the HUD enlarged by Scale2x twice
        gl.useProgram(scale2x.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(scale2x.at('uTex'), 0);
        [[0, 1], [1, 2]].forEach(([from, to]) => { const f = 2 ** from; gl.bindFramebuffer(gl.FRAMEBUFFER, hudFbo[to]); gl.viewport(0, 0, 2 * f * HW, 2 * f * HH); gl.bindTexture(gl.TEXTURE_2D, hud[from]); gl.uniform2i(scale2x.at('uSize'), f * HW, f * HH); draw(); }); // @math each pass doubles the size
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      if (u.crt && u.glow > 0) { // the halo: the picture blurred across, then down, at its own size (the radius and the taps in the world's pixels: the same halo at any resolution)
        gl.useProgram(blur.p); gl.viewport(0, 0, W, H); gl.uniform1i(blur.at('uTex'), 0); gl.uniform2f(blur.at('uSize'), W, H); gl.uniform1f(blur.at('uSigma'), CRT.glow.radius * scale); gl.uniform1i(blur.at('uTaps'), Math.round(CRT.glow.taps * scale)); gl.activeTexture(gl.TEXTURE0);
        [[src, fbo[0], [1, 0]], [glow[0], fbo[1], [0, 1]]].forEach(([from, to, dir]) => { gl.bindFramebuffer(gl.FRAMEBUFFER, to); gl.bindTexture(gl.TEXTURE_2D, from); gl.uniform2f(blur.at('uDir'), dir[0], dir[1]); draw(); });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.useProgram(final.p); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(final.at('uSrc'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glow[1]); gl.uniform1i(final.at('uGlow'), 1); // @math the second texture unit
      const hudScale = smooth ? 4 : 1; // @math the size of the HUD texture the final pass reads
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, hud[smooth ? 2 : 0]); gl.uniform1i(final.at('uHud'), 2); gl.uniform2f(final.at('uHudSize'), hudScale * HW, hudScale * HH); gl.uniform1f(final.at('uHudOn'), showHud ? 1 : 0); // @math the third texture unit; the four-times HUD
      gl.uniform2f(final.at('uSrcSize'), W, H); gl.uniform4f(final.at('uRect'), rect.x, rect.y, rect.w, rect.h); gl.uniform1f(final.at('uCanvasH'), canvas.height); gl.uniform1f(final.at('uLines'), lines);
      for (const [name, v] of [['uCrt', u.crt], ['uScan', u.scan], ['uBeam', CRT.scanlines.beam], ['uScanGain', u.scanGain], ['uGlowAmt', u.glow], ['uBulge', u.bulge], ['uVignette', u.vignette], ['uFalloff', CRT.curvature.falloff], ['uCorner', u.corner]]) gl.uniform1f(final.at(name), v);
      draw();
    },
  };
}

// The display of the page. `source` is the 320 x 200 canvas every screen is drawn into, `host` the element around it (the one that goes full
// screen), `closeUp` an optional canvas of the panel that shows a part of the screen enlarged. `onChange` is called when full screen comes or goes and
// when the graphics card's part turns out not to be available, is lost or comes back (the CRT look is then not available, or is again).
export function createDisplay({ source, host, closeUp = null, onChange = () => {} }) {
  const canvas = document.createElement('canvas'); canvas.className = 'display'; canvas.hidden = true; canvas.setAttribute('aria-label', source.getAttribute('aria-label') ?? '');
  host.append(canvas);
  let settings = normalizeDisplay(), renderer = null, tried = false, failure = null, lost = false, observed = null, mode = 'plain', shown = 0, lastCloseUp = -Infinity, ms = 0, frames = 0, scratch = null;
  let rendering = { scale: 1, wide: false }, logical = null; // the stored rendering choices (setRendering); the logical size of the picture last uploaded
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; layout(); onChange(); });
  canvas.addEventListener('webglcontextrestored', () => { try { renderer = createRenderer(canvas, source); lost = false; failure = null; } catch (e) { renderer = null; failure = e.message; } layout(); onChange(); });

  // Whether the CRT look can be shown: before the graphics card's part is needed, whether the browser has WebGL 2 at all (the page as it was
  // never makes a WebGL context); after, whether it was made and is not lost.
  const ready = () => (tried ? Boolean(renderer) && !lost : typeof WebGL2RenderingContext === 'function');
  function start() { // the graphics card's part, made the first time a setting needs it
    if (!tried) { tried = true; try { renderer = createRenderer(canvas, source); } catch (e) { failure = e.message; onChange(); } }
    return ready();
  }
  const fullscreen = () => document.fullscreenElement === host;
  const dpr = () => globalThis.devicePixelRatio || 1;
  const size = () => ({ w: source.width, h: source.height });
  // The widest picture the stored choices can hand over, which the element is laid out for: the wide view's (its margin for the display's shape)
  // while the graphics card draws, else the canvas's.
  const widest = () => (mode === 'gl' && rendering.wide ? { w: source.width + 2 * viewMargin('wide', settings.aspect), h: source.height } : size()); // @math a margin on either side
  // The page as it was, for plain settings out of full screen: not while the stored rendering choices draw a world of another size (it could not
  // show one), unless the graphics card cannot be used anyway (`rendered` false: then the world is drawn at 1x and the page is as it was).
  // Decided from the stored choices, not from what a frame drew: the graphics card starts when they need it, and worldReady can become true.
  const plainFor = (s, full, rendered = true) => (isPlain(s) && !full && (!rendered || (rendering.scale === 1 && !rendering.wide)) ? 'plain' : null);
  // The screen rows the integer scaling counts whole: s times the picture's rows while the world is drawn at s times the samples.
  const gridOf = l => (mode === 'gl' && rendering.scale > 1 ? rendering.scale * l.h : l.h);

  // Which way the picture is shown, and the sizes of the elements for it. A CRT look or a HUD layer the browser cannot show does not count.
  function layout() {
    const full = fullscreen();
    mode = plainFor({ ...settings, crt: settings.crt && ready(), hud: ready() ? settings.hud : 'picture' }, full) ?? (start() ? 'gl' : plainFor({ ...settings, crt: false, hud: 'picture' }, full, false) ?? 'css'); // a CRT look, a HUD layer or a world of another size the browser cannot show does not count
    canvas.hidden = mode !== 'gl'; source.hidden = mode === 'gl';
    for (const el of [canvas, source]) { el.style.width = ''; el.style.height = ''; }
    source.classList.toggle('sized', mode === 'css');
    if (mode === 'plain') return present(false);
    const r = dpr(), at = host.getBoundingClientRect();
    const box = full ? { width: Math.round(at.width * r), height: Math.round(at.height * r) } : windowSpace({ slotWidth: host.parentElement?.clientWidth ?? at.width, viewportHeight: innerHeight, top: at.top + scrollY, dpr: r }, size());
    const rect = full ? { w: box.width, h: box.height } : pictureRect(box.width, box.height, settings, widest(), gridOf(widest()));
    if (mode === 'css') { const pic = full ? pictureRect(box.width, box.height, settings, size()) : rect; source.style.width = `${pic.w / r}px`; source.style.height = `${pic.h / r}px`; return present(false); }
    canvas.style.width = full ? '100%' : `${rect.w / r}px`; canvas.style.height = full ? '100%' : `${rect.h / r}px`;
    const target = observed?.key === sizeKey() ? observed : rect; // the size the browser reported for the element at this size, else the computed one (the observer reports the real one when the element's size changes)
    if (canvas.width !== target.w || canvas.height !== target.h) { canvas.width = target.w; canvas.height = target.h; }
    present(false);
  }
  const sizeKey = () => `${canvas.style.width} ${canvas.style.height} ${dpr()}`;

  // Shows the source canvas as it is now (`upload` false: the last picture again, after a change of size or settings). `layers` is a race
  // screen's world and overlays (as two arrays of the canvas's size, or in the object form of layerParts with the world at its own size: Stage
  // 4's RESOLUTION, the page hands the frame's layers over at every HUD setting, the overlays stamped into the world for 'picture'); without
  // them the canvas is shown whole. Layers with a HUD layer while the HUD is set to be in the picture show the canvas (it has the overlays).
  // The picture's place comes from the frame's logical size.
  function present(upload = true, layers = null) {
    if (mode === 'gl' && ready()) {
      const t0 = performance.now(), use = layers && (settings.hud !== 'picture' || layers.hud === null || layers.hud === undefined) ? layers : null;
      if (upload || !shown) { renderer.upload(use); logical = use?.logical ?? size(); }
      const shape = logical ?? size(), rect = pictureRect(canvas.width, canvas.height, settings, shape, gridOf(shape));
      renderer.render(rect, crtUniforms(settings, rect, shape), settings.hud); shown += 1;
      ms += (performance.now() - t0 - ms) / Math.min(++frames, TIMING_FRAMES); // a running mean of the CPU time
    }
    drawCloseUp();
  }
  const shownRect = () => { const shape = logical ?? size(); return pictureRect(canvas.width, canvas.height, settings, shape, gridOf(shape)); };

  // The panel's close-up: the screen's own pixels around a point of the picture, enlarged without smoothing.
  function drawCloseUp() {
    if (!closeUp || fullscreen() || closeUp.offsetParent === null) return;
    const now = performance.now(), C = DISPLAY.closeUp; if (now - lastCloseUp < C.everyMs) return; lastCloseUp = now;
    const r = dpr(), cw = Math.round(C.width * r), ch = Math.round(C.height * r);
    if (closeUp.width !== cw || closeUp.height !== ch) { closeUp.width = cw; closeUp.height = ch; closeUp.style.width = `${C.width}px`; closeUp.style.height = `${C.height}px`; }
    let from = canvas, area = shownRect();
    if (mode !== 'gl') { // the browser scales the canvas itself: the same nearest-pixel scaling, done here at the size it is shown
      const b = source.getBoundingClientRect(), cs = getComputedStyle(source), edge = k => parseFloat(cs[k]) || 0; // the shown size to the fraction of a CSS pixel, less the border
      const w = Math.max(Math.round((b.width - edge('borderLeftWidth') - edge('borderRightWidth')) * r), 1), h = Math.max(Math.round((b.height - edge('borderTopWidth') - edge('borderBottomWidth')) * r), 1);
      scratch ??= document.createElement('canvas'); if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
      const s = scratch.getContext('2d'); s.imageSmoothingEnabled = false; s.drawImage(source, 0, 0, w, h); from = scratch; area = { x: 0, y: 0, w, h };
    }
    const sw = cw / C.zoom, sh = ch / C.zoom, sx = Math.min(Math.max(area.x + area.w * C.at[0] - sw / 2, 0), from.width - sw), sy = Math.min(Math.max(area.y + area.h * C.at[1] - sh / 2, 0), from.height - sh); // @math centred on the point
    const g = closeUp.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.drawImage(from, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  // The element's real size in screen pixels, where the browser reports it: the backing store follows it exactly.
  if (typeof ResizeObserver === 'function') {
    try {
      new ResizeObserver(entries => {
        const box = entries[0]?.devicePixelContentBoxSize?.[0]; if (!box?.inlineSize || !box.blockSize) return;
        observed = { key: sizeKey(), w: box.inlineSize, h: box.blockSize }; // kept for the next layout, which would otherwise put the computed size back
        if (mode === 'gl' && (canvas.width !== observed.w || canvas.height !== observed.h)) { canvas.width = observed.w; canvas.height = observed.h; present(false); }
      }).observe(canvas, { box: 'device-pixel-content-box' });
    } catch { /* the browser does not report device pixels: the computed size stands */ }
    new ResizeObserver(() => layout()).observe(host.parentElement ?? host);
  }
  addEventListener('resize', layout);
  document.addEventListener('fullscreenchange', () => { layout(); onChange(); });
  canvas.addEventListener('dblclick', () => toggleFullscreen());
  source.addEventListener('dblclick', () => toggleFullscreen());

  // Full screen comes only from a key or a click of the player (browsers refuse it otherwise): call this in the handler of that event. Esc is left
  // to the browser, which leaves full screen with it: the page does not lock the key, because holding Esc to leave would reach the game as
  // presses of its own Esc (the in-race menu, giving up a link race).
  function toggleFullscreen() {
    if (fullscreen()) { document.exitFullscreen?.().catch(() => {}); return; }
    if (!document.fullscreenEnabled || !host.requestFullscreen) return;
    host.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }

  return {
    configure(next) { settings = normalizeDisplay(next); layout(); },
    get settings() { return settings; },
    // The stored rendering choices of the graphics settings (Stage 4: the scale, and whether the view is wide), told by the page whenever
    // they change and before the first frame: away from 1x and the standard view the graphics card draws (worldReady), even from plain
    // display settings, the integer scaling counts s times the rows, and the element is laid out for the wide view's picture (widest).
    setRendering({ scale = 1, wide = false } = {}) { const next = { scale: Number.isInteger(scale) && scale > 1 ? scale : 1, wide: Boolean(wide) }; if (next.scale === rendering.scale && next.wide === rendering.wide) return; rendering = next; layout(); },
    get rendering() { return { ...rendering }; },
    present,
    layout,
    toggleFullscreen,
    fullscreen,
    crtReady: ready,
    // Whether the page may draw a race's world at another size than the canvas's (Stage 4): the graphics card draws (without WebGL 2, or with
    // its context lost, the page draws at 1x and shows the canvas).
    worldReady: () => mode === 'gl' && ready(),
    // Whether the page should hand race screens over as layers: the graphics card draws and the HUD is a layer of its own.
    hudLayer: () => mode === 'gl' && ready() && settings.hud !== 'picture',
    // The way the picture is shown, the display pass's mean time, the canvas's size and the picture's place on it; with the graphics card the
    // sizes of the last frame's world and HUD layer (null for none), its logical size and the logical size the element is laid out for.
    stats: () => { const gl = mode === 'gl' && renderer ? renderer.sizes() : null; return { mode, ms, failure, lost, started: tried, width: canvas.width, height: canvas.height, rect: mode === 'gl' ? shownRect() : null, world: gl?.world ?? null, hud: gl?.hud ?? null, logical: mode === 'gl' ? logical ?? size() : null, element: mode === 'gl' ? widest() : null }; },
    canvas,
  };
}
