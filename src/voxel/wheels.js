// The original 48-cell and replacement 32-cell kart constructions.
// Require all four complete tire assemblies before separating anything; unrelated
// imported models remain rigid rather than having arbitrary dark voxels animated.
const CENTRES = [[8, 6, 12], [39, 6, 12], [8, 6, 34], [39, 6, 34]];
const COLORS = new Set(['25,28,29', '59,65,65', '146,154,153', '61,68,68']);
export function wheelRig(size, occupied, key, origin) {
  if (size !== 48 && size !== 32) return null;
  const compact = size === 32;
  const centres = compact ? [[3, 4, 6], [28, 4, 6], [3, 4, 25], [28, 4, 25]] : CENTRES;
  const colors = compact ? new Set(['24,27,29', '53,57,59', '154,164,166', '219,226,222']) : COLORS;
  const radius = compact ? 4.4 : 5.7, halfWidth = compact ? 2 : 4, extent = compact ? 4 : 5;
  const groups = new Map();
  for (let i = 0; i < centres.length; i++) {
    const [cx, cy, cz] = centres[i];
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) for (let y = cy - extent; y <= cy + extent; y++) for (let z = cz - extent; z <= cz + extent; z++) {
      if ((y - cy) ** 2 + (z - cz) ** 2 > radius ** 2) continue;
      const k = key(x, y, z), v = occupied.get(k);
      if (!v || !colors.has(v.slice(3).join(','))) return null;
      groups.set(k, i + 1);
    }
  }
  return { groups, radius, wheelbase: compact ? 19 : 22, parts: centres.map((p, i) => ({ pivot: p.map((v, a) => v + .5 - origin[a]), front: i >= 2, wheel: true })) };
}

const TAU = Math.PI * 2;
const wrap = n => n - 65536 * Math.round(n / 65536);
const clamp = n => Math.max(-.45, Math.min(.45, n));
// Distance-driven presentation state, keyed by racer rather than model slot.
// Sampling never changes phase: pause/redraw/preset changes cannot spin wheels.
export function createWheelMotion() {
  const poses = new Map();
  let world = null, tick = -1, alpha = 1;
  return {
    begin(nextWorld, nextTick, blend = 1) {
      if (nextWorld !== world || nextTick < tick) poses.clear();
      world = nextWorld; tick = nextTick; alpha = Math.max(0, Math.min(1, blend));
    },
    pose(id, point, forward, radius, wheelbase, steering = null) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return { spin: 0, steer: steering ?? 0 };
      let p = poses.get(id);
      if (!p || p.tick !== tick) {
        const dx = p ? wrap(point.x - p.x) : 0, dy = p ? wrap(point.y - p.y) : 0, distance = Math.hypot(dx, dy);
        const continuous = p && tick - p.tick === 1 && distance <= 192;
        const start = continuous ? p.end % TAU : 0;
        const signed = dx * forward[0] + dy * forward[1] < 0 ? -distance : distance;
        const turn = continuous ? Math.atan2(p.forward[0] * forward[1] - p.forward[1] * forward[0], p.forward[0] * forward[0] + p.forward[1] * forward[1]) : 0;
        const steer = steering ?? (continuous && distance > .01 ? clamp(Math.atan(wheelbase * turn / distance)) : 0);
        p = { ...point, tick, forward, start, end: start + (continuous ? signed / radius : 0), fromSteer: continuous ? p.steer : steer, steer, alpha: 0 };
        poses.set(id, p);
      }
      p.alpha = Math.max(p.alpha, alpha);
      return { spin: p.start + (p.end - p.start) * p.alpha, steer: p.fromSteer + (p.steer - p.fromSteer) * p.alpha };
    },
  };
}
