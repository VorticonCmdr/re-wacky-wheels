import { wheelRig } from './wheels.js';
// Editable Voxel Studio JSON is the source; only exposed faces reach the GPU.
export const KART_NAMES = ['panda', 'camel', 'moose', 'pelican', 'shark', 'raccoon', 'elephant', 'tiger'];
export function voxelMesh(project) {
  const { size, voxels } = project ?? {};
  if (!Number.isInteger(size) || size < 1 || size > 128 || !Array.isArray(voxels) || !voxels.length || voxels.length > Math.min(size ** 3, 65536)) throw new Error('Expected a nonempty Voxel Studio model (size 1–128, at most 65,536 voxels).');
  const occupied = new Map(), key = (x, y, z) => x + size * (y + size * z);
  const min = [size, size, size], max = [0, 0, 0];
  for (const v of voxels) {
    if (!Array.isArray(v) || v.length !== 6 || v.some((n, i) => !Number.isInteger(n) || n < 0 || n >= (i < 3 ? size : 256))) throw new Error('Invalid voxel position or RGB color.');
    const [x, y, z] = v, k = key(x, y, z);
    if (occupied.has(k)) throw new Error('Duplicate voxel position.');
    occupied.set(k, v);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[a]); max[a] = Math.max(max[a], v[a] + 1); }
  }
  const origin = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  const rig = wheelRig(size, occupied, key, origin), groups = Array.from({length: rig ? 5 : 1}, () => []);
  let faces = 0;
  for (const v of occupied.values()) for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const part = rig?.groups.get(key(...v.slice(0, 3))) ?? 0, data = groups[part];
    const neighbor = v.slice(0, 3); neighbor[axis] += sign;
    if (neighbor.every(n => n >= 0 && n < size) && occupied.has(key(...neighbor)) && (rig?.groups.get(key(...neighbor)) ?? 0) === part) continue;
    if (++faces > 200000) throw new Error('Model exceeds 200,000 exposed faces.');
    const a = (axis + 1) % 3, b = (axis + 2) % 3, corners = [];
    for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const p = v.slice(0, 3), normal = [0, 0, 0]; p[axis] += sign > 0 ? 1 : 0; p[a] += u; p[b] += w; normal[axis] = sign;
      // Three cells outside the face determine corner occlusion. Two touching
      // sides fully occlude a corner; otherwise the diagonal contributes too.
      const sideA = neighbor.slice(), sideB = neighbor.slice(), diagonal = neighbor.slice();
      sideA[a] += u ? 1 : -1; sideB[b] += w ? 1 : -1;
      diagonal[a] += u ? 1 : -1; diagonal[b] += w ? 1 : -1;
      const solid = q => q.every(n => n >= 0 && n < size) && occupied.has(key(...q)) && (rig?.groups.get(key(...q)) ?? 0) === part;
      const sa = Number(solid(sideA)), sb = Number(solid(sideB));
      const ao = sa && sb ? 0 : 1 - (sa + sb + Number(solid(diagonal))) / 3;
      corners.push([...p.map((n, i) => n - origin[i]), ...normal, ...v.slice(3).map(n => n / 255), ao]);
    }
    for (const i of (corners[0][9] + corners[2][9] > corners[1][9] + corners[3][9] ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3])) data.push(...corners[i]);
  }
  const data = [], parts = [];
  for (let i = 0; i < groups.length; i++) {
    parts.push({ first: data.length / 10, count: groups[i].length / 10, ...(i ? rig.parts[i - 1] : { pivot: [0, 0, 0], front: false, wheel: false }) });
    for (const value of groups[i]) data.push(value);
  }
  return { parts, wheelRadius: rig?.radius ?? 0, wheelbase: rig?.wheelbase ?? 0, vertices: new Float32Array(data), count: data.length / 10, bounds: max.map((n, i) => n - min[i]), voxels: occupied.size };
}
