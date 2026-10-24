import { LIGHTING_PRESETS } from './lighting.js';
import { KART_NAMES } from './mesh.js';

export function mountVoxelControls(voxels, changed) {
  const box = document.createElement('div'); box.className = 'voxel-controls';
  box.innerHTML = `<label><input type="checkbox" aria-label="Live 3D voxel karts"> Live 3D voxel karts (prototype)</label>
    <label>Renderer <select aria-label="Track renderer"><option value="classic">Current renderer</option><option value="3d">3D tracks (prototype)</option></select></label>
    <label><input type="checkbox" aria-label="Voxel terrain (all tracks)"> Voxel terrain (all tracks)</label>
    <label><input type="checkbox" aria-label="Off-road dust and dirt"> Off-road dust and dirt</label>
    <label><input type="checkbox" aria-label="Panorama and detailed sky"> Panorama and detailed sky</label>
    <label><input type="checkbox" aria-label="Reduce distant shimmer"> Reduce distant shimmer</label>
    <label>3D scenery <select aria-label="3D scenery models"><option value="procedural">Procedural + original pickups</option><option value="studio">Voxel Studio (all tracks)</option></select></label>
    <label>Water <select aria-label="3D water"><option value="waves">3D waves, wakes + splashes</option><option value="flat">Flat water comparison</option></select></label>
    <label>Water trails <select aria-label="Kart water trails"><option value="wakes">Wakes and ripples</option><option value="splash">Splash-only comparison</option></select></label>
    <label><input type="checkbox" aria-label="Dive bubbles and splash"> Dive bubbles and splash</label>
    <label>Reflections <select aria-label="Water reflections"><option value="scene">Sky, karts and scenery</option><option value="sky">Sky color only comparison</option></select></label>
    <label>3D weapons <select aria-label="3D weapon models"><option value="studio">Voxel Studio</option><option value="procedural">Procedural comparison</option></select></label>
    <label><input type="checkbox" aria-label="Impact camera shake"> Impact camera shake</label>
    <label><input type="checkbox" aria-label="Kart headlights"> Kart headlights</label>
    <label><input type="checkbox" aria-label="Tail and brake lights"> Tail and brake lights</label>
    <label><input type="checkbox" aria-label="Lamp glow"> Lamp glow</label>
    <label><input type="checkbox" aria-label="Headlight shadows"> Headlight shadows</label>
    <label><input type="checkbox" aria-label="Smooth voxel motion"> Smooth voxel motion</label>
    <label>Load kart models <input type="file" accept=".json" multiple aria-label="Load voxel kart models"></label>
    <label>Lighting <select aria-label="Voxel lighting preset">${Object.entries(LIGHTING_PRESETS).map(([key, p]) => `<option value="${key}">${p.label}</option>`).join('')}</select></label>
    <span role="status"></span>`;
  document.getElementById('stage').prepend(box);
  const toggle = box.querySelector('[type=checkbox]'), files = box.querySelector('[type=file]'), status = box.querySelector('[role=status]');
  const lighting = box.querySelector('[aria-label="Voxel lighting preset"]');
  const headlights = box.querySelector('[aria-label="Kart headlights"]');
  headlights.checked = voxels.headlights;
  headlights.addEventListener('change', () => { voxels.headlights = headlights.checked; headlights.blur(); });
  for (const [label,key] of [['Reduce distant shimmer','reduceShimmer'],['Panorama and detailed sky','richSky'],['Off-road dust and dirt','offroadDust'],['Voxel terrain (all tracks)','terrain'],['Dive bubbles and splash','diveWaterEffects'],['Lamp glow','lampGlow'],['Tail and brake lights','taillights'],['Headlight shadows','headlightShadows'],['Smooth voxel motion','smooth']]) {
    const control=box.querySelector(`[aria-label="${label}"]`);control.checked=voxels[key];
    control.addEventListener('change',()=>{voxels[key]=control.checked;control.blur();});
  }
  const scenery = box.querySelector('[aria-label="3D scenery models"]');
  scenery.value = voxels.scenery;
  scenery.addEventListener('change', () => { voxels.scenery = scenery.value; scenery.blur(); });
  const water = box.querySelector('[aria-label="3D water"]');
  water.value = voxels.water;
  water.addEventListener('change', () => { voxels.water = water.value; water.blur(); });
  const wakes = box.querySelector('[aria-label="Kart water trails"]');
  wakes.value = voxels.wakes ? 'wakes' : 'splash';
  wakes.addEventListener('change', () => { voxels.wakes = wakes.value === 'wakes'; wakes.blur(); });
  const reflections = box.querySelector('[aria-label="Water reflections"]');
  reflections.value = voxels.reflections ? 'scene' : 'sky';
  reflections.addEventListener('change', () => { voxels.reflections = reflections.value === 'scene'; reflections.blur(); });
  const weapons = box.querySelector('[aria-label="3D weapon models"]');
  weapons.value = voxels.weapons;
  weapons.addEventListener('change', () => { voxels.weapons = weapons.value; weapons.blur(); });
  const shake = box.querySelector('[aria-label="Impact camera shake"]');
  try {
    const saved = localStorage.getItem('wacky.voxel.cameraShake');
    voxels.cameraShake = saved === null ? !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches : saved !== 'off';
  } catch { voxels.cameraShake = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  shake.checked = voxels.cameraShake;
  shake.addEventListener('change', () => {
    voxels.cameraShake = shake.checked;
    try { localStorage.setItem('wacky.voxel.cameraShake', shake.checked ? 'on' : 'off'); } catch { /* Storage is optional. */ }
    shake.blur();
  });
  const renderer = box.querySelector('[aria-label="Track renderer"]');
  renderer.value = voxels.track ? '3d' : 'classic';
  renderer.addEventListener('change', () => { voxels.track = renderer.value === '3d'; if (voxels.track) voxels.enabled = true; changed(); update(); renderer.blur(); });
  try { voxels.lighting = localStorage.getItem('wacky.voxel.lighting') ?? 'toy'; } catch { /* Storage is optional. */ }
  lighting.value = voxels.lighting;
  lighting.addEventListener('change', () => {
    voxels.lighting = lighting.value;
    try { localStorage.setItem('wacky.voxel.lighting', voxels.lighting); } catch { /* Storage is optional. */ }
    // Uniforms update on the next draw, including while paused; no reset or mesh rebuild.
    lighting.blur();
  });
  const update = (message = '') => {
    toggle.checked = voxels.enabled;
    renderer.value = voxels.track ? '3d' : 'classic';
    status.textContent = message || `${voxels.count}/8 models loaded. ${voxels.enabled ? 'Live meshes enabled. 3D track needs all 8 models: all tracks in single-player races, including fly-in, countdown, crashes and pit sequences. Other modes use the current renderer.' : 'Original kart rendering.'}`;
  };
  toggle.addEventListener('change', () => { voxels.enabled = toggle.checked; changed(); update(voxels.enabled && !voxels.available ? 'WebGL 2 unavailable: original karts retained.' : ''); toggle.blur(); });
  files.addEventListener('change', async () => {
    const errors = [];
    for (const file of files.files) {
      try {
        if (file.size > 16 * 1024 * 1024) throw new Error('Model exceeds 16 MB.');
        const slot = KART_NAMES.findIndex(name => file.name.toLowerCase() === `${name}-kart.json`);
        if (slot < 0) throw new Error('Use a named file such as panda-kart.json or tiger-kart.json.');
        voxels.install(slot, JSON.parse(await file.text()));
      } catch (e) { errors.push(`${file.name}: ${e.message}`); }
    }
    changed(); update(errors.join(' ')); files.value = '';
  });
  async function local() {
    await Promise.all(KART_NAMES.map(async (name, slot) => {
      try { const response = await fetch(`${import.meta.env.BASE_URL}voxel-karts/${name}-kart.json`); if (!response.ok) throw Error('Model unavailable'); voxels.install(slot, await response.json()); } catch (error) { console.warn(`Could not load ${name} kart`, error); }
    }));
    if (import.meta.env.DEV) {
      await Promise.all(KART_NAMES.map(async (name, slot) => {
        try { const response = await fetch(`${import.meta.env.BASE_URL}__voxels/${name}-kart.json`); if (response.ok) voxels.install(slot, await response.json()); } catch { /* Local files are optional; the picker works in production. */ }
      }));
    }
    changed(); update();
  }
  update(); void local();
  return { update };
}
