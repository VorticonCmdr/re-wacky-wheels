import { parseDat, parseAudioT } from './archive.js';
import { extension, ascii, hexDump, view } from './binary.js';
import { decodePcx, toRgba, grayscalePalette } from './pcx.js';
import { openDevGame } from './vfs/dev.js';
import { openPicked } from './vfs/picker.js';
import { vgaQuantize } from './formats/pcx.js';
import { parseAtr, rawFrame, spriteLayout } from './sprites.js';
import { spriteSheet, spriteSheetLayout } from './sprite-sheet.js';
import { parseGam, parseRoute, parseSpawns, composeTrack } from './tracks.js';
import { decodeVoc, decodePcSpeaker, encodeWav } from './audio.js';
import { numericValues, inspectData, b800Cells } from './data-formats.js';
import { createRacePreview, anchorStage } from './viewer-preview.js';
import { driverFile, driverCount } from './game/drivers.js';
import { normalize, applyPreset, change, loadSettings, saveSettings, enhancedOn } from './enhance/settings.js';
import { EFFECTS, LEVELS, PRESETS, RENDER } from './enhance/config.js';
import { loadAtmospheres } from './enhance/atmosphere.js';
import { loadDisplay } from './enhance/display-settings.js';
import { loadReliefMaps, saveReliefMap, removeReliefMap, createReliefProvider } from './enhance/relief-store.js';
import { tileSheetHeights, tilesToSheet, sheetToTiles, pictureHeights, shadeByHeights } from './enhance/relief.js';
import { RELIEF } from './enhance/config.js';
import { loadTrack } from './game/track-data.js';

const $ = id => document.getElementById(id);
const categories = ['All assets', 'Graphics', 'Sprites', 'Tracks', 'Music', 'Sounds', 'Data', 'Archives'];
const state = { trackView: 'map', anchorView: false, gfx: null, gamePalette: false, entries: [], byName: new Map(), images: new Map(), category: 'All assets', selected: null, catalog: [], filter: '', worker: null, raf: 0, urls: [], renderId: 0, loadId: 0, canvas: null };
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function category(e) {
  const ext = extension(e.name);
  if (['pcx', 'par', 'bin'].includes(ext)) return 'Graphics';
  if (ext === 'sp') return 'Sprites';
  if (['gam', 'm', 'rd', 'spw', 'pos'].includes(ext)) return 'Tracks';
  if (['mid', 'klm'].includes(ext)) return 'Music';
  if (['voc', 'pcs', 'adl'].includes(ext)) return 'Sounds';
  if (e.name === 'wacky.dat' || e.name === 'audiot.fx') return 'Archives';
  return 'Data';
}
const icons = { Graphics: '▧', Sprites: '◆', Tracks: '⚑', Music: '♫', Sounds: '♪', Data: '≡', Archives: '▣' };
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function formatSize(size) { return size >= 1048576 ? (size / 1048576).toFixed(2) + ' MB' : size >= 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B'; }
function get(name) { return state.byName.get(name.toLowerCase()); }
function image(name) {
  if (!state.images.has(name)) { const entry = get(name); if (!entry) throw new Error(`Related image ${name} is missing. Open the complete WACKY.DAT.`); state.images.set(name, decodePcx(entry.data)); }
  return state.images.get(name);
}
function cleanup() {
  state.renderId++; cancelAnimationFrame(state.raf); state.raf = 0;
  state.worker?.terminate(); state.worker = null;
  document.querySelectorAll('audio').forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
  state.urls.forEach(u => URL.revokeObjectURL(u)); state.urls = [];
  state.canvas = null; $('export-png').hidden = true;
  $('export-sheet').hidden = true; $('export-sheet').onclick = null;
}
function download(data, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type })), a = el('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function table(columns, rows, container = $('details')) {
  const wrap = el('div', undefined, 'table-wrap'), t = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
  columns.forEach(c => tr.append(el('th', c))); head.append(tr); t.append(head, body); wrap.append(t); container.append(wrap);
  let shown = 0; const more = el('button', 'Show more rows', 'more-rows');
  function append() {
    for (let i = shown; i < Math.min(shown + 100, rows.length); i++) { const row = el('tr'); rows[i].forEach(v => row.append(el('td', String(v)))); body.append(row); }
    shown = Math.min(shown + 100, rows.length); more.textContent = `Show more · ${shown.toLocaleString()} / ${rows.length.toLocaleString()} rows`; more.hidden = shown === rows.length;
  }
  more.onclick = append; container.append(more); append();
}
function field(label, control) { const wrapper = el('label', undefined, 'control'); wrapper.append(el('span', label), control); $('controls').append(wrapper); return control; }
function selectControl(label, options, value, change) {
  const s = el('select'); options.forEach(([v, text]) => { const opt = el('option', text); opt.value = v; s.append(opt); }); s.value = String(value); s.onchange = () => change(s.value); return field(label, s);
}
function numberControl(label, value, min, max, change) {
  const input = el('input'); input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = 1;
  input.onchange = () => { const n = Math.trunc(Number(input.value)); if (!Number.isFinite(n) || n < min || n > max) { input.value = value; return; } try { change(n); } catch (e) { status(e.message, true); } }; return field(label, input);
}
function checkControl(label, checked, change) {
  const input = el('input'); input.type = 'checkbox'; input.checked = checked; input.onchange = () => change(input.checked); return field(label, input);
}
function controls() { $('controls').hidden = false; }
function canvas(width, height) {
  const c = el('canvas'); c.width = width; c.height = height; c.setAttribute('aria-label', 'Asset image preview');
  const wrap = el('div', undefined, 'canvas-wrap'); wrap.append(c); $('preview').replaceChildren(wrap); state.canvas = c; $('export-png').hidden = false; return c;
}
// The game keeps only the top 6 bits of each palette byte (pcx.palette-scale). Showing them as 8-bit
// uses the usual VGA expansion (v << 2 | v >> 4), a display convention: what the DAC then shows is not proven.
function displayPalette(p) { return state.gamePalette ? Uint8Array.from(vgaQuantize(p), v => (v << 2) | (v >> 4)) : p; }
function paint(c, img, palette, transparent = -1) {
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(new ImageData(img.rgba ?? toRgba(img.indices, displayPalette(palette ?? img.palette), transparent), img.width, img.height), 0, 0);
}
function gamePaletteControl(redraw) { return checkControl('Game palette (6-bit VGA)', state.gamePalette, v => { state.gamePalette = v; redraw(); }); }
function zoomControl(c, initial = 'fit') {
  function set(z) { c.style.width = z === 'fit' ? '' : c.width * Number(z) + 'px'; c.style.maxWidth = z === 'fit' ? '100%' : 'none'; c.classList.toggle('fit', z === 'fit'); }
  selectControl('Zoom', [['fit', 'Fit'], [1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], initial, set); set(initial);
}
function paletteChoices(own = false) {
  return [...(own ? [['own', 'Image palette']] : []), ...state.entries.filter(e => extension(e.name) === 'pcx').map(e => [e.name, e.name]), ['gray', 'Grayscale']];
}
function palette(key, own) { return key === 'own' ? own : key === 'gray' ? grayscalePalette() : image(key).palette; }
function defaultPalette() { return get('a_f1.pcx') ? 'a_f1.pcx' : state.entries.find(e => extension(e.name) === 'pcx')?.name ?? 'gray'; }
function detail(text) { $('details').append(el('p', text, 'muted')); }

// ---- The relief maps (docs/enhancements.md, the relief): the player's own height maps of the tile sheets and sprite sheets, kept in this
// browser; the race views here and the playtest page light the ground and the pictures by them, else by maps made from the pictures.
const relief = { records: [], provider: createReliefProvider(() => get('wacky.dat')?.data ?? null) };
const reloadRelief = async () => { relief.records = await loadReliefMaps(); relief.provider.set(relief.records); };
reloadRelief();
const reliefOf = member => relief.records.find(r => r.member === member.toUpperCase()) ?? null;
// A grey picture (0 to 255 a pixel) as a PNG download, and a PNG the player picked as grey values of the expected size.
function downloadGrey(grey, width, height, name) {
  const c = el('canvas'); c.width = width; c.height = height;
  const rgba = new Uint8ClampedArray(width * height * 4); // @math four bytes a colour
  for (let i = 0; i < grey.length; i++) rgba.set([grey[i], grey[i], grey[i], 255], i * 4); // @math opaque grey
  c.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
  c.toBlob(blob => { if (blob) download(blob, name, 'image/png'); else status('Could not encode the height map.', true); }, 'image/png');
}
function pickGrey(width, height, done) {
  const input = el('input'); input.type = 'file'; input.accept = 'image/png,image/*';
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width !== width || bitmap.height !== height) throw new Error(`The height map is ${bitmap.width} × ${bitmap.height} pixels; this one needs ${width} × ${height}, as the exported map has.`);
      const c = el('canvas'); c.width = width; c.height = height; const g = c.getContext('2d'); g.drawImage(bitmap, 0, 0);
      const data = g.getImageData(0, 0, width, height).data, grey = new Uint8Array(width * height);
      for (let i = 0; i < grey.length; i++) grey[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]); // @math the Rec. 601 luma weights; four bytes a colour
      await done(grey);
    } catch (error) { status(error.message, true); }
  };
  input.click();
}
// The relief controls of a picture: `exportGrey()` the map shown (the player's or the generated one) as a grey picture with its size,
// `importGrey(grey)` the record to keep from a picked one (it throws when the view's layout is not one the race draws), `redraw()` the view,
// `applies(record)` whether the player's map is the one shown (else `other(record)` says what it was made for); `what` names the map in the
// messages. Returns { show }, which the view calls when its layout changes.
function reliefControls(member, { exportGrey, importGrey, redraw, what, applies = () => true, other = () => '' }) {
  const own = el('span', undefined, 'frame-label');
  const show = () => { const r = reliefOf(member); own.textContent = !r ? 'generated from the pictures' : applies(r) ? `your map, imported ${new Date(r.saved).toLocaleString()}` : `your map is for ${other(r)}; this layout shows the generated one`; remove.disabled = !r; };
  const exp = el('button', 'Export height map'), imp = el('button', 'Import height map'), remove = el('button', 'Remove imported map');
  exp.onclick = () => { const g = exportGrey(); downloadGrey(g.grey, g.width, g.height, `${member.toLowerCase().replace(/\.[^.]+$/, '')}-relief.png`); status(`Exported the ${what}'s height map: paint it lighter for higher, darker for lower, and import it again.`); };
  imp.onclick = () => { try { const g = exportGrey(); importGrey(null); pickGrey(g.width, g.height, async grey => { if (await saveReliefMap({ ...importGrey(grey), member, saved: Date.now() })) { await reloadRelief(); show(); redraw(); status(`Imported: the race views and the playtest page light the ${what} by your map (Track lighting on).`); } else status('This browser did not keep the height map.', true); }); } catch (error) { status(error.message, true); } };
  remove.onclick = async () => { if (await removeReliefMap(member)) { await reloadRelief(); show(); redraw(); status(`Removed: the ${what} is lit by the generated map again.`); } };
  exp.onclick = (() => { const save = exp.onclick; return () => { try { save(); } catch (error) { status(error.message, true); } }; })();
  field('Relief map', own); $('controls').append(exp, imp, remove); show();
  return { show };
}
// The first track that draws with a tile sheet, and which of its two sheets it is ({ stem, sheet }), or null.
function tileSheetUse(name) {
  for (const e of state.entries) {
    if (extension(e.name) !== 'gam') continue;
    try { const at = parseGam(e.data).tiles.indexOf(name.toLowerCase()); if (at >= 0) return { stem: e.name.split('.')[0], sheet: at }; } catch { /* not a track's */ }
  }
  return null;
}

function previewPcx(entry) {
  const img = decodePcx(entry.data), c = canvas(img.width, img.height), use = get('wacky.dat') ? tileSheetUse(entry.name) : null; let key = 'own', lit = false, generated = null;
  const sheetHeights = () => { // the map of a tile sheet as its picture: the player's, else the one the race makes for the first track that uses it
    const r = reliefOf(entry.name);
    if (r) return tilesToSheet(r.heights, img.width, img.height);
    generated ??= tilesToSheet(tileSheetHeights(loadTrack(get('wacky.dat').data, use.stem), use.sheet), img.width, img.height);
    return generated;
  };
  const draw = () => { paint(c, img, palette(key, img.palette)); if (lit && use) { const g = c.getContext('2d'), d = g.getImageData(0, 0, img.width, img.height); g.putImageData(new ImageData(shadeByHeights(d.data, sheetHeights(), img.width, img.height, RELIEF.depth), img.width, img.height), 0, 0); } };
  draw(); controls(); zoomControl(c);
  if (use) { // a tile sheet of the tracks: its relief map
    checkControl('Relief preview', lit, v => { lit = v; draw(); });
    reliefControls(entry.name, { what: 'tile sheet', redraw: draw, exportGrey: () => ({ grey: sheetHeights(), width: img.width, height: img.height }), importGrey: grey => (grey ? { kind: 'tiles', heights: sheetToTiles(grey, img.width) } : null) });
    detail(`Relief: the track lighting shows the ground's slopes by a height map of this sheet, lit by the track's sun. Without one of yours it is made from the sheet (each texel's brightness, the walls raised; track ${use.stem}'s walls and water). Export it, paint it in any editor (lighter is higher; keep the size and the tiles' places), and import it.`);
  }
  if (!img.rgba) {
    selectControl('Palette', paletteChoices(true), key, v => { key = v; draw(); });
    gamePaletteControl(draw);
    const swatches = el('div', undefined, 'palette-grid');
    for (let i = 0; i < 256; i++) { const s = el('span'); s.style.background = `rgb(${img.palette.slice(i * 3, i * 3 + 3).join(',')})`; s.title = `Index ${i}`; swatches.append(s); }
    $('details').append(swatches);
  }
  detail(`${img.width} × ${img.height} pixels · ${img.bits} bits/plane · ${img.planes} plane(s). Palette indices are preserved.`);
}
function previewRaw(entry) {
  const horizon = extension(entry.name) === 'par', layout = horizon ? { width: 1280, height: 20, frames: 1, certainty: 'Observed in the running game: a 1280 × 20 panorama of which the game shows a 320-pixel window (horizon.render-observed)' } : spriteLayout(entry.name, entry.data, state.catalog);
  let w = layout.width, h = layout.height, frame = 0, offset = 0, column = !horizon, key = defaultPalette(), transparent = !horizon, animate = false, last = 0, sunAngle = (state.gfx ?? loadSettings()).sunAngle;
  const tables = get('trig.dat') && get('view') ? { trig: get('trig.dat').data, view: get('view').data } : null;
  let rule = ['cars.sp', ...Array.from({ length: driverCount() }, (_, slot) => driverFile(slot).toLowerCase())].includes(entry.name) ? 'racer' : 'scenery'; // the race sizes a car's contact shadow by its picture, scenery by its footprint
  const c = canvas(w, h); controls();
  const frameSlider = el('input'); frameSlider.type = 'range'; frameSlider.min = 0; frameSlider.step = 1;
  const frameLabel = el('span', undefined, 'frame-label');
  let sheetColumns = 0;
  const sheetInfo = el('span', undefined, 'frame-label');
  function updateSheetInfo() {
    if (horizon) return;
    try {
      const sheet = spriteSheetLayout(entry.data.length, w, h, offset, sheetColumns);
      sheetInfo.textContent = `${sheet.frames} frames · ${sheet.columns} columns × ${sheet.rows} rows · ${sheet.width} × ${sheet.height} px${sheet.partialFrame ? ' · last frame padded (current layout)' : ''}`;
      $('export-sheet').disabled = false;
    } catch (error) { sheetInfo.textContent = error.message; $('export-sheet').disabled = true; }
  }
  function count() { return Math.max(1, Math.ceil((entry.data.length - offset) / (w * h))); }
  let lit = false, reliefView = null;
  const luma = () => { const p = displayPalette(palette(key)); return Float32Array.from({ length: 256 }, (_, i) => (0.299 * p[i * 3] + 0.587 * p[i * 3 + 1] + 0.114 * p[i * 3 + 2]) / 255); }; // @math 256 colours; the Rec. 601 luma weights; three components; 8 bits
  const full = () => Math.max(Math.floor((entry.data.length - offset) / (w * h)), 0); // the whole frames, the ones the race draws
  const fits = r => r.width === w && r.height === h && r.offset === offset && r.columnMajor === column; // the player's map was made for this layout
  const frameHeights = f => { // a frame's heights in its picture's rows (the player's map when it was made for this layout, else the generated one)
    const r = reliefOf(entry.name), size = w * h, own = r && fits(r) && f < r.frames;
    const bytes = own ? r.heights.subarray(f * size, (f + 1) * size) : pictureHeights(entry.data, { width: w, height: h, offset: offset + f * size, frames: 1, columnMajor: column }, luma());
    const rows = new Uint8Array(size); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y * w + x] = bytes[column ? x * h + y : y * w + x];
    return rows;
  };
  function draw() {
    frame = Math.min(frame, count() - 1); frameSlider.max = count() - 1; frameSlider.value = frame;
    if (state.anchorView && !horizon && tables) drawAnchor(c, rawFrame(entry.data, w, h, frame, offset, column), w, h, displayPalette(palette(key)), sunAngle, rule);
    else paint(c, rawFrame(entry.data, w, h, frame, offset, column), palette(key), transparent ? 0 : -1);
    if (lit && !horizon && !state.anchorView && frame < full()) { const g = c.getContext('2d'), d = g.getImageData(0, 0, w, h); g.putImageData(new ImageData(shadeByHeights(d.data, frameHeights(frame), w, h, RELIEF.spriteDepth), w, h), 0, 0); }
    reliefView?.show();
    frameLabel.textContent = `${frame + 1} / ${count()} frames`;
    updateSheetInfo();
    if (zoom.value !== 'fit') c.style.width = c.width * Number(zoom.value) + 'px';
  }
  const zoom = selectControl('Zoom', [['fit', 'Fit'], [1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], horizon ? 1 : 8, v => { c.style.width = v === 'fit' ? '' : c.width * Number(v) + 'px'; c.style.maxWidth = v === 'fit' ? '100%' : 'none'; });
  c.style.width = w * Number(zoom.value) + 'px'; c.style.maxWidth = 'none';
  numberControl('Width', w, 1, 2048, n => { w = n; frame = 0; draw(); });
  numberControl('Height', h, 1, 2048, n => { h = n; frame = 0; draw(); });
  numberControl('Byte offset', offset, 0, Math.max(0, entry.size - 1), n => { offset = n; frame = 0; draw(); });
  selectControl('Palette', paletteChoices(), key, v => { key = v; draw(); });
  gamePaletteControl(draw);
  checkControl('Column-major', column, v => { column = v; draw(); }); checkControl('Transparent index 0', transparent, v => { transparent = v; draw(); });
  field('Frame', frameSlider); $('controls').append(frameLabel); frameSlider.oninput = () => { frame = Number(frameSlider.value); draw(); };
  checkControl('Animate · 8 fps', false, v => { animate = v; });
  if (!horizon && tables) { // the enhancement preview of the sprite's ground anchor and shadows
    checkControl('Ground anchor and shadows', state.anchorView, v => { state.anchorView = v; draw(); });
    rangeControl('Sun direction', sunAngle, v => { sunAngle = v; draw(); });
    selectControl('Contact shadow', [['racer', 'Racer rule · picture width'], ['scenery', 'Scenery rule · footprint']], rule, v => { rule = v; draw(); });
  }
  if (!horizon) {
    selectControl('Sprite sheet columns', [[0, 'Auto'], [1, '1 · vertical strip'], [4, '4'], [8, '8'], [16, '16']], 0, value => { sheetColumns = Number(value); updateSheetInfo(); });
    field('Sprite sheet', sheetInfo);
    $('export-sheet').hidden = false;
    $('export-sheet').onclick = () => {
      const token = state.renderId, name = entry.name.replace(/\.sp$/i, '') + '-sheet.png';
      try {
        const sheet = spriteSheet(entry.data, w, h, displayPalette(palette(key)), { offset, columns: sheetColumns, columnMajor: column, transparent: transparent ? 0 : -1 });
        const output = el('canvas'); output.width = sheet.width; output.height = sheet.height;
        const context = output.getContext('2d');
        if (!context) throw new Error('Could not allocate the sprite sheet canvas.');
        context.putImageData(new ImageData(sheet.rgba, sheet.width, sheet.height), 0, 0);
        output.toBlob(blob => {
          if (blob) { download(blob, name, 'image/png'); if (token === state.renderId) status(`Exported ${sheet.frames} frames to ${name}, left to right then top to bottom.`); }
          else if (token === state.renderId) status('Could not encode the sprite sheet PNG.', true);
        }, 'image/png');
      } catch (error) { status(error.message, true); }
    };
    detail('Sprite sheet export includes all frames from the current byte offset, in order from left to right then top to bottom. It uses the current dimensions, pixel order, palette and transparency; preview zoom does not scale the export.');
    checkControl('Relief preview', lit, v => { lit = v; draw(); });
    const sheetGrey = () => { // every whole frame's heights laid out as the sprite sheet export lays out its frames
      const L = spriteSheetLayout(entry.data.length, w, h, offset, sheetColumns), grey = new Uint8Array(L.width * L.height);
      for (let f = 0; f < full(); f++) { const rows = frameHeights(f), fx = (f % L.columns) * w, fy = Math.floor(f / L.columns) * h; for (let y = 0; y < h; y++) grey.set(rows.subarray(y * w, (y + 1) * w), (fy + y) * L.width + fx); }
      return { grey, width: L.width, height: L.height, columns: L.columns };
    };
    reliefView = reliefControls(entry.name, { what: 'sprite sheet', redraw: draw, exportGrey: sheetGrey, applies: fits, other: r => `${r.width} × ${r.height}, byte offset ${r.offset}${r.columnMajor ? ', column-major' : ''}`, importGrey: grey => {
      if (w !== layout.width || h !== layout.height || offset !== 0 || !column || !full()) throw new Error(`The race draws this sheet's frames as ${layout.width} × ${layout.height}, column-major, from byte 0: set that layout to import a height map for them.`);
      if (!grey) return null;
      const { width, columns } = sheetGrey(), frames = full(), size = w * h, heights = new Uint8Array(frames * size);
      for (let f = 0; f < frames; f++) { const fx = (f % columns) * w, fy = Math.floor(f / columns) * h; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) heights[f * size + (column ? x * h + y : y * w + x)] = grey[(fy + y) * width + fx + x]; }
      return { kind: 'sprites', width: w, height: h, offset, columnMajor: column, frames, heights };
    } });
    detail('Relief: with Track lighting on, the race lights the pictures by their slopes: a height map of yours made for these frames (the same width, height, byte offset and pixel order), else one made from the frame as it is drawn (a rounded body and its brightness). Export the map in the sprite sheet\'s layout, paint it (lighter is higher; keep the size), and import it.');
  }
  function tick(time) { if (animate && time - last >= 125) { frame = (frame + 1) % count(); draw(); last = time; } state.raf = requestAnimationFrame(tick); }
  draw(); state.raf = requestAnimationFrame(tick);
  detail(layout.certainty + '. Raw files have no embedded palette. Select the palette for the screen or track they belong to.');
  if (!horizon && !state.catalog.some(s => s.name === entry.name)) detail('For uncatalogued files, frame layout is inferred. Mixed-size sheets need manual width, height and byte-offset adjustments.');
}

// The sprite frame stood where the race draws the player's car on a plain ground, with its contact shadow and its sun shadow (viewer-preview.js),
// cut to the frame and its shadows; red marks the ground row, under the lowest opaque row, and cyan the footprint the contact shadow is sized by.
function drawAnchor(c, img, w, h, pal, sunAngle, rule) {
  const cm = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cm[x * h + y] = img.indices[y * w + x];
  const stage = anchorStage({ trig: get('trig.dat').data, view: get('view').data }, cm, w, h, pal, { sunAngle, rule });
  const margin = Math.max(w, h), x0 = Math.max(stage.left - margin, 0), y0 = Math.max(stage.top - margin, 0), x1 = Math.min(stage.left + w + margin, 320), y1 = Math.min(stage.row + margin, 200); // @math the screen
  const cw = x1 - x0, ch = y1 - y0, crop = new Uint8ClampedArray(cw * ch * 4); // @math four bytes a colour
  for (let y = 0; y < ch; y++) crop.set(stage.rgba.subarray(((y0 + y) * 320 + x0) * 4, ((y0 + y) * 320 + x1) * 4), y * cw * 4); // @math the screen's rows, four bytes a colour
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d'); ctx.putImageData(new ImageData(crop, cw, ch), 0, 0);
  const a = stage.anchor;
  if (!a) return;
  ctx.fillStyle = '#ff5a5a'; ctx.fillRect(0, stage.row - y0, cw, 1); // the ground row
  ctx.fillStyle = '#5ae0ff'; ctx.fillRect(stage.left + a.minX - x0, stage.top + a.low + 1 - y0, a.maxX - a.minX + 1, 1); // the footprint under the lowest opaque row
  ctx.globalAlpha = 0.2; ctx.fillRect(stage.left + a.minX - x0, stage.top + a.low + 1 - a.band - y0, a.maxX - a.minX + 1, a.band); ctx.globalAlpha = 1; // @math the band the footprint is read from
}

function previewTrack(entry) {
  const stem = entry.name.split('.')[0];
  controls(); selectControl('View', [['map', 'Track map'], ['race', 'Race view · Original and Enhanced']], state.trackView, v => { state.trackView = v; selectEntry(entry); });
  if (state.trackView === 'race') { previewRace(stem); return; }
  const map = get(stem + '.m'), gam = get(stem + '.gam');
  let base, config;
  if (map && gam) { config = parseGam(gam.data); base = composeTrack(map.data, image(config.tiles[0]), image(config.tiles[1])); }
  else {
    const indices = map?.data ?? new Uint8Array(4096); base = { width: 64, height: 64, indices, palette: grayscalePalette() };
    detail('Related GAM/M or tilesets are missing; showing the tile-index grid. Open the complete archive for the textured track.');
  }
  const c = canvas(base.width, base.height), scratch = document.createElement('canvas'); paint(scratch, base, base.palette);
  const route = get(stem + '.rd'), spawns = get(stem + '.spw');
  const segments = route ? parseRoute(route.data) : [], objects = spawns ? parseSpawns(spawns.data) : [];
  let showRoute = true, showObjects = true, grid = false;
  const scale = base.width / 2048;
  function draw() {
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(scratch, 0, 0);
    if (grid) { ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = scale; ctx.beginPath(); for (let i = 0; i <= 64; i++) { ctx.moveTo(i * base.width / 64, 0); ctx.lineTo(i * base.width / 64, base.height); ctx.moveTo(0, i * base.height / 64); ctx.lineTo(base.width, i * base.height / 64); } ctx.stroke(); }
    if (showRoute) { ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 5 * scale; ctx.beginPath(); segments.forEach(s => { ctx.moveTo(s.x1 * scale, s.y1 * scale); ctx.lineTo(s.x2 * scale, s.y2 * scale); }); ctx.stroke(); }
    if (showObjects) for (const s of objects) { ctx.fillStyle = '#fc795f'; ctx.beginPath(); ctx.arc(s.x * scale, s.y * scale, 10 * scale, 0, Math.PI * 2); ctx.fill(); }
    if (config) { ctx.strokeStyle = '#ecfff3'; ctx.lineWidth = 6 * scale; ctx.beginPath(); ctx.arc(config.startX * scale, config.startY * scale, 18 * scale, 0, Math.PI * 2); ctx.stroke(); }
  }
  controls(); zoomControl(c); checkControl('AI route', true, v => { showRoute = v; draw(); }); checkControl('Object markers', true, v => { showObjects = v; draw(); }); checkControl('Tile grid', false, v => { grid = v; draw(); }); draw();
  detail(`64 × 64 tiles · ${segments.length} AI segments · ${objects.length} objects. Yellow = AI route; coral = objects; white ring = start. World origin is upper left.`);
  if (config) detail(`Tilesets: ${config.tiles.join(', ')} · sky: ${config.sky} · palette cycling: ${config.cycling ? 'enabled in original game (static preview here)' : 'off'}.`);
}
// The enhancement preview of a track (docs/enhancements.md): a race on the track seen from the race camera, the reference renderer on the left
// and the Enhanced presentation on the right, at a moment of the drive or playing; the effects, their levels and the sun can be tried here
// and saved for the playtest page.
const EFFECT_LABELS = { smooth: 'Smooth motion', shadows: 'Contact shadows', sceneryShadows: 'Scenery shadows', sunShadows: 'Sun shadows', skidMarks: 'Skid marks', particles: 'Particles', water: 'Moving water', fog: 'Distance fog', clouds: 'Sky layers (clouds, far range)', lighting: 'Track lighting' };
const LEVEL_LABELS = { shadowStrength: 'Shadow strength', fogStrength: 'Fog strength', particleAmount: 'Particle amount', sunAngle: 'Sun direction' };
function rangeControl(label, value, change) {
  const input = el('input'); input.type = 'range'; input.min = 0; input.max = 1; input.step = 0.05; input.value = value; input.oninput = () => change(Number(input.value)); return field(label, input);
}
function previewRace(stem) {
  const dat = get('wacky.dat')?.data;
  if (!dat || !get(stem + '.gam')) { $('preview').replaceChildren(el('p', 'The race view runs the game on your WACKY.DAT: open the complete archive.', 'preview-error')); return; }
  let preview;
  const atmospheres = loadAtmospheres(); // the tracks' atmospheres the track editor keeps (read here, never written)
  try { preview = createRacePreview(dat, stem, { atmosphere: name => atmospheres[name], relief: relief.provider }); } catch (e) { $('preview').replaceChildren(el('p', e.message, 'preview-error')); return; }
  const saved = loadSettings();
  let settings = state.gfx ??= enhancedOn(saved) ? saved : applyPreset(saved, 'enhanced'); // the game's settings when they draw through the enhanced path, else the Enhanced preset
  let moment = 140, layout = 'both', hud = true, level = 1, playing = false, acc = 0, last = 0, alpha = 1; // @math a moment after the fly-in and the countdown
  const c = canvas(640, 200), ctx = c.getContext('2d'); c.style.width = '100%'; c.style.maxWidth = 'none'; c.style.imageRendering = 'pixelated'; // the screens as large as the preview allows, their pixels sharp
  const left = new Uint8ClampedArray(320 * 200 * 4), right = new Uint8ClampedArray(320 * 200 * 4), small = document.createElement('canvas'); // @math the two screens; the original's picture before it is enlarged
  small.width = 320; small.height = 200; // @math the screen
  const legend = el('div', undefined, 'compare-legend'), legendLeft = el('span', 'ORIGINAL · reference renderer'), legendRight = el('span', 'ENHANCED'); legend.append(legendLeft, legendRight); c.parentElement.append(legend);
  const momentSlider = el('input'), momentLabel = el('span', undefined, 'frame-label'), stats = el('span', undefined, 'frame-label');
  momentSlider.type = 'range'; momentSlider.min = 0; momentSlider.max = 2400; momentSlider.step = 1; momentSlider.value = moment; // @math about three and a half minutes of passes
  // The Original at 320 x 200, enlarged nearest as many times as the Enhanced picture's resolution (Stage 4: RESOLUTION), beside the Enhanced
  // picture at its own size, so the two show at the same size and every pixel of each is its own. In the wide view (VIEW, worked out for the
  // shape the playtest page's display keeps: 53 columns a side on 4:3, 18 on 16:10) the Original stands in the middle of a screen as wide as
  // the Enhanced one, black either side, over the columns the Enhanced picture shares with it.
  const aspect = loadDisplay().aspect;
  function draw() {
    const s = preview.draw({ alpha: playing ? alpha : 1, hud, detail: level, aspect }, left, right), k = s.h / 200, both = layout === 'both', ow = 320 * k; // @math the screen's rows and columns
    c.width = (both ? 2 : 1) * s.w; c.height = s.h; // @math one or two screens
    if (layout !== 'enhanced') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s.w, s.h); small.getContext('2d').putImageData(new ImageData(left, 320, 200), 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, (s.w - ow) / 2, 0, ow, s.h); } // @math the screen, in the middle of a wide one
    if (layout !== 'original') ctx.putImageData(new ImageData(s.world, s.w, s.h), both ? s.w : 0, 0);
    const wide = s.w > ow; // @math the Enhanced picture wider than the Original's columns
    legend.hidden = !both; legendLeft.textContent = k > 1 ? `ORIGINAL · reference renderer, enlarged ${k} times` : 'ORIGINAL · reference renderer'; legendRight.textContent = k > 1 || wide ? `ENHANCED · ${s.w} x ${s.h}${wide ? `, ${(s.w - ow) / (2 * k)} more columns either side` : ''}` : 'ENHANCED';
    momentLabel.textContent = `pass ${moment} · ${(moment * preview.tickMs / 1000).toFixed(1)} s`; // @math milliseconds in a second
    stats.textContent = enhancedOn(settings) ? `${s.particles} particles · ${s.marks} skid mark segments · enhanced draw ${s.last.toFixed(1)} ms at ${s.w} x ${s.h}` : 'every effect off: the reference renderer';
  }
  function seek() { try { preview.seek(moment, settings); draw(); } catch (e) { status(e.message, true); } }
  function set(next) { // the settings, and every control showing them
    settings = state.gfx = normalize(next); presetSelect.value = settings.preset; scaleSelect.value = String(settings.scale); viewSelect.value = settings.view; sizesSelect.value = settings.sizes;
    for (const k of EFFECTS) boxes[k].checked = settings[k];
    for (const k of Object.keys(LEVELS)) ranges[k].value = String(settings[k]);
    seek();
  }
  controls();
  selectControl('Compare', [['both', 'Original | Enhanced'], ['enhanced', 'Enhanced only'], ['original', 'Original only']], layout, v => { layout = v; draw(); });
  field('Moment', momentSlider); $('controls').append(momentLabel);
  momentSlider.oninput = () => { moment = Number(momentSlider.value); playing = false; playBox.checked = false; seek(); };
  const playBox = checkControl('Play', false, v => { playing = v; acc = 0; last = performance.now(); });
  selectControl('Detail', [[1, 'High'], [2, 'Medium'], [3, 'Low']], level, v => { level = Number(v); draw(); });
  checkControl('HUD', hud, v => { hud = v; draw(); });
  const presetSelect = selectControl('Preset', [['original', 'Original'], ['enhanced', 'Enhanced'], ['custom', 'Custom']], settings.preset, v => set(applyPreset(settings, v)));
  presetSelect.querySelector('option[value=custom]').disabled = true;
  const scaleSelect = selectControl('Resolution', RENDER.scales.map(n => [n, `${n}x`]), settings.scale, v => set(change(settings, 'scale', Number(v)))); // Stage 4: the Enhanced world at twice the samples; the preview shows it itself, WebGL or not
  const viewSelect = selectControl('View', [['standard', 'Standard'], ['wide', 'Wide (16:9)']], settings.view, v => set(change(settings, 'view', v))); // Stage 4: the wide view's margins, for the playtest page's display shape
  const sizesSelect = selectControl('Sprite sizes', [['classes', 'Stepped, as the original'], ['smooth', 'Smooth']], settings.sizes, v => set(change(settings, 'sizes', v))); // Stage 4: the pictures at sizes between the game's classes, on the floor's own rows
  const boxes = Object.fromEntries(EFFECTS.map(k => [k, checkControl(EFFECT_LABELS[k], settings[k], v => set(change(settings, k, v)))]));
  const ranges = Object.fromEntries(Object.keys(LEVELS).map(k => [k, rangeControl(LEVEL_LABELS[k], settings[k], v => set(change(settings, k, v)))]));
  const use = el('button', 'Use these in the game'); use.onclick = () => { if (saveSettings(settings)) status('Saved: the playtest page draws with these graphics settings from now on.'); else status('This browser does not let the page keep settings.', true); }; field('Playtest', use);
  const load = el('button', 'Load the game\'s'); load.onclick = () => set(loadSettings()); field('Settings', load);
  field('Effects', stats);
  function tick(time) {
    if (playing) {
      acc += Math.min(time - last, 250); last = time; // @math at most a quarter second at a time
      while (acc >= preview.tickMs) { preview.step(); moment++; acc -= preview.tickMs; }
      momentSlider.value = moment; alpha = acc / preview.tickMs; draw();
    }
    state.raf = requestAnimationFrame(tick);
  }
  seek(); state.raf = requestAnimationFrame(tick);
  detail(`A race on track ${stem} driven by ${preview.driver}, from the start with its fly-in. The left half is the reference renderer of the port, the right half the Enhanced presentation of the same moment (docs/enhancements.md). Play shows smooth motion against the game's 11 ticks a second; the effects, their levels, the sun direction, the resolution, the view and the sprite sizes apply at once (at 2x the Enhanced world has twice the original's samples each way and the Original is enlarged twice beside it; the wide view shows more of the track either side, for the screen shape the playtest page keeps, with the Original in the middle; smooth sprite sizes draw the karts and the scenery at sizes between the game's ten steps, on the ground's own rows), and Use these in the game stores them for the playtest page (graphics settings only, kept in this browser).`);
}

function previewPos(entry) {
  const c = canvas(64, 64); let offset = 0;
  function draw() { const values = numericValues(entry.data, 2, false, offset).slice(0, 4096), max = Math.max(...values, 1), rgba = new Uint8ClampedArray(4096 * 4); values.forEach((v, i) => { const t = v / max; rgba.set([t * 255, 60 + t * 150, 180 - t * 90, 255], i * 4); }); c.getContext('2d').putImageData(new ImageData(rgba, 64, 64), 0, 0); }
  controls(); zoomControl(c, 8); selectControl('Data starts at', [[0, 'Byte 0'], [2, 'Byte 2 (experimental)']], 0, v => { offset = Number(v); draw(); }); draw();
  detail('16-bit little-endian progress heatmap. This archive has two extra bytes; their purpose is unknown. Offset selection is exploratory.');
}
function previewText(entry) {
  const colors = ['#000','#00a','#0a0','#0aa','#a00','#a0a','#a50','#aaa','#555','#55f','#5f5','#5ff','#f55','#f5f','#ff5','#fff'];
  const grid = el('div', undefined, 'b800');
  b800Cells(entry.data).forEach(cell => { const s = el('span', cell.character); s.style.color = colors[cell.foreground]; s.style.background = colors[cell.background]; if (cell.blink) s.className = 'blink'; grid.append(s); });
  $('preview').replaceChildren(grid); detail('80 × 25 CGA text cells. CP437 characters and color attributes are decoded; glyphs use the browser’s monospace font.');
}

function plot(c, values, xy = false) {
  const ctx = c.getContext('2d'), w = c.width, h = c.height; ctx.fillStyle = '#162128'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2c3b44'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 5); ctx.lineTo(w, i * h / 5); ctx.stroke(); }
  if (!values.length) return;
  let min = Infinity, max = -Infinity;
  for (const v of values) { min = Math.min(min, v); max = Math.max(max, v); }
  const range = max - min || 1, margin = 30; ctx.strokeStyle = '#a3db79'; ctx.lineWidth = 2; ctx.beginPath();
  const step = Math.max(1, Math.floor(values.length / (xy ? 20000 : w * 2)));
  for (let i = 0, j = 0; i < values.length - (xy ? 1 : 0); i += xy ? 2 : step, j++) {
    const x = xy ? margin + (values[i] - min) / range * (w - margin * 2) : margin + i / Math.max(values.length - 1, 1) * (w - margin * 2);
    const y = h - margin - (values[xy ? i + 1 : i] - min) / range * (h - margin * 2);
    if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.fillStyle = '#98aab5'; ctx.font = '12px monospace'; ctx.fillText(`min ${min.toLocaleString()}  /  max ${max.toLocaleString()}`, 20, 20);
}
function previewNumbers(entry) {
  const ext = extension(entry.name), pairs = ext === 'mov' || entry.name === 'trig.dat';
  let width = ['view', 'ndist', 'slp', 'trig.dat', 'audiohed.fx'].includes(entry.name) || ext === 'inf' ? 4 : ext === 'xy' ? 1 : 2, offset = ext === 'mov' ? 2 : 0, signed = ext !== 'xy' && entry.name !== 'audiohed.fx';
  const c = canvas(800, 360); $('export-png').hidden = true; controls();
  const rowsBox = el('div'); $('details').append(rowsBox);
  function draw() { const values = numericValues(entry.data, width, signed, offset); plot(c, values, pairs); rowsBox.replaceChildren(); table(['Index', 'Byte offset', 'Value'], values.map((v, i) => [i, offset + i * width, v]), rowsBox); }
  selectControl('Number width', [[1, '8-bit'], [2, '16-bit LE'], [4, '32-bit LE']], width, v => { width = Number(v); draw(); }); checkControl('Signed', signed, v => { signed = v; draw(); }); numberControl('Byte offset', offset, 0, Math.max(0, entry.size - 1), v => { offset = v; draw(); }); draw();
  detail(pairs ? 'X/Y pairs plotted in stored order.' : 'Numeric interpretation for inspection; choose element width to explore undocumented tables. VIEW/NDIST/SLP default to 32-bit based on this archive’s byte patterns, which differ from the wiki.');
}
function previewUnknown(entry) {
  const c = canvas(256, Math.min(256, Math.max(1, Math.ceil(entry.size / 256))));
  paint(c, rawFrame(entry.data, c.width, c.height, 0, 0, false), grayscalePalette()); controls(); zoomControl(c);
  detail('Byte-intensity preview. The layout is undocumented; the complete original can be downloaded and the byte view shows the first 2048 bytes.');
}

function waveform(samples, channels, c) {
  const ctx = c.getContext('2d'); ctx.fillStyle = '#162128'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = '#a3db79'; ctx.lineWidth = 1;
  const frames = samples.length / channels, step = Math.max(1, Math.floor(frames / c.width)); ctx.beginPath();
  for (let x = 0; x < c.width; x++) { let min = 0, max = 0; for (let j = Math.floor(x * frames / c.width); j < Math.min(frames, Math.floor(x * frames / c.width) + step); j++) { min = Math.min(min, samples[j * channels]); max = Math.max(max, samples[j * channels]); } ctx.moveTo(x, (1 - max) * c.height / 2); ctx.lineTo(x, (1 - min) * c.height / 2); } ctx.stroke();
}
function previewAudio(entry) {
  const ext = extension(entry.name), synthesized = ['klm', 'mid', 'adl'].includes(ext), c = canvas(800, 200); $('export-png').hidden = true;
  const panel = el('div', undefined, 'audio-panel'), caption = el('p', synthesized ? 'Ready to synthesize the original score.' : 'Ready to decode the original sound.'), audio = el('audio'); audio.controls = true; audio.preload = 'metadata';
  const prepare = el('button', synthesized ? '▶ Render & listen' : '▶ Decode & listen', 'primary'), cancel = el('button', 'Cancel render'), save = el('button', '↓ WAV'); cancel.hidden = true; save.disabled = true;
  const buttons = el('div', undefined, 'audio-actions'); buttons.append(prepare, cancel, save); panel.append(caption, audio, buttons); $('preview').append(panel); controls();
  let limit = 30, wav;
  if (synthesized) selectControl('Preview length', [[30, 'First 30 seconds'], [120, 'First 2 minutes'], [600, 'Full song (up to 10 min)']], limit, v => { limit = Number(v); prepare.disabled = false; });
  const gain = el('input'); gain.type = 'range'; gain.min = 0; gain.max = 1; gain.step = .01; gain.value = .55; audio.volume = .55; field('Volume', gain); gain.oninput = () => { audio.volume = Number(gain.value); };
  function ready(result, token) {
    if (token !== state.renderId) return;
    state.urls.forEach(u => URL.revokeObjectURL(u)); state.urls = [];
    wav = encodeWav(result); const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })); state.urls.push(url); audio.src = url; audio.loop = !!result.loop;
    const seconds = result.samples.length / result.sampleRate / result.channels;
    caption.textContent = `${result.description} · ${seconds.toFixed(2)}s${result.duration > seconds ? ` of ${result.duration.toFixed(2)}s` : ''}${result.loop ? ' · loop enabled' : ''}`;
    waveform(result.samples, result.channels, c); prepare.disabled = false; prepare.textContent = '↻ Render again'; cancel.hidden = true; save.disabled = false;
    if (!result.samples.length) caption.textContent = 'This original sound slot is an empty placeholder (no audio samples).';
    else audio.play().catch(() => { if (token === state.renderId) caption.textContent += ' · Press play to start.'; });
  }
  function fail(message, token) { if (token !== state.renderId) return; caption.textContent = message; prepare.disabled = false; cancel.hidden = true; status(message, true); }
  prepare.onclick = () => {
    audio.pause(); state.worker?.terminate(); state.worker = null;
    const token = ++state.renderId; prepare.disabled = true; save.disabled = true; caption.textContent = synthesized ? 'Rendering in the background…' : 'Decoding…';
    if (!synthesized) { try { ready(ext === 'voc' ? decodeVoc(entry.data) : decodePcSpeaker(entry.data), token); } catch (e) { fail(e.message, token); } return; }
    cancel.hidden = false;
    const worker = new Worker(new URL('./audio-worker.js', import.meta.url), { type: 'module' }); state.worker = worker;
    worker.onmessage = ({ data }) => { worker.terminate(); if (state.worker === worker) state.worker = null; if (data.error) fail(data.error, token); else ready(data.result, token); };
    worker.onerror = () => { worker.terminate(); fail('Audio worker could not render this asset.', token); };
    worker.postMessage({ id: token, kind: ext, data: entry.data, limit });
  };
  cancel.onclick = () => { state.worker?.terminate(); state.worker = null; state.renderId++; caption.textContent = 'Render cancelled.'; prepare.disabled = false; cancel.hidden = true; };
  save.onclick = () => { if (wav) download(wav, entry.name.replace(/\.[^.]+$/, '') + '.wav', 'audio/wav'); };
  detail(ext === 'mid' ? 'MIDI notes, timing and instrument programs are read from the original. Timbres, percussion and expressive controllers are approximate; no external soundfont is used.' : ext === 'klm' ? 'The original KLM instrument data drives a JavaScript OPL emulator. Rhythm-channel handling is experimental. Rendering runs in a worker and can be cancelled.' : ext === 'voc' ? 'PCM samples decoded directly from VOC blocks. Infinite loops preview one decoded cycle and use the browser’s loop playback.' : 'Original AudioT sound-effect data, synthesized in the browser. Empty original slots produce silence.');
}

function selectEntry(entry) {
  cleanup(); state.selected = entry;
  $('asset-category').textContent = category(entry).toUpperCase(); $('asset-name').textContent = entry.name;
  $('asset-meta').textContent = `${formatSize(entry.size)} · ${entry.source}${entry.offset !== undefined ? ` · offset 0x${entry.offset.toString(16)}` : ''}`;
  $('preview').replaceChildren(); $('controls').replaceChildren(); $('controls').hidden = true; $('details').replaceChildren(); $('download').disabled = false;
  $('hex').textContent = hexDump(entry.data); $('hex').hidden = true; $('hex-toggle').setAttribute('aria-expanded', 'false'); $('hex-toggle').textContent = 'Show bytes';
  for (const button of $('asset-list').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.id === entry.id));
  try {
    const ext = extension(entry.name);
    if (category(entry) === 'Sounds' || category(entry) === 'Music') previewAudio(entry);
    else if (ext === 'pcx') previewPcx(entry);
    else if (['sp', 'par'].includes(ext)) previewRaw(entry);
    else if (['gam', 'm', 'rd', 'spw'].includes(ext)) previewTrack(entry);
    else if (ext === 'pos') previewPos(entry);
    else if (ext === 'bin') previewText(entry);
    else if (['tab', 'mov', 'xy', 'inf'].includes(ext) || ['ndist', 'slp', 'view', 'trig.dat', 'audiohed.fx'].includes(entry.name)) previewNumbers(entry);
    else if (category(entry) === 'Archives') {
      $('preview').append(el('div', '▣', 'archive-icon'));
      const members = state.entries.filter(e => e.source === entry.name || e.source === entry.source + '/' + entry.name);
      detail('Container entries are available individually in the collection.'); table(['Name', 'Size', 'Offset'], members.map(e => [e.name, formatSize(e.size), e.offset ?? '—']));
    } else previewUnknown(entry);
    const parsed = inspectData(entry.name, entry.data);
    if (parsed) { detail(parsed.note); table(parsed.columns, parsed.rows); }
  } catch (e) {
    $('preview').append(el('p', e.message, 'preview-error')); detail('This file can still be inspected in the byte view and downloaded unchanged.'); status(`${entry.name}: ${e.message}`, true);
  }
}
function renderList() {
  const query = $('search').value.toLowerCase().trim(), ext = $('format').value;
  const entries = state.entries.filter(e => (state.category === 'All assets' || category(e) === state.category) && (!ext || extension(e.name) === ext) && (!query || `${e.name} ${e.source}`.toLowerCase().includes(query)));
  $('result-count').textContent = entries.length; $('asset-list').replaceChildren();
  for (const entry of entries) {
    const button = el('button', undefined, 'asset-item'), icon = el('span', icons[category(entry)], 'file-icon'), label = el('span', undefined, 'asset-item-label');
    label.append(el('strong', entry.name), el('small', `${extension(entry.name).toUpperCase() || 'TABLE'} · ${formatSize(entry.size)}`)); button.append(icon, label);
    button.dataset.id = entry.id; button.setAttribute('aria-pressed', String(state.selected?.id === entry.id)); button.onclick = () => selectEntry(entry); $('asset-list').append(button);
  }
  if (!entries.length) $('asset-list').append(el('p', state.entries.length ? 'No assets match these filters.' : 'Your collection will appear here.', 'empty-list'));
  $('filters').replaceChildren();
  for (const cat of categories) {
    const count = cat === 'All assets' ? state.entries.length : state.entries.filter(e => category(e) === cat).length;
    const button = el('button', undefined, 'filter'); button.append(el('span', cat), el('small', count)); button.setAttribute('aria-pressed', String(cat === state.category)); button.onclick = () => { state.category = cat; renderList(); }; $('filters').append(button);
  }
}
// Every way of getting files (picker, drop, dev server) ends here as a VFS plus the paths to show.
async function loadVfs(vfs, paths = vfs.list()) {
  const token = ++state.loadId; cleanup(); status('Reading your original files…');
  const entries = [], warnings = [];
  for (const source of paths) {
    const name = source.split(/[\\/]/).at(-1).toLowerCase(), ext = extension(name);
    if (name.startsWith('.') || !['dat', 'pcx', 'sp', 'par', 'voc', 'mid', 'klm', 'cfg', 'hi', 'tim', 'dtt', 'gam', 'm', 'rd', 'spw', 'pos', 'tab', 'atr', 'bmc', 'htt', 'ott', 'bin', 'inf', 'ing', 'sdx', 'fx', 'mov', 'xy', ''].includes(ext)) continue;
    try {
      const data = await vfs.openPath(source); if (token !== state.loadId) return;
      const entry = { id: `file/${source}`, name, source: 'Loose file: ' + source, data, size: data.length }; entries.push(entry);
      if (name === 'wacky.dat') entries.push(...parseDat(data, name));
    } catch (e) { warnings.push(`${name}: ${e.message}`); }
  }
  if (token !== state.loadId) return;
  if (!entries.length) { status('No supported assets found. Select WACKY.DAT or the installed game folder.', true); return; }
  state.entries = entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  state.byName = new Map(); state.images.clear();
  // Archive members take precedence over loose duplicates for related-asset lookup.
  for (const e of state.entries) if (!state.byName.has(e.name) || e.source === 'wacky.dat') state.byName.set(e.name, e);
  const h = get('audiohed.fx'), a = get('audiot.fx');
  if (h && a) try { state.entries.push(...parseAudioT(h.data, a.data)); } catch (e) { warnings.push(e.message); }
  state.entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  try { state.catalog = get('sprite.atr') ? parseAtr(get('sprite.atr').data) : []; } catch (e) { state.catalog = []; warnings.push(e.message); }
  state.category = 'All assets'; $('search').value = ''; $('format').replaceChildren(el('option', 'All formats'));
  $('format').firstChild.value = '';
  for (const ext of [...new Set(state.entries.map(e => extension(e.name)))].filter(Boolean).sort()) { const opt = el('option', '.' + ext); opt.value = ext; $('format').append(opt); }
  $('asset-total').textContent = state.entries.length; renderList();
  status(`${state.entries.length} assets loaded. Originals are read only.${warnings.length ? ' Notes: ' + warnings.join('; ') : ''}`, !!warnings.length);
  selectEntry(get('wintro.pcx') ?? get('a_f1.pcx') ?? state.entries[0]);
}
const loadFiles = files => loadVfs(openPicked(files));
async function loadLocal() {
  $('local').disabled = true;
  try {
    const vfs = await openDevGame({ base: import.meta.env.BASE_URL }), paths = vfs.list(), archive = paths.find(p => /(^|\/)wacky\.dat$/i.test(p));
    if (!archive) throw new Error('WACKY.DAT was not found under game/. Use Open files or Open folder to select your installation.');
    const dir = archive.slice(0, archive.lastIndexOf('/') + 1);
    await loadVfs(vfs, paths.filter(p => p === archive || (p.startsWith(dir) && !p.slice(dir.length).includes('/') && !/\.(dat|exe)$/i.test(p))));
  } catch (e) { status(e.message, true); } finally { $('local').disabled = false; }
}
$('local').onclick = loadLocal; $('welcome-load').onclick = loadLocal;
for (const label of document.querySelectorAll('label.button')) {
  label.tabIndex = 0; label.setAttribute('role', 'button');
  label.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById(label.htmlFor).click(); } };
}
for (const id of ['files', 'folder']) $(id).onchange = async event => { await loadFiles([...event.target.files]); event.target.value = ''; };
$('search').oninput = renderList; $('format').onchange = renderList;
$('download').onclick = () => { if (state.selected) download(state.selected.data, state.selected.name); };
$('export-png').onclick = () => state.canvas?.toBlob(blob => { if (blob) download(blob, state.selected.name + '.png', 'image/png'); });
$('hex-toggle').onclick = () => { $('hex').hidden = !$('hex').hidden; $('hex-toggle').setAttribute('aria-expanded', String(!$('hex').hidden)); $('hex-toggle').textContent = $('hex').hidden ? 'Show bytes' : 'Hide bytes'; };
document.addEventListener('dragover', e => { e.preventDefault(); });
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files]); });
window.addEventListener('pagehide', cleanup); renderList();
