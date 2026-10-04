import { defineConfig } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

// Only the development server exposes the ignored originals. They never enter dist.
function localGameFiles() {
  const root = resolve('game');
  async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) files.push(...await scan(path));
      else if (/\.(dat|exe|pcx|cfg|dtt|hi|tim)$/i.test(entry.name)) {
        files.push(relative(root, path).split(sep).join('/'));
      }
    }
    return files;
  }
  return {
    name: 'local-game-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/__game/')) return next();
        try {
          const files = await scan(root);
          if (url.pathname === '/__game/manifest') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
          } else if (url.pathname === '/__game/file') {
            const name = url.searchParams.get('path');
            // Allow only paths returned by the scan, not arbitrary filesystem access.
            if (!files.includes(name)) { res.statusCode = 404; return res.end('Not found'); }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.end(await readFile(resolve(root, name)));
          } else { res.statusCode = 404; res.end('Not found'); }
        } catch { res.statusCode = 500; res.end('Could not read local game files'); }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [localGameFiles(), {
    name: 'third-party-notices',
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source: await readFile(resolve('THIRD_PARTY_NOTICES.md'), 'utf8') });
    },
  }],
  build: { rolldownOptions: { input: { index: resolve('index.html'), viewer: resolve('viewer.html'), track: resolve('track.html'), play: resolve('play.html') } } },
});
