import trackProjects from './assets/track-scenery.json' with { type: 'json' };
import { rigPickup } from './pickup-motion.js';
import studioMatches from './assets/matchbox.json' with { type: 'json' };
import studioBomb from './assets/bomb.json' with { type: 'json' };
import studioReader from './assets/reading-hedgehog.json' with { type: 'json' };
import studioHog from './assets/yellow-prop-hedgehog.json' with { type: 'json' };
import studioTyres from './assets/tyre-stack.json' with { type: 'json' };
import studioPost from './assets/tyre-post.json' with { type: 'json' };
import { voxelMesh } from './mesh.js';

// Model-space cells, not sprite samples: every view sees the same solid rubber
// rings and wooden post. Albedo contains material detail only; the shared scene
// light and vertex AO supply directional shading.
const PROCEDURAL_NAMES = ['OB1.SP', 'OB8.SP'];
export const SCENERY_NAMES = [...PROCEDURAL_NAMES, 'H1.SP', 'H12.SP', 'H2.SP', 'H4.SP', ...Object.keys(trackProjects)];
export function sceneryProject(name) {
  name = name.toUpperCase();
  if (!PROCEDURAL_NAMES.includes(name)) return null;
  const post = name === 'OB8.SP', size = 32, voxels = [];
  const tyreHeight = post ? 7 : 9;
  const noise = (x, y, z) => ((x * 73 + y * 151 + z * 199) ^ (x * z * 31)) % 7 - 3;
  for (let y = 0; y < 28; y++) for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const dx = x + .5 - 16, dz = z + .5 - 16;
    const radius = Math.hypot(dx, dz);
    let color = null;
    if (y < tyreHeight * 3) {
      const tier = Math.floor(y / tyreHeight), height = (y + .5 - (tier + .5) * tyreHeight) / (tyreHeight / 2);
      // Elliptical torus cross-section: rounded sidewalls, a through-hole and
      // full depth. Alternate tread rows around the circumference of each tyre.
      const angle = Math.atan2(dz, dx), sector = Math.floor((angle + Math.PI) * 32 / (2 * Math.PI));
      const groove = radius > 11 && (sector + Math.floor(y / 2) + tier) % 4 === 0;
      const outer = groove ? 4.1 : 4.8;
      if (((radius - 9) / outer) ** 2 + height ** 2 <= 1) {
        const tread = radius > 11.5 && Math.abs(height) < .7;
        const shade = (tread ? 58 : 46) + noise(x, y, z);
        color = [shade, shade + 2, shade + 3];
      }
    }
    // The post passes down through the tyres' holes, rather than floating on
    // their top. The open annular space is still visible around the post.
    if (post && radius < 3.9 && y < 28) {
      const grain = Math.floor((Math.atan2(dz, dx) + Math.PI) * 10) % 4;
      const n = noise(x, Math.floor(y / 4), z);
      color = y === 27
        ? (Math.floor(radius * 1.5) % 2 ? [206 + n, 151 + n, 91 + n] : [225 + n, 179 + n, 117 + n])
        : [143 + grain * 9 + n, 87 + grain * 6 + n, 42 + grain * 3 + n];
    }
    if (color) voxels.push([x, y, z, ...color]);
  }
  return {size, voxels};
}

const studioProjects = { ...trackProjects, 'OB1.SP': studioTyres, 'OB8.SP': studioPost,
  'H1.SP': studioMatches, 'H12.SP': studioBomb, 'H2.SP': studioReader, 'H4.SP': studioHog };
export function sceneryMesh(_world, sprite, source = 'procedural') {
  const project = source === 'studio' ? studioProjects[sprite.name.toUpperCase()] : sceneryProject(sprite.name);
  return project ? (source === 'studio' ? rigPickup(project, sprite.name.toUpperCase()) : voxelMesh(project)) : null;
}
