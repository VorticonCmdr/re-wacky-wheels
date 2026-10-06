import { parseDat } from './archive.js';
import { decodePcx, toRgba } from './pcx.js';
import { openDevGame } from './vfs/dev.js';
import { openPicked } from './vfs/picker.js';
import { parseAtr, rawFrame } from './sprites.js';
import {
  createTrack,
  snapshot,
  restore,
  trackChanges,
  patchArchive,
  History,
  fingerprint,
  clampPoint,
  paintLine,
  paintBrush,
  floodFill,
  moveWaypoint,
  insertWaypoint,
  deleteWaypoint,
  routeSegment,
} from './track-model.js';
import { createAtmospherePanel } from './track-atmosphere.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map'),
  ctx = canvas.getContext('2d'),
  mini = $('minimap'),
  miniCtx = mini.getContext('2d');
const surface = document.createElement('canvas');
surface.width = surface.height = 2048;
const surfaceCtx = surface.getContext('2d');
const state = {
  original: null,
  hash: '',
  entries: new Map(),
  tracks: new Map(),
  stems: [],
  track: null,
  history: new Map(),
  catalog: [],
  tiles: [],
  sprites: new Map(),
  tool: 'brush',
  tile: 0,
  objectId: 0,
  selection: null,
  gesture: null,
  hover: null,
  space: false,
  surfaceDirty: true,
  frame: 0,
  saveTimer: 0,
  saving: false,
  loadId: 0,
  pendingDraft: null,
  storageFailed: false,
  view: { x: 0, y: 0, scale: 0.3, width: 1, height: 1 },
};
const hints = {
  brush: 'Drag to paint. Alt picks a tile.',
  rectangle: 'Drag a rectangle to paint it.',
  fill: 'Click to replace connected matching tiles.',
  eyedropper: 'Click a tile to pick it, then paint.',
  route: 'Drag a node. Click elsewhere to insert a waypoint.',
  object: 'Click to place. Drag a marker to move it.',
  start: 'Click or drag to move the start position.',
  pan: 'Drag to pan. Scroll to zoom.',
};
// The Atmosphere tab (track-atmosphere.js): the selected track's atmosphere and its race view.
const atmosphere = createAtmospherePanel({
  $,
  context: () => ({ original: state.original, track: state.track }),
  status: (message, error) => status(message, error),
});
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function element(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function download(data, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = element('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function allChanges() {
  const result = new Map();
  for (const track of state.tracks.values())
    for (const [name, data] of trackChanges(track)) result.set(name, data);
  return result;
}
function draftData() {
  return {
    format: 'wacky-wheels-track-project',
    version: 1,
    archive: state.hash,
    selected: state.track.stem,
    tracks: Object.fromEntries(
      [...state.tracks]
        .filter(([, track]) => trackChanges(track).size)
        .map(([stem, track]) => [stem, snapshot(track)])
    ),
  };
}
function draftKey() {
  return `wacky-wheels-track-draft:${state.hash}`;
}
function autosave() {
  clearTimeout(state.saveTimer);
  state.saving = true;
  state.saveTimer = setTimeout(() => {
    try {
      if (allChanges().size)
        localStorage.setItem(draftKey(), JSON.stringify(draftData()));
      else localStorage.removeItem(draftKey());
      state.storageFailed = false;
      state.saving = false;
      updateSaveState();
    } catch {
      state.storageFailed = true;
      state.saving = false;
      updateSaveState();
      status(
        'Browser draft storage is unavailable or full. Use Save project to keep your work.',
        true
      );
    }
  }, 400);
}
function updateSaveState() {
  const count = [...state.tracks.values()].filter(
    (t) => trackChanges(t).size
  ).length;
  $('save-state').textContent = count
    ? `${count} edited track${count === 1 ? '' : 's'} · ${state.storageFailed ? 'save project to keep changes' : state.saving ? 'saving draft…' : 'draft saved in this browser'}`
    : 'Your originals stay untouched';
  $('save-state').classList.toggle('dirty', count > 0);
  $('export').disabled = !count;
  for (const option of $('track').options)
    if (state.tracks.has(option.value))
      option.textContent = `Track ${option.value}${trackChanges(state.tracks.get(option.value)).size ? ' • edited' : ''}`;
}
function history() {
  return state.history.get(state.track.stem);
}
function committed(before, label) {
  const changed = history().commit(before, snapshot(state.track), label);
  state.surfaceDirty = true;
  updateInspector();
  updateHistory();
  updateTileVisibility();
  requestRender();
  if (changed) {
    status(label);
    autosave();
    updateSaveState();
    atmosphere.trackEdited();
  }
}
function edit(label, action) {
  if (!state.track) return;
  if (state.pendingDraft) {
    status('Restore or discard the saved draft before editing.', true);
    return;
  }
  finishGesture();
  const before = snapshot(state.track);
  action();
  committed(before, label);
}
function updateHistory() {
  const h = state.track && history();
  $('undo').disabled = !h?.undoStack.length;
  $('redo').disabled = !h?.redoStack.length;
  $('undo').title = h?.undoStack.length
    ? `Undo: ${h.undoStack.at(-1).label} (Ctrl/⌘ Z)`
    : 'Undo (Ctrl/⌘ Z)';
  $('redo').title = h?.redoStack.length
    ? `Redo: ${h.redoStack.at(-1).label} (Ctrl/⌘ Shift Z)`
    : 'Redo (Ctrl/⌘ Shift Z)';
}
function undo(redo = false) {
  if (!state.track) return;
  finishGesture();
  const label = history()[redo ? 'redo' : 'undo'](state.track);
  if (!label) return;
  state.selection = null;
  state.surfaceDirty = true;
  updateHistory();
  updateInspector();
  updateTileVisibility();
  requestRender();
  updateSaveState();
  autosave();
  atmosphere.trackEdited();
  status(`${redo ? 'Redid' : 'Undid'}: ${label}`);
}
function imageCanvas(img, transparent = -1, palette = img.palette) {
  const c = element('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').putImageData(
    new ImageData(
      img.rgba ?? toRgba(img.indices, palette, transparent),
      img.width,
      img.height
    ),
    0,
    0
  );
  return c;
}
function selectTile(tile, switchTool = true) {
  state.tile = tile;
  state.selection = null;
  $('tiles')
    .querySelectorAll('button')
    .forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.tile) === tile);
      b.setAttribute('aria-pressed', String(Number(b.dataset.tile) === tile));
    });
  if (switchTool && !['brush', 'fill', 'rectangle'].includes(state.tool))
    setTool('brush');
  updateInspector();
  requestRender();
}
// The library's tabs: 'tiles', 'objects' or 'atmosphere' (the track's atmosphere and its race view, track-atmosphere.js).
function setTab(name) {
  const panels = {
    tiles: 'tile-panel',
    objects: 'object-panel',
    atmosphere: 'atmosphere-panel',
  };
  for (const [tab, panel] of Object.entries(panels)) {
    $(panel).hidden = tab !== name;
    $(`${tab}-tab`).setAttribute('aria-selected', String(tab === name));
  }
  if (name === 'atmosphere') atmosphere.show();
  else atmosphere.hide();
}
function buildPalette() {
  state.tiles = [];
  state.sprites.clear();
  $('tiles').replaceChildren();
  $('objects').replaceChildren();
  const trackPalette = decodePcx(
    state.entries.get(state.track.config.tiles[0]).data
  ).palette;
  for (const name of state.track.config.tiles) {
    const entry = state.entries.get(name);
    if (!entry) throw new Error(`Missing tileset ${name}.`);
    const img = decodePcx(entry.data),
      sheet = imageCanvas(img, -1, trackPalette),
      columns = Math.floor(img.width / 32);
    for (let index = 0; index < 54; index++) {
      if (!img.indices || (Math.floor(index / columns) + 1) * 32 > img.height)
        throw new Error(`Invalid tileset ${name}.`);
      const tile = element('canvas');
      tile.width = tile.height = 32;
      tile
        .getContext('2d')
        .drawImage(
          sheet,
          (index % columns) * 32,
          Math.floor(index / columns) * 32,
          32,
          32,
          0,
          0,
          32,
          32
        );
      state.tiles.push(tile);
      const id = state.tiles.length - 1,
        button = element('button', undefined, 'tile-button');
      button.dataset.tile = id;
      button.title = `Tile ${id} · ${name}`;
      button.setAttribute('aria-label', `Tile ${id} from ${name}`);
      button.append(tile.cloneNode(), element('span', String(id)));
      button.firstChild.getContext('2d').drawImage(tile, 0, 0);
      button.onclick = () => selectTile(id);
      $('tiles').append(button);
    }
  }
  const palette = trackPalette;
  state.catalog.forEach((object) => {
    const entry = state.entries.get(object.name);
    let sprite;
    if (
      entry &&
      object.width > 0 &&
      object.height > 0 &&
      object.width * object.height <= entry.data.length
    ) {
      sprite = imageCanvas(
        rawFrame(entry.data, object.width, object.height),
        0,
        palette
      );
      state.sprites.set(object.id, sprite);
    }
    const button = element('button', undefined, 'object-button');
    button.dataset.id = object.id;
    button.title = `${object.id} · ${object.name}`;
    button.setAttribute('aria-label', `Place ${object.name}`);
    const preview = element('canvas');
    preview.width = preview.height = 40;
    if (sprite) {
      const scale = Math.min(38 / sprite.width, 38 / sprite.height);
      preview.getContext('2d').imageSmoothingEnabled = false;
      preview
        .getContext('2d')
        .drawImage(
          sprite,
          (40 - sprite.width * scale) / 2,
          (40 - sprite.height * scale) / 2,
          sprite.width * scale,
          sprite.height * scale
        );
    }
    button.append(
      preview,
      element('span', `${object.id} · ${object.name.replace(/\.sp$/i, '')}`)
    );
    button.onclick = () => {
      state.objectId = object.id;
      state.selection = null;
      setTool('object');
      updateObjectPalette();
      updateInspector();
    };
    $('objects').append(button);
  });
  selectTile(state.tile, false);
  updateObjectPalette();
  updateTileVisibility();
}
function updateObjectPalette() {
  $('objects')
    .querySelectorAll('button')
    .forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.id) === state.objectId);
      b.setAttribute(
        'aria-pressed',
        String(Number(b.dataset.id) === state.objectId)
      );
    });
}
function updateTileVisibility() {
  if (!state.track) return;
  const used = new Set(state.track.map),
    query = $('tile-search').value.trim();
  $('tiles')
    .querySelectorAll('button')
    .forEach(
      (b) =>
        (b.hidden =
          ($('used-only').checked && !used.has(Number(b.dataset.tile))) ||
          !b.dataset.tile.includes(query))
    );
}
function setTool(tool) {
  finishGesture();
  state.tool = tool;
  state.selection = null;
  document.querySelectorAll('[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === tool);
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  });
  $('tool-hint').textContent = hints[tool];
  canvas.classList.toggle('panning', tool === 'pan' || state.space);
  if (tool === 'route') $('layer-route').checked = true;
  if (tool === 'object') {
    $('layer-objects').checked = true;
    setTab('objects');
  }
  if (tool === 'start') $('layer-start').checked = true;
  if (['brush', 'rectangle', 'fill', 'eyedropper'].includes(tool))
    setTab('tiles');
  $('brush-size').disabled = tool !== 'brush';
  updateInspector();
  requestRender();
}
function selectTrack(stem) {
  finishGesture();
  const track = state.tracks.get(stem);
  if (!track) return;
  state.track = track;
  state.selection = null;
  state.hover = null;
  $('track').value = stem;
  try {
    buildPalette();
  } catch (error) {
    status(error.message, true);
    return;
  }
  $('welcome').hidden = true;
  $('minimap-box').hidden = false;
  $('track-meta').textContent =
    `${track.config.tiles.map((n) => n.replace(/^a_|\.pcx$/g, '')).join(' + ')} · ${track.route.length} waypoints · ${track.objects.length} objects`;
  state.surfaceDirty = true;
  fit();
  updateHistory();
  updateInspector();
  updateSaveState();
  atmosphere.setTrack(stem);
  for (const id of [
    'save-draft',
    'export-map',
    'reset',
    'previous',
    'next',
    'close-route',
  ])
    $(id).disabled = false;
  status(`Track ${stem} ready. Choose a tile and drag to paint.`);
}
function viewPoint(x, y) {
  const v = state.view;
  return { x: (x - v.x) * v.scale, y: (y - v.y) * v.scale };
}
function eventPoint(e) {
  const rect = canvas.getBoundingClientRect(),
    v = state.view;
  const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  return {
    ...screen,
    wx: screen.x / v.scale + v.x,
    wy: screen.y / v.scale + v.y,
  };
}
function snapPoint(p) {
  const snap = (n) => ($('snap').checked ? Math.floor(n / 32) * 32 + 16 : n);
  return { x: clampPoint(snap(p.wx)), y: clampPoint(snap(p.wy)) };
}
function tilePoint(p) {
  return {
    x: Math.max(0, Math.min(63, Math.floor(p.wx / 32))),
    y: Math.max(0, Math.min(63, Math.floor(p.wy / 32))),
  };
}
function inside(p) {
  return p.wx >= 0 && p.wy >= 0 && p.wx < 2048 && p.wy < 2048;
}
function requestRender() {
  if (!state.frame) state.frame = requestAnimationFrame(render);
}
function resize() {
  const rect = $('viewport').getBoundingClientRect(),
    v = state.view,
    ratio = Math.min(devicePixelRatio || 1, 2);
  const center = {
    x: v.x + v.width / v.scale / 2,
    y: v.y + v.height / v.scale / 2,
  };
  v.width = rect.width;
  v.height = rect.height;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  v.x = center.x - v.width / v.scale / 2;
  v.y = center.y - v.height / v.scale / 2;
  requestRender();
}
function fit() {
  const v = state.view;
  v.scale = Math.max(
    0.05,
    Math.min((v.width - 54) / 2048, (v.height - 54) / 2048)
  );
  v.x = (2048 - v.width / v.scale) / 2;
  v.y = (2048 - v.height / v.scale) / 2;
  requestRender();
}
function zoom(factor, x = state.view.width / 2, y = state.view.height / 2) {
  const v = state.view,
    wx = v.x + x / v.scale,
    wy = v.y + y / v.scale;
  v.scale = Math.max(0.05, Math.min(4, v.scale * factor));
  v.x = wx - x / v.scale;
  v.y = wy - y / v.scale;
  requestRender();
}
function rebuildSurface() {
  surfaceCtx.imageSmoothingEnabled = false;
  state.track.map.forEach((tile, i) =>
    surfaceCtx.drawImage(
      state.tiles[tile],
      (i % 64) * 32,
      Math.floor(i / 64) * 32
    )
  );
  state.surfaceDirty = false;
}
function marker(x, y, color, radius, label, selected = false) {
  const p = viewPoint(x, y);
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? '#fff' : '#0d1b23';
  ctx.stroke();
  if (label !== undefined) {
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#10181d';
    ctx.fillText(String(label), p.x, p.y);
  }
}
function render() {
  state.frame = 0;
  const v = state.view,
    ratio = canvas.width / Math.max(1, v.width);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, v.width, v.height);
  if (!state.track) return;
  if (state.surfaceDirty) rebuildSurface();
  const origin = viewPoint(0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface, origin.x, origin.y, 2048 * v.scale, 2048 * v.scale);
  if ($('layer-grid').checked && v.scale >= 0.15) {
    ctx.strokeStyle = '#e3f0ef25';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n <= 64; n++) {
      const p = viewPoint(n * 32, n * 32);
      ctx.moveTo(p.x, origin.y);
      ctx.lineTo(p.x, origin.y + 2048 * v.scale);
      ctx.moveTo(origin.x, p.y);
      ctx.lineTo(origin.x + 2048 * v.scale, p.y);
    }
    ctx.stroke();
  }
  if ($('layer-route').checked) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#69dbe9c9';
    ctx.beginPath();
    state.track.route.forEach((r) => {
      const a = viewPoint(r.x1, r.y1),
        b = viewPoint(r.x2, r.y2);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    });
    ctx.stroke();
    state.track.route.forEach((r, i) => {
      const a = viewPoint(r.x1, r.y1),
        b = viewPoint(r.x2, r.y2),
        angle = Math.atan2(b.y - a.y, b.x - a.x),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle - 0.5) * 7, y - Math.sin(angle - 0.5) * 7);
      ctx.lineTo(x, y);
      ctx.lineTo(x - Math.cos(angle + 0.5) * 7, y - Math.sin(angle + 0.5) * 7);
      ctx.stroke();
      marker(
        r.x1,
        r.y1,
        '#69dbe9',
        state.tool === 'route' ? 8 : 4,
        state.tool === 'route' ? i + 1 : undefined,
        state.selection?.kind === 'route' && state.selection.index === i
      );
    });
  }
  if ($('layer-objects').checked)
    state.track.objects.forEach((o, i) => {
      const selected =
        state.selection?.kind === 'object' && state.selection.index === i;
      marker(
        o.x,
        o.y,
        selected ? '#fff' : '#ffc88b',
        state.tool === 'object' ? 8 : 5,
        state.tool === 'object' ? o.id : undefined,
        selected
      );
      if (v.scale > 0.65 && state.sprites.has(o.id)) {
        const p = viewPoint(o.x, o.y),
          sprite = state.sprites.get(o.id);
        ctx.drawImage(sprite, p.x - 14, p.y - 40, 28, 28);
      }
    });
  if ($('layer-start').checked) {
    const p = viewPoint(state.track.start.x, state.track.start.y);
    ctx.strokeStyle = '#b5e18c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 15);
    ctx.lineTo(p.x, p.y - 18);
    ctx.stroke();
    ctx.fillStyle = '#b5e18c';
    ctx.fillRect(p.x, p.y - 18, 15, 11);
    marker(state.track.start.x, state.track.start.y, '#b5e18c', 4);
  }
  if (
    state.hover &&
    inside(state.hover) &&
    ['brush', 'rectangle', 'fill', 'eyedropper'].includes(state.tool) &&
    !state.space
  ) {
    const t = tilePoint(state.hover),
      size = state.tool === 'brush' ? Number($('brush-size').value) : 1;
    const from =
      state.gesture?.kind === 'rectangle'
        ? state.gesture.from
        : {
            x: t.x - Math.floor((size - 1) / 2),
            y: t.y - Math.floor((size - 1) / 2),
          };
    const end =
      state.gesture?.kind === 'rectangle'
        ? t
        : { x: from.x + size - 1, y: from.y + size - 1 };
    const p = viewPoint(
      Math.max(0, Math.min(from.x, end.x)) * 32,
      Math.max(0, Math.min(from.y, end.y)) * 32
    );
    const w =
        (Math.min(63, Math.max(from.x, end.x)) -
          Math.max(0, Math.min(from.x, end.x)) +
          1) *
        32 *
        v.scale,
      h =
        (Math.min(63, Math.max(from.y, end.y)) -
          Math.max(0, Math.min(from.y, end.y)) +
          1) *
        32 *
        v.scale;
    ctx.fillStyle = '#b5e18c30';
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeStyle = '#e0ffc2';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, w, h);
  }
  miniCtx.imageSmoothingEnabled = false;
  miniCtx.drawImage(surface, 0, 0, 160, 160);
  if ($('layer-route').checked) {
    miniCtx.beginPath();
    miniCtx.strokeStyle = '#69dbe9';
    miniCtx.lineWidth = 1;
    state.track.route.forEach((r) => {
      miniCtx.moveTo((r.x1 / 2048) * 160, (r.y1 / 2048) * 160);
      miniCtx.lineTo((r.x2 / 2048) * 160, (r.y2 / 2048) * 160);
    });
    miniCtx.stroke();
  }
  miniCtx.strokeStyle = '#fff';
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(
    (v.x / 2048) * 160,
    (v.y / 2048) * 160,
    (v.width / v.scale / 2048) * 160,
    (v.height / v.scale / 2048) * 160
  );
  $('zoom').textContent = `${Math.round(v.scale * 100)}%`;
}
function nearestNode(p, kind) {
  let best = -1,
    distance = 15;
  const list = kind === 'route' ? state.track.route : state.track.objects;
  list.forEach((o, i) => {
    const pt = viewPoint(
      kind === 'route' ? o.x1 : o.x,
      kind === 'route' ? o.y1 : o.y
    );
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d < distance) {
      best = i;
      distance = d;
    }
  });
  return best;
}
function nearestSegment(p) {
  let best = 0,
    distance = Infinity;
  state.track.route.forEach((r, i) => {
    const dx = r.x2 - r.x1,
      dy = r.y2 - r.y1,
      length = dx * dx + dy * dy;
    const t = length
      ? Math.max(
          0,
          Math.min(1, ((p.wx - r.x1) * dx + (p.wy - r.y1) * dy) / length)
        )
      : 0;
    const d = Math.hypot(p.wx - r.x1 - t * dx, p.wy - r.y1 - t * dy);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}
function pointerDown(e) {
  if (!state.track || state.gesture || ![0, 1, 2].includes(e.button)) return;
  if (
    state.pendingDraft &&
    !state.space &&
    state.tool !== 'pan' &&
    e.button === 0
  ) {
    status('Restore or discard the saved draft before editing.', true);
    return;
  }
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  const p = eventPoint(e);
  state.hover = p;
  if (state.space || state.tool === 'pan' || e.button !== 0) {
    state.gesture = {
      kind: 'pan',
      pointer: e.pointerId,
      screen: p,
      x: state.view.x,
      y: state.view.y,
    };
    canvas.classList.add('dragging');
  } else if (!inside(p)) return;
  else if (e.altKey || state.tool === 'eyedropper') {
    const t = tilePoint(p);
    selectTile(state.track.map[t.y * 64 + t.x]);
    status(`Picked tile ${state.tile}.`);
    return;
  } else {
    const before = snapshot(state.track),
      t = tilePoint(p),
      snapped = snapPoint(p);
    if (state.tool === 'fill') {
      floodFill(state.track.map, t.x, t.y, state.tile);
      committed(before, 'Filled connected tiles');
      return;
    }
    const g = {
      kind: state.tool,
      pointer: e.pointerId,
      before,
      from: t,
      last: t,
      end: t,
      changed: false,
    };
    if (g.kind === 'brush') {
      paintBrush(
        state.track.map,
        t.x,
        t.y,
        state.tile,
        Number($('brush-size').value)
      );
      state.surfaceDirty = true;
    }
    if (g.kind === 'route') {
      g.index = nearestNode(p, 'route');
      if (g.index < 0) {
        if (state.track.route.length >= 4096) {
          status('A track can contain up to 4096 waypoints.', true);
          return;
        }
        g.index = insertWaypoint(
          state.track,
          nearestSegment(p),
          snapped.x,
          snapped.y
        );
        g.inserted = true;
      }
      state.selection = { kind: 'route', index: g.index };
    }
    if (g.kind === 'object') {
      g.index = nearestNode(p, 'object');
      if (g.index < 0) {
        if (state.track.objects.length >= 4096) {
          status('A track can contain up to 4096 objects.', true);
          return;
        }
        if (!state.catalog.length) {
          status('This archive has no object catalogue.', true);
          return;
        }
        state.track.objects.push({
          id: state.objectId,
          x: snapped.x,
          y: snapped.y,
          unknown1: 0,
          unknown2: 0,
          unknown3: 0,
        });
        g.index = state.track.objects.length - 1;
      }
      state.selection = { kind: 'object', index: g.index };
    }
    if (g.kind === 'start') {
      state.track.start = snapped;
      state.selection = { kind: 'start' };
    }
    state.gesture = g;
    updateInspector();
  }
  canvas.setPointerCapture(e.pointerId);
  requestRender();
}
function pointerMove(e) {
  const p = eventPoint(e);
  state.hover = p;
  if (state.track && inside(p)) {
    const t = tilePoint(p);
    $('coordinates').textContent =
      `Tile ${t.x}, ${t.y} · Pixel ${Math.floor(p.wx)}, ${Math.floor(p.wy)}`;
  } else $('coordinates').textContent = '64 × 64 tiles · 2,048 × 2,048 pixels';
  const g = state.gesture;
  if (g && g.pointer === e.pointerId) {
    if (g.kind === 'pan') {
      state.view.x = g.x - (p.x - g.screen.x) / state.view.scale;
      state.view.y = g.y - (p.y - g.screen.y) / state.view.scale;
    } else {
      const t = tilePoint(p),
        snapped = snapPoint(p);
      g.end = t;
      if (g.kind === 'brush') {
        paintLine(
          state.track.map,
          g.last,
          t,
          state.tile,
          Number($('brush-size').value)
        );
        g.last = t;
        state.surfaceDirty = true;
      }
      if (g.kind === 'route')
        moveWaypoint(state.track, g.index, snapped.x, snapped.y);
      if (g.kind === 'object')
        Object.assign(state.track.objects[g.index], snapped);
      if (g.kind === 'start') state.track.start = snapped;
    }
  }
  requestRender();
}
function finishGesture(cancel = false) {
  const g = state.gesture;
  if (!g) return;
  state.gesture = null;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(g.pointer))
    canvas.releasePointerCapture(g.pointer);
  if (g.before) {
    if (cancel) {
      restore(state.track, g.before);
      state.selection = null;
      state.surfaceDirty = true;
      updateInspector();
      status('Gesture cancelled.');
    } else {
      if (g.kind === 'rectangle')
        for (
          let y = Math.min(g.from.y, g.end.y);
          y <= Math.max(g.from.y, g.end.y);
          y++
        )
          for (
            let x = Math.min(g.from.x, g.end.x);
            x <= Math.max(g.from.x, g.end.x);
            x++
          )
            state.track.map[y * 64 + x] = state.tile;
      const labels = {
        brush: 'Painted tiles',
        rectangle: 'Painted rectangle',
        route: g.inserted ? 'Inserted waypoint' : 'Moved waypoint',
        object: 'Placed or moved object',
        start: 'Moved start position',
      };
      committed(g.before, labels[g.kind]);
    }
  }
  requestRender();
}
function updateInspector() {
  const target = $('selection');
  target.replaceChildren();
  if (!state.track) {
    target.append(element('p', 'Load a track to see its details.', 'muted'));
    return;
  }
  const selection = state.selection;
  if (selection) {
    const kind = selection.kind,
      item =
        kind === 'route'
          ? state.track.route[selection.index]
          : kind === 'object'
            ? state.track.objects[selection.index]
            : state.track.start;
    if (!item) {
      state.selection = null;
      updateInspector();
      return;
    }
    target.append(
      element(
        'strong',
        kind === 'start'
          ? 'Start position'
          : `${kind === 'route' ? 'Waypoint' : 'Object'} ${selection.index + 1}`
      )
    );
    if (kind === 'object') {
      const types = element('select');
      types.setAttribute('aria-label', 'Selected object type');
      state.catalog.forEach((o) => {
        const option = element('option', `${o.id} · ${o.name}`);
        option.value = o.id;
        types.append(option);
      });
      types.value = item.id;
      types.onchange = () =>
        edit('Changed object type', () => {
          item.id = Number(types.value);
        });
      target.append(types);
    }
    const fields = element('div', undefined, 'coordinates-fields');
    for (const axis of ['x', 'y']) {
      const key = kind === 'route' ? `${axis}1` : axis,
        label = element('label', axis.toUpperCase()),
        input = element('input');
      input.type = 'number';
      input.min = 0;
      input.max = 2047;
      input.step = 1;
      input.value = item[key];
      input.onchange = () => {
        const n = Number(input.value);
        if (!Number.isSafeInteger(n) || n < 0 || n > 2047) {
          input.value = item[key];
          status('Coordinates must be whole pixels from 0 to 2047.', true);
          return;
        }
        edit(`Changed ${kind} position`, () => {
          if (kind === 'route')
            moveWaypoint(
              state.track,
              selection.index,
              axis === 'x' ? n : item.x1,
              axis === 'y' ? n : item.y1
            );
          else item[key] = n;
        });
      };
      label.append(input);
      fields.append(label);
    }
    target.append(fields);
    if (kind !== 'start') {
      const remove = element(
        'button',
        `Delete ${kind === 'route' ? 'waypoint' : 'object'}`,
        'danger'
      );
      remove.onclick = deleteSelection;
      target.append(remove);
      if (kind === 'object') {
        const copy = element('button', 'Duplicate object');
        copy.onclick = duplicateObject;
        target.append(copy);
      }
    }
    target.append(
      element(
        'p',
        kind === 'route'
          ? 'Connected neighboring segments move with this waypoint.'
          : kind === 'object'
            ? 'Coordinates are the original object anchor. Other attributes are preserved.'
            : 'Start position for the loaded track configuration.',
        'muted'
      )
    );
  } else if (state.tool === 'object') {
    const obj = state.catalog.find((o) => o.id === state.objectId);
    target.append(
      element(
        'strong',
        obj ? `Place ${obj.name.replace(/\.sp$/, '')}` : 'Select an object'
      )
    );
    target.append(
      element(
        'p',
        'Click to place a new object. Drag an existing marker to move it.',
        'muted'
      )
    );
  } else if (state.tool === 'route') {
    target.append(element('strong', `${state.track.route.length} waypoints`));
    target.append(
      element(
        'p',
        'Click a node to select it. Drag to move. Click elsewhere to insert a node into the nearest segment. Arrows show the driving direction.',
        'muted'
      )
    );
  } else if (state.tool === 'start') {
    state.selection = { kind: 'start' };
    updateInspector();
  } else {
    const wrap = element('div', undefined, 'selected-tile'),
      tile = element('canvas');
    tile.width = tile.height = 32;
    if (state.tiles[state.tile])
      tile.getContext('2d').drawImage(state.tiles[state.tile], 0, 0);
    const text = element('div');
    text.append(
      element('strong', `Tile ${state.tile}`),
      element(
        'small',
        state.tile < 54 ? 'Primary tileset' : 'Secondary tileset'
      )
    );
    wrap.append(tile, text);
    target.append(wrap);
    target.append(
      element(
        'p',
        `${state.track.map.filter((t) => t === state.tile).length} cells use this tile. Each cell is 32 × 32 pixels.`,
        'muted'
      )
    );
  }
  $('track-meta').textContent =
    `${state.track.config.tiles.map((n) => n.replace(/^a_|\.pcx$/g, '')).join(' + ')} · ${state.track.route.length} waypoints · ${state.track.objects.length} objects`;
}
function deleteSelection() {
  const selected = state.selection;
  if (!selected || selected.kind === 'start') return;
  edit(`Deleted ${selected.kind === 'route' ? 'waypoint' : 'object'}`, () => {
    if (selected.kind === 'route') deleteWaypoint(state.track, selected.index);
    else state.track.objects.splice(selected.index, 1);
    state.selection = null;
  });
}
function duplicateObject() {
  const selected = state.selection;
  if (selected?.kind !== 'object') return;
  if (state.track.objects.length >= 4096) {
    status('A track can contain up to 4096 objects.', true);
    return;
  }
  edit('Duplicated object', () => {
    const obj = state.track.objects[selected.index];
    state.track.objects.push({
      ...obj,
      x: clampPoint(obj.x + 32),
      y: clampPoint(obj.y + 32),
    });
    state.selection = { kind: 'object', index: state.track.objects.length - 1 };
  });
}
async function loadArchive(data) {
  finishGesture();
  const original = new Uint8Array(data),
    entries = parseDat(original),
    byName = new Map(entries.map((e) => [e.name, e]));
  const stems = entries
    .filter((e) => /^\d+\.gam$/i.test(e.name))
    .map((e) => e.name.split('.')[0])
    .sort((a, b) => Number(a) - Number(b));
  if (!stems.length)
    throw new Error('This archive contains no numbered Wacky Wheels tracks.');
  const tracks = new Map(
    stems.map((stem) => [stem, createTrack(byName, stem)])
  );
  for (const track of tracks.values())
    for (const name of track.config.tiles) {
      const img = decodePcx(byName.get(name)?.data ?? new Uint8Array());
      if (!img.indices || img.width < 320 || img.height < 192)
        throw new Error(`Unsupported tileset ${name}.`);
    }
  const catalog = byName.has('sprite.atr')
    ? parseAtr(byName.get('sprite.atr').data)
    : [];
  state.original = original;
  state.hash = fingerprint(original);
  state.entries = byName;
  state.tracks = tracks;
  state.stems = stems;
  state.catalog = catalog;
  state.objectId = 0;
  state.tile = 0;
  state.history = new Map(stems.map((stem) => [stem, new History()]));
  state.pendingDraft = null;
  clearTimeout(state.saveTimer);
  $('track').replaceChildren(
    ...stems.map((stem) => {
      const o = element('option', `Track ${stem}`);
      o.value = stem;
      return o;
    })
  );
  $('track').disabled = false;
  $('track-count').textContent = stems.length;
  selectTrack(stems[0]);
  $('draft-banner').hidden = true;
  try {
    const stored = localStorage.getItem(draftKey());
    if (stored) {
      state.pendingDraft = JSON.parse(stored);
      $('draft-banner').hidden = false;
    }
  } catch {
    state.storageFailed = true;
  }
}
async function runLoad(action) {
  if ($('open').disabled) return;
  finishGesture();
  if (
    state.original &&
    allChanges().size &&
    !confirm(
      'Opening another archive replaces the current session. Save your project first if you want to keep these changes. Continue?'
    )
  )
    return;
  const id = ++state.loadId;
  $('local').disabled = $('open').disabled = true;
  status('Opening game files…');
  try {
    const data = await action();
    if (id === state.loadId) await loadArchive(data);
  } catch (error) {
    status(error.message, true);
  } finally {
    if (id === state.loadId) $('local').disabled = $('open').disabled = false;
  }
}
// A picked or dropped archive is read through the same VFS as the dev-server one.
const readPicked = async (file) => (await openPicked([file]).openPath(file.name)).slice().buffer;
async function loadLocal() {
  await runLoad(async () => {
    let vfs;
    try { vfs = await openDevGame({ base: import.meta.env.BASE_URL }); } catch { throw new Error('Local loading needs the Vite development server. Use Open WACKY.DAT instead.'); }
    const path = vfs.list().find((n) => /(^|\/)wacky\.dat$/i.test(n));
    if (!path) throw new Error('Put your original WACKY.DAT inside game/, or use Open WACKY.DAT.');
    return (await vfs.openPath(path)).slice().buffer;
  });
}
function applyDraft(project) {
  if (!state.original)
    throw new Error(
      'Open the matching original WACKY.DAT first, then open the project.'
    );
  if (
    project?.format !== 'wacky-wheels-track-project' ||
    project.version !== 1 ||
    project.archive !== state.hash ||
    !project.tracks ||
    typeof project.tracks !== 'object' ||
    Array.isArray(project.tracks)
  )
    throw new Error(
      'This project does not match the loaded original archive, or has an unsupported format.'
    );
  const prepared = [];
  // Validate the whole draft before changing any track.
  for (const [stem, draft] of Object.entries(project.tracks)) {
    const originalTrack = state.tracks.get(stem);
    if (!originalTrack) throw new Error(`Unknown track ${stem}.`);
    const candidate = createTrack(state.entries, stem);
    restore(candidate, draft, state.catalog.length || 65536);
    prepared.push({ track: originalTrack, draft: snapshot(candidate) });
  }
  finishGesture();
  for (const { track, draft } of prepared) {
    const before = snapshot(track);
    restore(track, draft);
    state.history
      .get(track.stem)
      .commit(before, snapshot(track), 'Restored project');
  }
  state.pendingDraft = null;
  $('draft-banner').hidden = true;
  selectTrack(
    state.tracks.has(project.selected) ? project.selected : state.track.stem
  );
  autosave();
  const atmospheres = atmosphere.applyProject(project.atmosphere);
  atmosphere.trackEdited();
  status(
    `Restored ${prepared.length} edited track${prepared.length === 1 ? '' : 's'}${atmospheres ? ` and ${atmospheres} track atmosphere${atmospheres === 1 ? '' : 's'}` : ''}.`
  );
}
function saveProject() {
  if (!state.original) return;
  finishGesture();
  download(
    JSON.stringify(
      { ...draftData(), atmosphere: atmosphere.projectSection() }, // the tracks' atmospheres (not in the browser draft: they are kept as they change)
      null,
      2
    ),
    'wacky-wheels-tracks.json',
    'application/json'
  );
  status('Project saved. Reopen it with this same original WACKY.DAT.');
}
function exportDat() {
  if (!state.original) return;
  finishGesture();
  try {
    const changes = allChanges();
    if (!changes.size) return;
    const output = patchArchive(state.original, changes);
    parseDat(output);
    download(output, 'WACKY-EDITED.DAT');
    status(
      `Exported ${changes.size} changed assets across ${[...state.tracks.values()].filter((t) => trackChanges(t).size).length} tracks. Originals are untouched.`
    );
  } catch (error) {
    status(`Export failed: ${error.message}`, true);
  }
}
function navigateMini(e) {
  if (!state.track) return;
  const rect = mini.getBoundingClientRect(),
    v = state.view;
  v.x =
    Math.max(0, Math.min(2048, ((e.clientX - rect.left) / rect.width) * 2048)) -
    v.width / v.scale / 2;
  v.y =
    Math.max(0, Math.min(2048, ((e.clientY - rect.top) / rect.height) * 2048)) -
    v.height / v.scale / 2;
  requestRender();
}
$('open').onclick = $('welcome-open').onclick = () => $('file').click();
$('file').onchange = (e) => {
  const file = e.target.files[0];
  if (file) runLoad(() => readPicked(file));
  e.target.value = '';
};
$('local').onclick = loadLocal;
$('track').onchange = () => selectTrack($('track').value);
$('previous').onclick = () =>
  selectTrack(
    state.stems[
      (state.stems.indexOf(state.track.stem) + state.stems.length - 1) %
        state.stems.length
    ]
  );
$('next').onclick = () =>
  selectTrack(
    state.stems[
      (state.stems.indexOf(state.track.stem) + 1) % state.stems.length
    ]
  );
$('tiles-tab').onclick = () => setTab('tiles');
$('objects-tab').onclick = () => setTab('objects');
$('atmosphere-tab').onclick = () => setTab('atmosphere');
$('tile-search').oninput = $('used-only').onchange = updateTileVisibility;
$('object-search').oninput = () => {
  const query = $('object-search').value.toLowerCase();
  $('objects')
    .querySelectorAll('button')
    .forEach((b) => (b.hidden = !b.title.toLowerCase().includes(query)));
};
document
  .querySelectorAll('[data-tool]')
  .forEach((button) => (button.onclick = () => setTool(button.dataset.tool)));
$('undo').onclick = () => undo();
$('redo').onclick = () => undo(true);
$('fit').onclick = fit;
$('zoom-in').onclick = () => zoom(1.3);
$('zoom-out').onclick = () => zoom(1 / 1.3);
for (const id of [
  'layer-grid',
  'layer-route',
  'layer-objects',
  'layer-start',
  'brush-size',
])
  $(id).onchange = requestRender;
$('save-draft').onclick = saveProject;
$('export').onclick = exportDat;
$('import-draft').onclick = () => {
  if (!state.original) {
    status('Open the original WACKY.DAT before opening a saved project.', true);
    return;
  }
  $('project-file').click();
};
$('project-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (file)
    try {
      if (file.size > 10e6) throw new Error('Project file is too large.');
      applyDraft(JSON.parse(await file.text()));
    } catch (error) {
      status(error.message, true);
    }
  e.target.value = '';
};
$('restore-draft').onclick = () => {
  try {
    applyDraft(state.pendingDraft);
  } catch (error) {
    status(error.message, true);
  }
};
$('discard-draft').onclick = () => {
  try {
    localStorage.removeItem(draftKey());
  } catch {}
  state.pendingDraft = null;
  $('draft-banner').hidden = true;
  status('Saved draft discarded.');
};
$('close-route').onclick = () =>
  edit('Closed AI route loop', () => {
    const route = state.track.route;
    if (route.length < 2) return;
    const a = route.at(-1),
      b = route[0];
    Object.assign(a, routeSegment(a.x1, a.y1, b.x1, b.y1));
  });
$('export-map').onclick = () => {
  finishGesture();
  if (state.surfaceDirty) rebuildSurface();
  surface.toBlob((blob) => {
    if (blob) download(blob, `track-${state.track.stem}.png`, 'image/png');
  });
};
$('reset').onclick = () => $('reset-dialog').showModal();
$('cancel-reset').onclick = () => $('reset-dialog').close();
$('confirm-reset').onclick = () => {
  $('reset-dialog').close();
  edit('Reset track to original', () => {
    const source = createTrack(state.entries, state.track.stem);
    restore(state.track, snapshot(source));
    state.selection = null;
  });
};
function toggleSettings(open) {
  $('inspector').classList.toggle('mobile-open', open);
  $('settings').setAttribute('aria-expanded', String(open));
  if (open) $('close-settings').focus();
  else $('settings').focus();
}
$('settings').onclick = () =>
  toggleSettings(!$('inspector').classList.contains('mobile-open'));
$('close-settings').onclick = () => toggleSettings(false);
$('help').onclick = () => $('help-dialog').showModal();
$('close-help').onclick = () => $('help-dialog').close();
canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerup', (e) => {
  if (state.gesture?.pointer === e.pointerId) finishGesture();
});
canvas.addEventListener('pointercancel', () => finishGesture(true));
canvas.addEventListener('lostpointercapture', () => finishGesture());
canvas.addEventListener('pointerleave', () => {
  if (!state.gesture) {
    state.hover = null;
    requestRender();
  }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!state.track) return;
    e.preventDefault();
    finishGesture();
    const p = eventPoint(e);
    zoom(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.003), p.x, p.y);
  },
  { passive: false }
);
mini.addEventListener('pointerdown', (e) => {
  finishGesture();
  e.preventDefault();
  mini.setPointerCapture(e.pointerId);
  navigateMini(e);
});
mini.addEventListener('pointermove', (e) => {
  if (mini.hasPointerCapture(e.pointerId)) navigateMini(e);
});
mini.addEventListener('pointerup', (e) => {
  if (mini.hasPointerCapture(e.pointerId))
    mini.releasePointerCapture(e.pointerId);
});
mini.addEventListener('keydown', (e) => {
  const delta = {
    ArrowLeft: [-128, 0],
    ArrowRight: [128, 0],
    ArrowUp: [0, -128],
    ArrowDown: [0, 128],
  }[e.key];
  if (!delta) return;
  e.preventDefault();
  state.view.x += delta[0];
  state.view.y += delta[1];
  requestRender();
});
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  const key = e.key.toLowerCase(),
    modifier = e.metaKey || e.ctrlKey;
  if (modifier && key === 's') {
    e.preventDefault();
    if (e.target.matches('input[type=number]')) e.target.blur();
    saveProject();
    return;
  }
  if (e.target.closest('input,select,textarea')) return;
  if (key === ' ' && !modifier) {
    e.preventDefault();
    state.space = true;
    canvas.classList.add('panning');
    return;
  }
  if (key === 'escape') {
    finishGesture(true);
    state.selection = null;
    updateInspector();
    requestRender();
    return;
  }
  if (modifier) {
    if (key === 'z' || key === 'y') {
      e.preventDefault();
      undo(e.shiftKey || key === 'y');
    }
    if (key === 's') {
      e.preventDefault();
      saveProject();
    }
    if (key === 'd') {
      e.preventDefault();
      duplicateObject();
    }
    return;
  }
  const tools = {
    b: 'brush',
    r: 'rectangle',
    f: 'fill',
    i: 'eyedropper',
    v: 'route',
    o: 'object',
    s: 'start',
    h: 'pan',
  };
  if (tools[key]) {
    e.preventDefault();
    setTool(tools[key]);
  }
  if (key === '0') fit();
  if (key === '+' || key === '=') zoom(1.3);
  if (key === '-') zoom(1 / 1.3);
  if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    deleteSelection();
  }
  if (key === '?') $('help-dialog').showModal();
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    state.space = false;
    canvas.classList.toggle('panning', state.tool === 'pan');
  }
});
window.addEventListener('blur', () => {
  state.space = false;
  finishGesture();
  canvas.classList.toggle('panning', state.tool === 'pan');
});
window.addEventListener('beforeunload', (e) => {
  if (!state.original) return;
  finishGesture();
  if (allChanges().size) {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(draftData()));
    } catch {}
    e.preventDefault();
    e.returnValue = '';
  }
});
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  $('drop-hint').hidden = false;
});
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) e.preventDefault();
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('drop-hint').hidden = true;
  }
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop-hint').hidden = true;
  const files = [...e.dataTransfer.files],
    file = files.find((f) => /\.(dat|lid)$/i.test(f.name));
  if (file) runLoad(() => readPicked(file));
  else if (files[0]?.name.endsWith('.json'))
    files[0].text().then((text) => {
      try {
        applyDraft(JSON.parse(text));
      } catch (error) {
        status(error.message, true);
      }
    });
  else status('Drop WACKY.DAT or a saved track project (.json).', true);
});
new ResizeObserver(resize).observe($('viewport'));
$('local').hidden = !import.meta.env.DEV;
setTool('brush');
if (import.meta.env.DEV) loadLocal();
