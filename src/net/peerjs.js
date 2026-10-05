// WEBRTC PEERJS (docs/comm-bat.md): the signaling goes through PeerJS's free cloud server (0.peerjs.com). The host (the one that waits for the call, player one) gets a 4-digit code that
// names its peer id; the guest enters it, the server passes the two sides' session descriptions, and from then on the game's packets go straight between the two browsers. PeerJS makes
// the connection and its own (reliable) channel; the game's own channel is the unreliable one `openCom` adds to the same peer connection. The server is left once the link is up.
import { Peer } from 'peerjs';
import { openCom } from './channel.js';

export const PEER_PREFIX = 'wacky-wheels-';
export const codeOk = text => /^\d{4}$/.test(text);
const randomCode = () => String(1000 + Math.floor(Math.random() * 9000));
const TRIES = 8, CALL_MS = 20000;

// Waits for a call. `status(text)` reports the steps; resolves { code, link } where `link` is a promise of the ComChannel, and `cancel()` gives the code up.
export function hostPeerJs({ status = () => {}, peerOptions = {} } = {}) {
  let peer = null, cancelled = false;
  const cancel = () => { cancelled = true; peer?.destroy(); };
  const ready = new Promise((resolveCode, rejectCode) => {
    let attempts = 0;
    const open = () => {
      if (cancelled) return;
      const code = randomCode(); peer = new Peer(PEER_PREFIX + code, peerOptions); status('CONNECTING TO PEERJS');
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && ++attempts < TRIES) { peer.destroy(); open(); return; }
        rejectCode(new Error(e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'COULD NOT REACH PEERJS' : 'COULD NOT GET A CODE'));
      });
      peer.on('open', () => resolveCode(code));
    };
    open();
  });
  const link = ready.then(() => new Promise((resolve, reject) => {
    let taken = false;
    peer.on('error', e => { if (!taken) reject(new Error(e.type === 'disconnected' ? 'LOST PEERJS' : 'PEERJS ERROR')); });
    peer.on('connection', conn => {
      if (taken) { conn.close(); return; } // one guest only
      taken = true; status('SYNC IN PROGRESS');
      openCom(conn.peerConnection, { initiator: false }).then(com => { peer.disconnect(); com.dispose = () => peer.destroy(); resolve(com); }, reject);
    });
  }));
  return { ready, link, cancel };
}

// Calls the host with the code. Resolves with the ComChannel.
export function joinPeerJs(code, { status = () => {}, peerOptions = {} } = {}) {
  let peer = null, cancelled = false;
  const link = new Promise((resolve, reject) => {
    if (!codeOk(code)) { reject(new Error('THE CODE IS FOUR DIGITS')); return; }
    peer = new Peer(undefined, peerOptions); status('CONNECTING TO PEERJS');
    const timer = setTimeout(() => { peer.destroy(); reject(new Error('NO ANSWER')); }, CALL_MS);
    const fail = text => { clearTimeout(timer); peer.destroy(); reject(new Error(text)); };
    peer.on('error', e => fail(e.type === 'peer-unavailable' ? 'NO GAME WITH THAT CODE' : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'COULD NOT REACH PEERJS' : 'PEERJS ERROR'));
    peer.on('open', () => {
      status('SYNC IN PROGRESS');
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'raw' });
      conn.on('error', () => fail('PEERJS ERROR'));
      conn.on('open', () => openCom(conn.peerConnection, { initiator: true }).then(com => { clearTimeout(timer); peer.disconnect(); com.dispose = () => peer.destroy(); resolve(com); }, e => fail(e.message)));
    });
  });
  return { link, cancel: () => { cancelled = true; peer?.destroy(); } };
}
