// The signaling server of WEBRTC LOCAL (Node): a WebSocket endpoint that pairs the pages on its address (pairing.js). `attachSignaling(httpServer)` adds it to any http server, which is how both
// `npm run dev` and `npm run serve:lan` (tools/lan-server.mjs) carry it.
import { WebSocketServer } from 'ws';
import { Pairing } from './pairing.js';

export const SIGNAL_PATH = '/signal';
const MAX_MESSAGE = 16 * 1024; // a session description is a few kilobytes

// The address of a socket as the pages should use it: IPv4, an IPv4-mapped IPv6 address unwrapped, the IPv6 loopback as 127.0.0.1; null for anything else.
export function plainAddress(address) {
  if (!address) return null;
  const a = address.replace(/^::ffff:/i, '');
  if (a === '::1') return '127.0.0.1';
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(a) ? a : null;
}

// `rejectOthers`: an upgrade for another path is closed (a server of its own; the dev server has its own upgrade handler and leaves them to it).
export function attachSignaling(server, { path = SIGNAL_PATH, rejectOthers = false } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE }), pairing = new Pairing();
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname !== path) { if (rejectOthers) socket.destroy(); return; } // other upgrades are not ours
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws, req) => {
    const client = { address: plainAddress(req?.socket?.remoteAddress), send: message => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message)); } };
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m?.type === 'join') pairing.join(client);
      else if (m?.type === 'signal') pairing.relay(client, m.data);
      else if (m?.type === 'leave') pairing.leave(client);
    });
    ws.on('close', () => pairing.leave(client)); ws.on('error', () => pairing.leave(client));
  });
  return { wss, pairing, close: () => wss.close() };
}
