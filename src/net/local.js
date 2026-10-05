// WEBRTC LOCAL, the page's side (docs/comm-bat.md): the page opens a WebSocket to the signaling server it was loaded from, is paired with the next page that does the same, and the two swap
// their session descriptions through the server; no code is typed. A local network needs no STUN server, so the connection is made from the machines' own addresses. Once the game's
// channel is open the socket is closed.
import { openCom } from './channel.js';

// A browser that has not been given the camera hides its own address behind a name made up for the occasion ("5d61aafd-….local") that the other side has to resolve by multicast DNS, which
// some networks and machines do not do. The signaling server has seen both pages' real addresses, so the page puts the partner's address in place of such a name.
const MDNS = /[0-9a-f-]{36}\.local/gi;
export const rewriteCandidate = (text, address) => (address ? text.replace(MDNS, address) : text);
export function rewriteSignal(data, address) {
  if (!address) return data;
  if (data.candidate) return { ...data, candidate: { ...data.candidate, candidate: rewriteCandidate(data.candidate.candidate ?? '', address) } };
  if (data.description) return { ...data, description: { ...data.description, sdp: rewriteCandidate(data.description.sdp ?? '', address) } };
  return data;
}

export const SIGNAL_URL = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signal`;
const TRIES_MS = 6000;

// `status(text)` reports the steps. Resolves with { role: 'host' | 'guest', link } where `link` is a promise of the ComChannel (the host is paired first and so waits; `role` is known as soon as a
// partner is). Rejects when there is no signaling server at this address.
export function connectLocal({ status = () => {}, url = SIGNAL_URL(), WebSocketImpl = WebSocket, RTCImpl = RTCPeerConnection } = {}) {
  let ws = null, pc = null, done = false, peerAddress = null;
  const cancel = () => { done = true; try { ws?.send(JSON.stringify({ type: 'leave' })); ws?.close(); } catch { /* closed already */ } pc?.close(); };
  const paired = new Promise((resolvePair, rejectPair) => {
    try { ws = new WebSocketImpl(url); } catch { rejectPair(new Error('NO LOCAL GAME SERVER HERE')); return; }
    const timer = setTimeout(() => { if (!done) { cancel(); rejectPair(new Error('NO LOCAL GAME SERVER HERE')); } }, TRIES_MS);
    ws.onerror = () => { clearTimeout(timer); if (!done) rejectPair(new Error('NO LOCAL GAME SERVER HERE')); };
    ws.onopen = () => { clearTimeout(timer); status('WAITING FOR PLAYER'); ws.send(JSON.stringify({ type: 'join' })); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'paired') { peerAddress = m.peer ?? null; resolvePair(m.role); }
    };
  });
  const link = paired.then(role => new Promise((resolve, reject) => {
    status('SYNC IN PROGRESS');
    pc = new RTCImpl({ iceServers: [] });
    const signal = data => ws.send(JSON.stringify({ type: 'signal', data }));
    pc.onicecandidate = e => { if (e.candidate) signal({ candidate: e.candidate }); };
    ws.onmessage = async e => {
      const m = JSON.parse(e.data);
      if (m.type === 'left') { cancel(); reject(new Error('THE OTHER PLAYER LEFT')); return; }
      if (m.type !== 'signal') return;
      const data = rewriteSignal(m.data, peerAddress);
      try {
        if (data.description) {
          await pc.setRemoteDescription(data.description);
          if (data.description.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); signal({ description: pc.localDescription }); }
        } else if (data.candidate) await pc.addIceCandidate(data.candidate);
      } catch { reject(new Error('COULD NOT SYNC!!!')); }
    };
    const open = openCom(pc, { initiator: role === 'host' });
    if (role === 'host') pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => signal({ description: pc.localDescription })).catch(() => reject(new Error('COULD NOT SYNC!!!')));
    open.then(com => { done = true; try { ws.close(); } catch { /* closed */ } resolve(com); }, e => { cancel(); reject(e); });
  }));
  return { paired, link, cancel };
}
