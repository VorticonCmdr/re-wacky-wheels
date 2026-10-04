// The playtest page: the proven renderers and car step of src/render and src/game. Everything is decoded in the browser
// from the player's own WACKY.DAT; nothing is uploaded or stored.
import { openDevGame } from './vfs/dev.js';
import { openPicked } from './vfs/picker.js';
import { withSteps } from './evidence/k.js';
import { loadTrack, rgbaPalette, archiveMembers } from './game/track-data.js';
import { createCar, stepCar } from './game/car.js';
import { renderFloor } from './render/floor.js';
import { frameMs } from './game/clock.js';
import { renderSky, renderHorizon } from './render/sky.js';
import { drawList } from './render/draw-list.js';
import { viewSetup } from './game/view.js';
import { objectRecords, objectFrame } from './game/objects.js';
import { playerRecord } from './game/player-car.js';
import { renderMenu, loadMenuArt, menuItems } from './render/menu.js';
import { createMenu, stepFrame, viewOf, menuPeriod } from './game/menu.js';

const $ = id => document.getElementById(id);
const TICK_MS = 100; // UNKNOWN_TICK_RATE: the HUD reads a tick as a tenth of a second; 88.5 ms was measured in DOSBox
const state = { running: false, screen: 'menu', menu: createMenu(), menuKey: null, menuAccumulator: 0, menuArt: null, dat: null, world: null, car: null, camera: null, keys: new Set(), tick: 0, last: 0, accumulator: 0, unproven: new Set(), steps: [] };
const screen = $('screen'), ctx = screen.getContext('2d'), image = ctx.createImageData(screen.width, screen.height), index = new Uint8Array(screen.width * screen.height);
let rgba = null;

function setMessage(text, bad = false) { const m = $('message'); m.textContent = text; m.style.color = bad ? 'var(--bad)' : ''; m.hidden = !text; }

function startTrack() {
  const name = $('track').value, engine = Number($('engine').value);
  state.world = loadTrack(state.dat, name, engine);
  state.car = createCar(state.world.start, state.world);
  state.tick = 0; state.accumulator = 0; state.unproven = new Set();
  rgba = rgbaPalette(state.world.palette);
}

function tickOnce() {
  const input = { accelerate: state.keys.has('ArrowUp') || state.keys.has('KeyA'), brake: state.keys.has('ArrowDown') || state.keys.has('KeyZ'), left: state.keys.has('ArrowLeft'), right: state.keys.has('ArrowRight'), spin: state.keys.has('Space') };
  const { result, steps } = withSteps(() => stepCar(state.car, input, state.world));
  state.car = result.car; state.tick++; state.steps = steps;
  for (const u of result.unproven) state.unproven.add(u);
}

function blit(palette) {
  for (let i = 0; i < index.length; i++) { const p = index[i] * 4; image.data[i * 4] = palette[p]; image.data[i * 4 + 1] = palette[p + 1]; image.data[i * 4 + 2] = palette[p + 2]; image.data[i * 4 + 3] = 255; } // @math RGBA
  ctx.putImageData(image, 0, 0);
}

// The main menu: the picture, the nine items, the selection icons and the two corner cars, all as the game draws them (menu.screen-model).
function drawMenu() {
  const art = state.menuArt;
  renderMenu(index, art, viewOf(state.menu)); blit(art.rgba);
  $('readout').innerHTML = `<dt>Selected</dt><dd>${menuItems()[state.menu.cursor - 1].trim()}</dd>`;
  $('badge').className = 'badge bad';
  $('badge').textContent = 'Not observed yet and approximated here: the state the menu animations start in, whether a held key repeats, and Esc while the icons animate. Only SINGLE PLAYER RACING leads anywhere (straight into the race).';
}

// One step of the menu per 8 counts of the 136 Hz clock, with the first key pressed since the last step.
function stepMenuClock(now) {
  state.menuAccumulator += Math.min(now - state.last, 250); // @math at most a quarter second at a time after a pause
  const ms = frameMs(menuPeriod());
  while (state.menuAccumulator >= ms) {
    const { menu, chosen } = stepFrame(state.menu, state.menuKey); state.menu = menu; state.menuKey = null; state.menuAccumulator -= ms;
    if (chosen) { chooseItem(chosen); if (state.screen !== 'menu') return; }
  }
}

function chooseItem(item) {
  if (item === 1) { state.screen = 'race'; startTrack(); setMessage(''); return; } // @math the first item of the menu, SINGLE PLAYER RACING
  setMessage(`${menuItems()[item - 1].trim()} is not ported yet.`);
}

function draw() {
  const mode = Number($('detail').value), camera = { x: state.car.cx, y: state.car.cy, heading: state.car.heading };
  index.fill(0);
  renderSky(state.world.sky, index);
  renderHorizon(state.world.par, state.car.horizon, index);
  renderFloor(state.world, camera, mode, index);
  const objects = state.world.objects.map(o => ({ ...o, frame: objectFrame(state.world, o.id, state.tick) })), view = viewSetup(state.world, camera);
  drawList(index, [...objectRecords(state.world, view, camera, objects), playerRecord(state.world, state.car)]);
  blit(rgba);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, screen.width, 24);
  ctx.fillStyle = '#f2b134'; ctx.font = '10px monospace'; ctx.fillText('HUD, AI cars, items and sound are not ported yet', 6, 15);
  const c = state.car, row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('readout').innerHTML = row('Tick', state.tick) + row('Throttle', c.throttle) + row('Speed', c.speed) + row('Camera', `${c.cx}, ${c.cy}`) + row('Heading', c.heading);
  $('badge').className = state.unproven.size ? 'badge bad' : 'badge';
  $('badge').textContent = state.unproven.size ? `Not proven yet and approximated here: ${[...state.unproven].join(', ')}.` : 'Every rule used so far is proven (the sky, the horizon, the floor, the straight road, the objects and the player car); the HUD, laps, the AI cars, pickups and sound are not ported yet.';
}

function frame(now) {
  if (!state.dat) return;
  if (state.screen === 'menu') { stepMenuClock(now); state.last = now; if (state.screen === 'menu') drawMenu(); requestAnimationFrame(frame); return; }
  state.accumulator += Math.min(now - state.last, 250); state.last = now; // @math at most a quarter second at a time after a pause
  const frame_ms = frameMs();
  while (state.accumulator >= frame_ms) { tickOnce(); state.accumulator -= frame_ms; }
  draw(); requestAnimationFrame(frame);
}

async function load(vfs) {
  try {
    const path = vfs.list().find(p => /(^|\/)wacky\.dat$/i.test(p));
    if (!path) throw new Error('WACKY.DAT was not found in the selected files.');
    state.dat = await vfs.openPath(path);
    const names = [...archiveMembers(state.dat).keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => n.replace('.GAM', '')).sort((a, b) => a - b);
    $('track').innerHTML = names.map(n => `<option>${n}</option>`).join('');
    state.menuArt = loadMenuArt(archiveMembers(state.dat)); state.menuArt.rgba = rgbaPalette(state.menuArt.title.vga);
    state.screen = 'menu'; state.menu = createMenu(); state.menuKey = null; state.menuAccumulator = 0;
    startTrack(); $('stage').hidden = false; setMessage('');
    state.last = performance.now(); if (!state.running) { state.running = true; requestAnimationFrame(frame); }
  } catch (e) { state.dat = null; setMessage(`${e.message}`, true); }
}

$('open').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => { if (e.target.files.length) load(openPicked(e.target.files)); });
$('local').addEventListener('click', async () => { try { await load(await openDevGame({ base: import.meta.env.BASE_URL })); } catch (e) { setMessage(e.message, true); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) load(openPicked(e.dataTransfer.files)); });
for (const id of ['track', 'engine']) $(id).addEventListener('change', () => state.dat && startTrack());
$('reset').addEventListener('click', () => state.dat && startTrack());
const MENU_KEYS = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', Space: 'enter', Escape: 'escape' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || !state.dat) return;
  if (state.screen === 'race' && e.code === 'Escape') { state.screen = 'menu'; state.keys.clear(); state.menuAccumulator = 0; state.last = performance.now(); setMessage(''); return; }
  if (state.screen === 'menu' && MENU_KEYS[e.code]) {
    e.preventDefault(); if (!state.menuKey) state.menuKey = MENU_KEYS[e.code]; return;
  }
  if (state.screen !== 'race') return;
  if (e.code === 'KeyR') { startTrack(); return; } if (/^(Arrow|Key[AZ]|Space)/.test(e.code)) { state.keys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', e => state.keys.delete(e.code));
