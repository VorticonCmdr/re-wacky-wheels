import { parseDat, parseAudioT } from './archive.js';
import { extension, ascii, hexDump, view } from './binary.js';
import { decodePcx, toRgba, grayscalePalette } from './pcx.js';
import { parseAtr, rawFrame, spriteLayout } from './sprites.js';
import { parseGam, parseRoute, parseSpawns, composeTrack } from './tracks.js';
import { decodeVoc, decodePcSpeaker, encodeWav } from './audio.js';
import { numericValues, inspectData, b800Cells } from './data-formats.js';

const $ = id => document.getElementById(id);
const categories = ['All assets', 'Graphics', 'Sprites', 'Tracks', 'Music', 'Sounds', 'Data', 'Archives'];
const state = { entries: [], byName: new Map(), images: new Map(), category: 'All assets', selected: null, catalog: [], filter: '', worker: null, raf: 0, urls: [], renderId: 0, loadId: 0, canvas: null };
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
function paint(c, img, palette, transparent = -1) {
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(new ImageData(img.rgba ?? toRgba(img.indices, palette ?? img.palette, transparent), img.width, img.height), 0, 0);
}
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

function previewPcx(entry) {
  const img = decodePcx(entry.data), c = canvas(img.width, img.height); let key = 'own';
  const draw = () => paint(c, img, palette(key, img.palette)); draw(); controls(); zoomControl(c);
  if (!img.rgba) {
    selectControl('Palette', paletteChoices(true), key, v => { key = v; draw(); });
    const swatches = el('div', undefined, 'palette-grid');
    for (let i = 0; i < 256; i++) { const s = el('span'); s.style.background = `rgb(${img.palette.slice(i * 3, i * 3 + 3).join(',')})`; s.title = `Index ${i}`; swatches.append(s); }
    $('details').append(swatches);
  }
  detail(`${img.width} × ${img.height} pixels · ${img.bits} bits/plane · ${img.planes} plane(s). Palette indices are preserved.`);
}
function previewRaw(entry) {
  const horizon = extension(entry.name) === 'par', layout = horizon ? { width: 640, height: 40, frames: 1, certainty: 'Documented horizon dimensions' } : spriteLayout(entry.name, entry.data, state.catalog);
  let w = layout.width, h = layout.height, frame = 0, offset = 0, column = !horizon, key = defaultPalette(), transparent = !horizon, animate = false, last = 0;
  const c = canvas(w, h); controls();
  const frameSlider = el('input'); frameSlider.type = 'range'; frameSlider.min = 0; frameSlider.step = 1;
  const frameLabel = el('span', undefined, 'frame-label');
  function count() { return Math.max(1, Math.ceil((entry.data.length - offset) / (w * h))); }
  function draw() {
    frame = Math.min(frame, count() - 1); frameSlider.max = count() - 1; frameSlider.value = frame;
    paint(c, rawFrame(entry.data, w, h, frame, offset, column), palette(key), transparent ? 0 : -1);
    frameLabel.textContent = `${frame + 1} / ${count()} frames`;
    if (zoom.value !== 'fit') c.style.width = w * Number(zoom.value) + 'px';
  }
  const zoom = selectControl('Zoom', [['fit', 'Fit'], [1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], horizon ? 1 : 8, v => { c.style.width = v === 'fit' ? '' : w * Number(v) + 'px'; c.style.maxWidth = v === 'fit' ? '100%' : 'none'; });
  c.style.width = w * Number(zoom.value) + 'px'; c.style.maxWidth = 'none';
  numberControl('Width', w, 1, 2048, n => { w = n; frame = 0; draw(); });
  numberControl('Height', h, 1, 2048, n => { h = n; frame = 0; draw(); });
  numberControl('Byte offset', offset, 0, Math.max(0, entry.size - 1), n => { offset = n; frame = 0; draw(); });
  selectControl('Palette', paletteChoices(), key, v => { key = v; draw(); });
  checkControl('Column-major', column, v => { column = v; draw(); }); checkControl('Transparent index 0', transparent, v => { transparent = v; draw(); });
  field('Frame', frameSlider); $('controls').append(frameLabel); frameSlider.oninput = () => { frame = Number(frameSlider.value); draw(); };
  checkControl('Animate · 8 fps', false, v => { animate = v; });
  function tick(time) { if (animate && time - last >= 125) { frame = (frame + 1) % count(); draw(); last = time; } state.raf = requestAnimationFrame(tick); }
  draw(); state.raf = requestAnimationFrame(tick);
  detail(layout.certainty + '. Raw files have no embedded palette. Select the palette for the screen or track they belong to.');
  if (!horizon && !state.catalog.some(s => s.name === entry.name)) detail('For uncatalogued files, frame layout is inferred. Mixed-size sheets need manual width, height and byte-offset adjustments.');
}

function previewTrack(entry) {
  const stem = entry.name.split('.')[0], map = get(stem + '.m'), gam = get(stem + '.gam');
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
async function loadFiles(files) {
  const token = ++state.loadId; cleanup(); status('Reading your original files…');
  const entries = [], warnings = []; const limit = 64 * 1024 * 1024;
  for (const file of files) {
    const name = file.name.toLowerCase(), ext = extension(name), source = file.path ?? file.webkitRelativePath ?? file.name;
    if (name.startsWith('.') || !['dat', 'pcx', 'sp', 'par', 'voc', 'mid', 'klm', 'cfg', 'hi', 'tim', 'dtt', 'gam', 'm', 'rd', 'spw', 'pos', 'tab', 'atr', 'bmc', 'htt', 'ott', 'bin', 'inf', 'ing', 'sdx', 'fx', 'mov', 'xy', ''].includes(ext)) continue;
    if (file.size > limit) { warnings.push(`${name} exceeds the 64 MB per-file limit`); continue; }
    try {
      const data = new Uint8Array(await file.arrayBuffer()); if (token !== state.loadId) return;
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
async function loadLocal() {
  $('local').disabled = true;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}__game/manifest`);
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Local loading is available with npm run dev. On a hosted build, choose Open files or Open folder.');
    const paths = await response.json(), archive = paths.find(p => /(^|\/)wacky\.dat$/i.test(p));
    if (!archive) throw new Error('WACKY.DAT was not found under game/. Use Open files or Open folder to select your installation.');
    const dir = archive.slice(0, archive.lastIndexOf('/') + 1);
    const selected = paths.filter(p => p === archive || (p.startsWith(dir) && !p.slice(dir.length).includes('/') && !/\.dat$/i.test(p)));
    const files = await Promise.all(selected.map(async path => {
      const r = await fetch(`${import.meta.env.BASE_URL}__game/file?path=${encodeURIComponent(path)}`); if (!r.ok) throw new Error(`Could not load ${path}`);
      const buffer = await r.arrayBuffer(); return { name: path.split('/').at(-1), path, size: buffer.byteLength, arrayBuffer: async () => buffer };
    }));
    await loadFiles(files);
  } catch (e) { status(e.message, true); } finally { $('local').disabled = false; }
}
$('local').onclick = loadLocal; $('welcome-load').onclick = loadLocal;
for (const id of ['files', 'folder']) $(id).onchange = async event => { await loadFiles([...event.target.files]); event.target.value = ''; };
$('search').oninput = renderList; $('format').onchange = renderList;
$('download').onclick = () => { if (state.selected) download(state.selected.data, state.selected.name); };
$('export-png').onclick = () => state.canvas?.toBlob(blob => { if (blob) download(blob, state.selected.name + '.png', 'image/png'); });
$('hex-toggle').onclick = () => { $('hex').hidden = !$('hex').hidden; $('hex-toggle').setAttribute('aria-expanded', String(!$('hex').hidden)); $('hex-toggle').textContent = $('hex').hidden ? 'Show bytes' : 'Hide bytes'; };
document.addEventListener('dragover', e => { e.preventDefault(); });
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files]); });
window.addEventListener('pagehide', cleanup); renderList();
