// The track editor's Atmosphere tab (docs/enhancements.md, Stage 3; docs/track-editor.md): the atmosphere of the selected track (the sun, the
// fog, the clouds, the far range, the water, the lighting) and a race view of the track as it is being edited, drawn by the Enhanced presentation over the original
// art. The atmosphere is kept in this browser by track number (src/enhance/atmosphere.js), apart from the game files and the editor's own
// draft: the playtest page draws the track with it. Nothing here changes a track's game files.
import { normalizeAtmosphere, defaultAtmosphere, isDefaultAtmosphere, loadAtmospheres, saveAtmosphere, saveAtmospheres } from './enhance/atmosphere.js';
import { ATMOSPHERE, GRADES, RANGE, PRESETS, LEVELS } from './enhance/config.js';
import { normalize } from './enhance/settings.js';
import { createRacePreview } from './viewer-preview.js';
import { patchArchive, trackChanges } from './track-model.js';

const GRADE_LABELS = {
  none: 'None',
  dawn: 'Dawn',
  sunset: 'Sunset',
  dusk: 'Dusk',
  night: 'Night',
  overcast: 'Overcast',
};
const RANGE_LABELS = { hills: 'Hills', mountains: 'Mountains' };
const OWN_SUN = { sunAngle: LEVELS.sunAngle, sunHeight: 0.5 }; // where the sliders start when a track gets its own sun: the game setting's direction, half way up
const STRIP_FOG = '#a0b4c8'; // where the colour picker starts when a track gets its own fog colour
const WIDTH = 320;
const HEIGHT = 200;

// `$` finds an element by id; `context()` gives { original (the archive's bytes), track (the selected track's model) }; `status(text, bad)`
// reports to the editor's status line.
export function createAtmospherePanel({ $, context, status }) {
  const canvas = $('atmo-canvas'),
    g = canvas.getContext('2d'),
    image = g.createImageData(WIDTH, HEIGHT),
    original = new Uint8ClampedArray(WIDTH * HEIGHT * 4),
    enhanced = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const settings = normalize(PRESETS.enhanced);
  const CONTROLS = ['atmo-grade', 'atmo-gradeStrength', 'atmo-clouds', 'atmo-cloudSpeed', 'atmo-rangeShape', 'atmo-range', 'atmo-water', 'atmo-ownSun', 'atmo-sunAngle', 'atmo-sunHeight', 'atmo-ownFog', 'atmo-fogTint', 'atmo-fog', 'atmo-reset', 'atmo-play', 'atmo-original', 'atmo-moment'];
  let local = loadAtmospheres(), // this session's atmospheres: what the browser keeps, and what it did not keep (`unsaved`)
    values = defaultAtmosphere(),
    stem = null,
    visible = false,
    preview = null,
    built = null, // what the preview was built from: { dat, stem, key, edited } (the key of the track's changed files)
    rebuildTimer = 0,
    rebuildPending = false,
    seekTimer = 0,
    playing = false,
    frame = 0,
    last = 0,
    accumulator = 0;
  const unsaved = new Set();

  // The browser's atmospheres, with those it did not keep in this session on top.
  function sync() {
    local = { ...loadAtmospheres(), ...Object.fromEntries([...unsaved].filter((n) => local[n]).map((n) => [n, local[n]])) };
  }
  const atmosphereOf = (name) =>
    name === stem ? values : (local[name] ?? defaultAtmosphere());
  const changesKey = (track) =>
    [...trackChanges(track)]
      .map(([name, data]) => `${name}:${data.length}:${hash(data)}`)
      .join('|');

  // ---- the controls
  $('atmo-grade').replaceChildren(
    ...GRADES.names.map((name) => new Option(GRADE_LABELS[name], name))
  );
  $('atmo-rangeShape').replaceChildren(
    ...RANGE.names.map((name) => new Option(RANGE_LABELS[name], name))
  );
  function showValues() {
    const a = values,
      none = stem === null;
    for (const id of CONTROLS) $(id).disabled = none;
    if (none) {
      $('atmo-note').textContent = 'Open WACKY.DAT first: an atmosphere belongs to a track.';
      return;
    }
    $('atmo-grade').value = a.grade;
    $('atmo-gradeStrength').value = String(a.gradeStrength);
    $('atmo-gradeStrength').disabled = a.grade === 'none';
    $('atmo-clouds').value = String(a.clouds);
    $('atmo-cloudSpeed').value = String(a.cloudSpeed);
    $('atmo-cloudSpeed').disabled = a.clouds === 0;
    $('atmo-rangeShape').value = a.rangeShape;
    $('atmo-rangeShape').disabled = a.range === 0;
    $('atmo-range').value = String(a.range);
    $('atmo-water').value = String(a.water);
    const ownSun = a.sunAngle !== null || a.sunHeight !== null;
    $('atmo-ownSun').checked = ownSun;
    $('atmo-sunAngle').value = String(a.sunAngle ?? OWN_SUN.sunAngle);
    $('atmo-sunHeight').value = String(a.sunHeight ?? OWN_SUN.sunHeight);
    $('atmo-sunAngle').disabled = !ownSun;
    $('atmo-sunHeight').disabled = !ownSun;
    $('atmo-ownFog').checked = a.fogTint !== null;
    $('atmo-fogTint').value = a.fogTint ?? STRIP_FOG;
    $('atmo-fogTint').disabled = a.fogTint === null;
    $('atmo-fog').value = String(a.fog);
    $('atmo-fog').max = String(ATMOSPHERE.fogMax);
    const count = Object.keys(local).length;
    $('atmo-note').textContent = `Track ${stem}'s atmosphere is kept in this browser and drawn by the playtest page when its Enhanced graphics have sky layers, moving water, track lighting, fog or sun shadows on. ${count === 1 ? '1 track has its own atmosphere' : `${count} tracks have their own atmosphere`}.${unsaved.size ? ' This browser did not keep some of them: they stay for this session, and Save project puts them in the project file.' : ''}`;
  }
  function set(next) {
    if (stem === null) return;
    values = normalizeAtmosphere(next);
    if (isDefaultAtmosphere(values)) delete local[stem];
    else local[stem] = values;
    if (saveAtmosphere(stem, values)) unsaved.delete(stem);
    else {
      unsaved.add(stem);
      status('This browser did not keep the atmosphere: it stays for this session, and Save project puts it in the project file.', true);
    }
    showValues();
    draw();
  }
  const levelInput = (id, key) =>
    $(id).addEventListener('input', (e) =>
      set({ ...values, [key]: Number(e.target.value) })
    );
  levelInput('atmo-gradeStrength', 'gradeStrength');
  levelInput('atmo-clouds', 'clouds');
  levelInput('atmo-cloudSpeed', 'cloudSpeed');
  levelInput('atmo-range', 'range');
  levelInput('atmo-water', 'water');
  levelInput('atmo-sunAngle', 'sunAngle');
  levelInput('atmo-sunHeight', 'sunHeight');
  levelInput('atmo-fog', 'fog');
  // A changed select or box gives up the focus, as the panel's buttons do: a focused one would take Space and the editor's letters.
  $('atmo-grade').addEventListener('change', (e) => {
    set({ ...values, grade: e.target.value });
    e.target.blur();
  });
  $('atmo-rangeShape').addEventListener('change', (e) => {
    set({ ...values, rangeShape: e.target.value });
    e.target.blur();
  });
  $('atmo-ownSun').addEventListener('change', (e) => {
    set(
      e.target.checked
        ? { ...values, ...OWN_SUN }
        : { ...values, sunAngle: null, sunHeight: null }
    );
    e.target.blur();
  });
  $('atmo-ownFog').addEventListener('change', (e) => {
    set({ ...values, fogTint: e.target.checked ? $('atmo-fogTint').value : null });
    e.target.blur();
  });
  $('atmo-fogTint').addEventListener('input', (e) =>
    set({ ...values, fogTint: e.target.value })
  );
  $('atmo-reset').addEventListener('click', (e) => {
    set(defaultAtmosphere());
    e.currentTarget.blur();
  });

  // ---- the race view
  function caption(text = null) {
    $('atmo-caption').textContent =
      text ??
      (built
        ? `Track ${built.stem}${built.edited ? ', as edited' : ''}: the pilot drives the computer cars' route. ${$('atmo-original').checked ? 'The original picture.' : 'The Enhanced graphics with this atmosphere.'}`
        : '');
  }
  function build() {
    const { original: dat, track } = context();
    if (!dat || !track) return false;
    if (!track.route.length) {
      preview = null;
      built = null;
      caption("The race view needs the computer cars' route: draw at least one waypoint.");
      g.clearRect(0, 0, WIDTH, HEIGHT);
      return false;
    }
    const key = changesKey(track);
    if (preview && built?.dat === dat && built.stem === track.stem && built.key === key) return true;
    try {
      const changes = trackChanges(track);
      preview = createRacePreview(
        changes.size ? patchArchive(dat, changes) : dat,
        track.stem,
        { atmosphere: atmosphereOf, demoControls: false }
      );
      built = { dat, stem: track.stem, key, edited: changes.size > 0 };
      preview.seek(Number($('atmo-moment').value), settings);
      caption();
      return true;
    } catch (error) {
      preview = null;
      built = null;
      caption(`The race view could not run this track: ${error.message}`);
      return false;
    }
  }
  function draw(alpha = 1) {
    if (!visible || !preview) return;
    preview.draw({ alpha, hud: false, detail: 1 }, original, enhanced);
    image.data.set($('atmo-original').checked ? original : enhanced);
    g.putImageData(image, 0, 0);
  }
  // Builds the view again when the tab is shown and the track or its files changed (after a short wait, while edits come in).
  function refreshSoon(delay = 400) {
    if (!visible) return;
    rebuildPending = true;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      rebuildPending = false;
      if (build()) draw();
    }, delay);
  }
  $('atmo-moment').addEventListener('input', () => {
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      if (rebuildPending) { // an edit is waiting: build first, at the new moment
        clearTimeout(rebuildTimer);
        rebuildPending = false;
        if (build()) draw();
        return;
      }
      if (!preview) return;
      preview.seek(Number($('atmo-moment').value), settings);
      draw();
    }, 120);
  });
  $('atmo-original').addEventListener('change', (e) => {
    caption();
    draw();
    e.target.blur();
  });
  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    $('atmo-play').textContent = 'Play';
  }
  function tick(now) {
    if (!playing || !visible || !preview) {
      stop();
      return;
    }
    accumulator += Math.min(now - last, 250); // at most a quarter second at a time
    last = now;
    while (accumulator >= preview.tickMs) {
      preview.step();
      accumulator -= preview.tickMs;
    }
    draw(accumulator / preview.tickMs);
    frame = requestAnimationFrame(tick);
  }
  $('atmo-play').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (playing) {
      stop();
      return;
    }
    if (!build()) return;
    playing = true;
    accumulator = 0;
    last = performance.now();
    $('atmo-play').textContent = 'Pause';
    frame = requestAnimationFrame(tick);
  });
  showValues();

  return {
    // The tab is shown or hidden.
    show() {
      visible = true;
      sync();
      if (stem !== null) values = normalizeAtmosphere(local[stem] ?? defaultAtmosphere());
      showValues();
      refreshSoon(0);
    },
    hide() {
      visible = false;
      stop();
      clearTimeout(seekTimer);
      clearTimeout(rebuildTimer);
      rebuildPending = false;
    },
    // Another track is selected (or another archive was opened).
    setTrack(next) {
      stem = next;
      sync();
      values = normalizeAtmosphere(local[stem] ?? defaultAtmosphere());
      stop();
      showValues();
      refreshSoon(0);
    },
    // The selected track's files changed (an edit, an undo, a restored draft).
    trackEdited() {
      refreshSoon();
    },
    // The project file's section: every track's atmosphere of this session (the browser's, and those it did not keep).
    projectSection() {
      sync();
      return { ...local };
    },
    // A project's section: its atmospheres are kept (over this browser's for the same tracks). Returns how many tracks it had.
    applyProject(section) {
      if (!section || typeof section !== 'object' || Array.isArray(section)) return 0;
      const tracks = Object.fromEntries(
        Object.entries(section)
          .filter(([name]) => /^\d+$/.test(name))
          .map(([name, a]) => [name, normalizeAtmosphere(a)])
      );
      sync();
      local = { ...local, ...tracks };
      for (const name of Object.keys(tracks)) if (isDefaultAtmosphere(local[name])) delete local[name];
      if (saveAtmospheres(local)) unsaved.clear();
      else for (const name of Object.keys(tracks)) unsaved.add(name);
      if (stem !== null) values = normalizeAtmosphere(local[stem] ?? defaultAtmosphere());
      showValues();
      draw();
      return Object.keys(tracks).length;
    },
  };
}

// A short fingerprint of a file's bytes (FNV-1a), to tell whether the preview's archive is still the track's.
function hash(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193);
  return (h >>> 0).toString(16);
}
