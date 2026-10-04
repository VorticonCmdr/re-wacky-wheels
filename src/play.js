// The playtest page: the proven floor renderer and straight-road car step of src/render and src/game, with the hypotheses of
// src/formats/hypotheses plugged in where the evidence stops (they are named on the page). Everything is decoded in the browser
// from the player's own WACKY.DAT; nothing is uploaded or stored.
import { openDevGame } from './vfs/dev.js';
import { openPicked } from './vfs/picker.js';
import { withSteps } from './evidence/k.js';
import { loadTrack, rgbaPalette, archiveMembers } from './game/track-data.js';
import { createCar, stepCar, cameraOf } from './game/car.js';
import { renderFloor } from './render/floor.js';
import { renderSky, renderHorizon } from './render/sky.js';
import { turnMoveHypothesis, startHeadingHypothesis, horizonOffsetHypothesis } from './formats/hypotheses/turn-and-start.js';

const $ = id => document.getElementById(id);
const TICK_MS = 100; // UNKNOWN_TICK_RATE: the HUD reads a tick as a tenth of a second; 88.5 ms was measured in DOSBox
const state = { dat: null, world: null, car: null, camera: null, keys: new Set(), tick: 0, last: 0, accumulator: 0, unproven: new Set(), steps: [] };
const screen = $('screen'), ctx = screen.getContext('2d'), image = ctx.createImageData(screen.width, screen.height), index = new Uint8Array(screen.width * screen.height);
let rgba = null;

function setMessage(text, bad = false) { const m = $('message'); m.textContent = text; m.style.color = bad ? 'var(--bad)' : ''; m.hidden = !text; }

function startTrack() {
  const name = $('track').value, engine = Number($('engine').value);
  state.world = loadTrack(state.dat, name, engine);
  const heading = startHeadingHypothesis(state.world);
  state.car = createCar({ ...state.world.start, heading });
  state.tick = 0; state.accumulator = 0; state.unproven = new Set();
  rgba = rgbaPalette(state.world.palette);
}

function tickOnce() {
  const input = { accelerate: state.keys.has('ArrowUp') || state.keys.has('KeyA'), brake: state.keys.has('ArrowDown') || state.keys.has('KeyZ'), left: state.keys.has('ArrowLeft'), right: state.keys.has('ArrowRight'), spin: state.keys.has('Space') };
  const { result, steps } = withSteps(() => stepCar(state.car, input, state.world, { turnMove: turnMoveHypothesis }));
  state.car = result.car; state.tick++; state.steps = steps;
  for (const u of result.unproven) state.unproven.add(u);
}

function draw() {
  const mode = Number($('detail').value), camera = cameraOf(state.car, state.world);
  index.fill(0);
  renderSky(state.world.sky, index);
  renderHorizon(state.world.par, horizonOffsetHypothesis(), index);
  renderFloor(state.world, camera, mode, index);
  for (let i = 0; i < index.length; i++) { const p = index[i] * 4; image.data[i * 4] = rgba[p]; image.data[i * 4 + 1] = rgba[p + 1]; image.data[i * 4 + 2] = rgba[p + 2]; image.data[i * 4 + 3] = 255; } // @math RGBA
  ctx.putImageData(image, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, screen.width, 24);
  ctx.fillStyle = '#f2b134'; ctx.font = '10px monospace'; ctx.fillText('HUD, sprites and sound are not ported yet', 6, 15);
  const c = state.car, row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('readout').innerHTML = row('Tick', state.tick) + row('Throttle', c.throttle) + row('Speed', c.speed) + row('Position', `${c.x}, ${c.y}`) + row('Heading', c.heading);
  const hyp = ['UNKNOWN_START_HEADING', 'UNKNOWN_CAR_TURN_MOVE', 'UNKNOWN_TICK_RATE', 'UNKNOWN_HORIZON_SCROLL'];
  $('badge').className = 'badge bad';
  $('badge').textContent = `Not proven yet and approximated here: ${hyp.join(', ')}${state.unproven.size ? `; this run also used: ${[...state.unproven].join(', ')}` : ''}.`;
}

function frame(now) {
  if (!state.dat) return;
  state.accumulator += Math.min(now - state.last, 250); state.last = now; // @math at most a quarter second at a time after a pause
  while (state.accumulator >= TICK_MS) { tickOnce(); state.accumulator -= TICK_MS; }
  draw(); requestAnimationFrame(frame);
}

async function load(vfs) {
  try {
    const path = vfs.list().find(p => /(^|\/)wacky\.dat$/i.test(p));
    if (!path) throw new Error('WACKY.DAT was not found in the selected files.');
    state.dat = await vfs.openPath(path);
    const names = [...archiveMembers(state.dat).keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => n.replace('.GAM', '')).sort((a, b) => a - b);
    $('track').innerHTML = names.map(n => `<option>${n}</option>`).join('');
    startTrack(); $('stage').hidden = false; setMessage('');
    state.last = performance.now(); requestAnimationFrame(frame);
  } catch (e) { state.dat = null; setMessage(`${e.message}`, true); }
}

$('open').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => { if (e.target.files.length) load(openPicked(e.target.files)); });
$('local').addEventListener('click', async () => { try { await load(await openDevGame({ base: import.meta.env.BASE_URL })); } catch (e) { setMessage(e.message, true); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) load(openPicked(e.dataTransfer.files)); });
for (const id of ['track', 'engine']) $(id).addEventListener('change', () => state.dat && startTrack());
$('reset').addEventListener('click', () => state.dat && startTrack());
addEventListener('keydown', e => { if (e.target.tagName === 'SELECT') return; if (e.code === 'KeyR') { if (state.dat) startTrack(); return; } if (/^(Arrow|Key[AZ]|Space)/.test(e.code)) { state.keys.add(e.code); e.preventDefault(); } });
addEventListener('keyup', e => state.keys.delete(e.code));
