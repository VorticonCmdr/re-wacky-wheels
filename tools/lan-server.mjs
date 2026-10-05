// `npm run serve:lan`: serves the production build (dist/) on the local network and carries the signaling server of WEBRTC LOCAL (docs/comm-bat.md), so that players who open
// http://<this machine's address>:<port> and choose COMM-BAT PLAY > WEBRTC LOCAL find each other. It serves no game files: every player picks their own WACKY.DAT in the page.
// Options: --port 8080  --host 0.0.0.0  --dir dist
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';
import { attachSignaling } from '../src/net/signal-server.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json' };

export function createLanServer({ dir = 'dist' } = {}) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = join(root, normalize(path).replace(/^([/\\])+/, ''));
      if (!file.startsWith(root)) { res.statusCode = 403; return res.end('Forbidden'); }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream'); res.end(body);
    } catch { res.statusCode = 404; res.end('Not found'); }
  });
  const signaling = attachSignaling(server, { rejectOthers: true });
  return { server, signaling };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '8080' }, host: { type: 'string', default: '0.0.0.0' }, dir: { type: 'string', default: 'dist' } } });
  const { server } = createLanServer({ dir: values.dir });
  server.listen(Number(values.port), values.host, () => {
    console.log(`serving ${values.dir}/ with the local game signaling on port ${values.port}; players on this network can open:`);
    for (const list of Object.values(networkInterfaces())) for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  http://${a.address}:${values.port}/play.html`);
    console.log(`  http://localhost:${values.port}/play.html`);
  });
}
