// Browser adapter for `npm run dev`: the localGameFiles plugin in vite.config.js serves the
// ignored game/ folder through /__game/manifest and /__game/file. It does not exist in the
// production build, so hosted pages must use picker.js instead.
import { createVfs } from './core.js';

export async function openDevGame({ base = './', fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${base}__game/manifest`);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Local loading is available with npm run dev. On a hosted build, choose Open files or Open folder.');
  }
  const paths = await response.json();
  return createVfs(paths.map(path => ({
    path,
    read: async () => {
      const r = await fetchImpl(`${base}__game/file?path=${encodeURIComponent(path)}`);
      if (!r.ok) throw new Error(`Could not load ${path}`);
      return r.arrayBuffer();
    },
  })), { label: 'game/' });
}
