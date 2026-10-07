// The 2x cost spike of Stage 4 (docs/enhancements.md, Stage 4 as built, M5): what drawing the Enhanced presentation at twice the reference
// resolution costs in node on a local WACKY.DAT, before any setting can ask for it (M6). It draws one attract demo through the enhancer at
// the reference geometry (1x, 320 x 200), at 2x (640 x 400) and at 2x with the wide view's margin for 4 BY 3 (geometry.js viewMargin: 53
// columns a side, 852 x 400; only through the frame context's geometry override, so the margins are M5's stand-ins: the sky's edge column,
// the reference fan's records), each round of the configurations interleaved so that a busy machine slows them alike, and prints per row
// the mean, median and 95th percentile of a frame's draw, the mean of each stage (createEnhancer({ stages })), the sky rows the composite
// took on its fast path, and the reference renderer's row of the same run. It times apart the table caster (with and without the ground's
// relief), the composite with and without the sky-band fast path, and the sun shadows' blur (the running sum above 1x against blurCast's
// sums). Then it scales the 2x rows to the quiet machine the budget is set on (HD.quiet: the 1x Enhanced draw documented there, times this
// run's 2x / 1x ratio) and says whether each look holds the budget (HD.budget): 'reference' (M6, the default: the soft layers on the reference
// grid) and 'full' (every soft layer at the output resolution, M5's draw, createEnhancer({ look: 'full' })). A measurement, not a check: it
// fails only when a draw is not the size its geometry says.
// usage: node scripts/spike-2x.mjs [WACKY.DAT] [--demo N] [--ticks N] [--rounds N]
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack, rgbaPalette } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { parseMov } from '../src/game/figure.js';
import { startRace, stepRace, beginIntro } from '../src/game/race.js';
import { demoSpec, parseBmc, bmcStart, bmcStep } from '../src/game/demo.js';
import { defaultSettings } from '../src/game/menus.js';
import { drawRaceFrame, drawRaceOverlays, sceneSky } from '../src/render/race-frame.js';
import { loadHudArt } from '../src/render/hud.js';
import { createEnhancer } from '../src/enhance/index.js';
import { PRESETS, ATMOSPHERE, HD, SUN, LEVELS } from '../src/enhance/config.js';
import { geometryOf, viewMargin, IDENTITY } from '../src/enhance/geometry.js';
import { castFloor } from '../src/enhance/caster.js';
import { drawFloor } from '../src/enhance/project.js';
import { groundRelief, groundLight, sunVector } from '../src/enhance/relief.js';
import { createLayers } from '../src/enhance/scene.js';
import { blurCast, boxBlurCast } from '../src/enhance/shadows.js';
import { createRandom } from '../src/enhance/particles.js';

const args = process.argv.slice(2), opt = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const race = opt('--demo', 1), ticks = opt('--ticks', 300), rounds = opt('--rounds', 3), path = args.find(a => /\.dat$/i.test(a)); // @math the attract demo of track 1; a few hundred ticks; three rounds
const dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT');
const members = archiveMembers(dat), mov = parseMov(members.get('GIG.MOV')), hudArt = loadHudArt(members), SIZE = 64000, PICTURES = 5, WARM = 20; // @math the 320 x 200 screen; five pictures a tick (60 Hz over the 11.3 Hz ticks); the ticks before the times count
const raceTracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => n.replace('.GAM', ''));
const memory = (atmo = null) => { const m = new Map(); if (atmo) m.set(ATMOSPHERE.storageKey, JSON.stringify({ version: 1, tracks: Object.fromEntries(raceTracks.map(t => [t, atmo])) })); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
let problems = 0;

// The attract demo on its recorded controls (as scripts/check-enhance.js runs it).
function demo() {
  const spec = demoSpec('attract', race), state = { mov, unproven: new Set(), hud: null, dat, hudArt, menu: { settings: defaultSettings(1, true) }, seed: 4242, detail: spec.detail, class: spec.class, engine: spec.engine, humanSlot: race % 8, demo: { kind: 'attract', spec, mode: spec.mode, page: 1, pictures: null } }; // @math the checks' seed; a driver for each race
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, state.humanSlot), lion: lionBytes(members) }, spec.laps); beginIntro(state);
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`)));
  return { state, input: () => { if (state.intro) return {}; const s = bmcStep(bmc); bmc = s.state; return s.controls.end ? null : s.controls; } };
}

const m = viewMargin('wide', 'dos'), G2 = geometryOf({ s: 2, m: 0 }), GW = geometryOf({ s: 2, m }); // @math twice the samples each way
const ROWS = [
  ['reference renderer', null],
  ['Enhanced 1x', { settings: PRESETS.enhanced, G: IDENTITY }],
  ['Enhanced 2x', { settings: PRESETS.enhanced, G: G2 }],
  ['Enhanced 2x full', { settings: PRESETS.enhanced, G: G2, look: 'full' }],
  ['Enhanced 2x, no fast path', { settings: PRESETS.enhanced, G: G2, force: { slow: true } }],
  ['Enhanced 2x sunset', { settings: PRESETS.enhanced, G: G2, atmosphere: { grade: 'sunset' } }],
  ['Enhanced 2x sunset full', { settings: PRESETS.enhanced, G: G2, atmosphere: { grade: 'sunset' }, look: 'full' }],
  ['Enhanced 1x sunset', { settings: PRESETS.enhanced, G: IDENTITY, atmosphere: { grade: 'sunset' } }],
  ['smooth only 2x', { settings: { ...PRESETS.original, smooth: true }, G: G2 }],
  [`Enhanced 2x wide (m ${m})`, { settings: PRESETS.enhanced, G: GW }],
];

// One run of a row over the demo: every draw's time after the warm-up and the enhancer's stage means.
function run(row) {
  const keep = Math.random; Math.random = createRandom(777); // a repeatable stand-in for the browser's random source
  try {
    const sc = demo(), s = sc.state, index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), times = []; // @math four bytes a colour
    const enh = row ? createEnhancer({ storage: memory(row.atmosphere), stages: true, force: row.force ?? null, look: row.look }) : null;
    if (enh) enh.configure(row.settings);
    let stages = null, fast = 0, sized = true;
    for (let t = 0; t < ticks; t++) {
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); enh?.afterTick(s);
      if (t === WARM && enh) enh.stats(); // the stage sums from here on
      const palette = rgbaPalette(s.world.palette);
      for (let d = 0; d < PICTURES; d++) {
        const t0 = performance.now();
        if (enh) { const P = enh.drawSingle(s, d / PICTURES, { index, out, palette, mode: s.detail, sky: sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb), geometry: row.G }); if (!s.minimap && P.minimap) s.minimap = P.minimap; }
        else { drawRaceFrame(s, index); for (let i = 0; i < SIZE; i++) { const p = index[i] * 4; out[i * 4] = palette[p]; out[i * 4 + 1] = palette[p + 1]; out[i * 4 + 2] = palette[p + 2]; out[i * 4 + 3] = 255; } } // @math the page's blit: four bytes a colour
        if (t > WARM) times.push(performance.now() - t0);
      }
      if (enh) { const L = enh.layers(); if (L.world.w !== row.G.W || L.world.h !== row.G.H) sized = false; }
    }
    if (enh) { const st = enh.stats(); stages = st.stages; fast = st.fastRows; }
    if (!sized) { problems++; console.log(`FAIL ${row ? row.G.key : ''}: a draw was not ${row.G.W} x ${row.G.H}`); }
    return { times, stages, fast };
  } finally { Math.random = keep; }
}

const acc = ROWS.map(() => ({ times: [], stages: {}, runs: 0, fast: 0 }));
for (let r = 0; r < rounds; r++) {
  const order = ROWS.map((_, i) => i);
  if (r % 2) order.reverse(); // alternate the order so that neither end of a round is always the busier one
  for (const i of order) {
    const { times, stages, fast } = run(ROWS[i][1]), a = acc[i];
    a.times.push(...times); a.runs++; a.fast += fast;
    if (stages) for (const [k, v] of Object.entries(stages)) a.stages[k] = (a.stages[k] ?? 0) + v;
  }
}
const stat = t => { const s = [...t].sort((x, y) => x - y); return { mean: s.reduce((x, y) => x + y, 0) / s.length, median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)] }; }; // @math the 95th percentile
const device = (() => { try { return process.platform === 'darwin' ? execSync('sysctl -n hw.model', { encoding: 'utf8' }).trim() : os.hostname(); } catch { return os.hostname(); } })();
console.log(`spike-2x: attract demo ${race}, ${ticks} ticks, ${PICTURES} pictures a tick, ${rounds} rounds interleaved, on ${device}, ${os.cpus()[0].model}, node ${process.version}; load average ${os.loadavg().map(v => v.toFixed(1)).join(' ')}`);
const result = ROWS.map(([label], i) => ({ label, ...stat(acc[i].times), stages: Object.fromEntries(Object.entries(acc[i].stages).map(([k, v]) => [k, v / acc[i].runs])), fast: acc[i].runs ? acc[i].fast / acc[i].runs : 0 }));
for (const r of result) {
  const st = Object.entries(r.stages).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  console.log(`  ${r.label.padEnd(28)} mean ${r.mean.toFixed(2)} ms, median ${r.median.toFixed(2)} ms, 95th percentile ${r.p95.toFixed(2)} ms${st ? `\n    stages (ms): ${st}; sky rows on the fast path ${r.fast.toFixed(0)}` : ''}`);
}

// ---- the parts apart, on the demo's track: the caster, the composite's fast path, the blur
{
  const time = (label, fn, n = 150) => { for (let i = 0; i < 20; i++) fn(i); const t = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(i); t.push(performance.now() - t0); } t.sort((a, b) => a - b); console.log(`  ${label.padEnd(46)} median ${t[n >> 1].toFixed(3)} ms`); }; // @math warm-up and samples
  const world = demo().state.world, cams = Array.from({ length: 40 }, (_, i) => ({ x: 2048 + i * 13.3, y: 2048 + i * 7.1, heading: (i * 47) % 1920 })); // @math forty cameras over the map's middle
  const ground = groundRelief(world), sun = sunVector(world, LEVELS.sunAngle, SUN.length); // the default sun
  console.log('parts:');
  for (const [label, G] of [['1x', IDENTITY], ['2x', G2], [`2x wide (m ${m})`, GW]]) {
    const fb = new Uint8Array(G.W * G.H), relief = { out: new Float32Array(G.W * G.H), light: groundLight(world, ground, { sun, strength: ATMOSPHERE.defaults.relief }, !G.identity) };
    if (G.identity) { time('drawFloor 1x', i => drawFloor(world, cams[i % 40], 1, fb)); time('drawFloor 1x + relief', i => drawFloor(world, cams[i % 40], 1, fb, { relief })); } // @math forty cameras
    time(`caster ${label}`, i => castFloor(world, cams[i % 40], 1, fb, G)); // @math forty cameras
    time(`caster ${label} + relief`, i => castFloor(world, cams[i % 40], 1, fb, G, { relief })); // @math forty cameras
  }
  const random = createRandom(5);
  for (const [label, G] of [['2x', G2], [`2x wide (m ${m})`, GW]]) { // a cast layer of shadow patches over the lower half, blurred by the running sum and by blurCast's sums at SUN.blur x s
    const L = createLayers(G.W * G.H), patches = Float32Array.from({ length: G.W * G.H }, (_, i) => (i > G.W * G.H / 2 && random() < 0.2 ? 1 : 0)), box = { x0: 0, x1: G.W - 1, y0: G.H >> 1, y1: G.H - 1 }; // @math a fifth of the lower half's pixels
    time(`sun blur ${label}, running sum`, () => { L.cast.set(patches); boxBlurCast(L, box, G.W, G.H, L.scratch, SUN.blur * G.s); });
    time(`sun blur ${label}, summed (blurCast)`, () => { L.cast.set(patches); blurCast(L, box, G.W, G.H, L.scratch, SUN.blur * G.s); });
  }
}

// ---- the decision: the 2x rows against the 1x row of the same run, scaled to the quiet machine of the budget (the 1x Enhanced draw the
// budget was set against, HD.quiet); beside it, the same rows scaled by the reference renderer's slowdown in this run (its quiet mean, 0.96 ms,
// is in docs/enhancements.md), which also counts what Stage 3's relief added to the 1x draw since the budget was set
const row = label => result.find(r => r.label === label), one = row('Enhanced 1x'), ref = row('reference renderer'), REF_QUIET = 0.96; // @math the reference renderer's documented quiet mean (ms)
const slow = ref.mean / REF_QUIET;
for (const [look, suffix] of [['reference', ''], ['full', ' full']]) {
  const two = row(`Enhanced 2x${suffix}`), twoSunset = row(`Enhanced 2x sunset${suffix}`);
  const quietMean = (two.mean / one.mean) * HD.quiet.meanMs, quietP95 = (two.p95 / one.p95) * HD.quiet.p95Ms, quietSunset = (twoSunset.mean / one.mean) * HD.quiet.meanMs;
  const holds = quietMean <= HD.budget.meanMs && quietP95 <= HD.budget.p95Ms && quietSunset <= HD.budget.sunsetMs;
  console.log(`look '${look}': 2x / 1x is ${(two.mean / one.mean).toFixed(2)} (mean) and ${(two.p95 / one.p95).toFixed(2)} (95th percentile); scaled to the 1x draw the budget was set against (${HD.quiet.meanMs} / ${HD.quiet.p95Ms} ms), 2x takes about ${quietMean.toFixed(1)} ms mean and ${quietP95.toFixed(1)} ms 95th percentile (budget ${HD.budget.meanMs} / ${HD.budget.p95Ms}), ${quietSunset.toFixed(1)} ms with a sunset (budget ${HD.budget.sunsetMs}); scaled by this run's reference renderer (${slow.toFixed(2)} times its quiet ${REF_QUIET} ms) ${(two.mean / slow).toFixed(1)} ms mean, ${(two.p95 / slow).toFixed(1)} ms 95th percentile, ${(twoSunset.mean / slow).toFixed(1)} ms with a sunset: ${holds ? 'within the budget' : 'over the budget'}`);
}
console.log(`the look the race draws with: '${HD.look}' (config.js HD.look)`);
console.log(`spike-2x: ${problems} problems`);
process.exitCode = problems ? 1 : 0;
