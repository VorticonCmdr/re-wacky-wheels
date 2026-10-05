// A line between two sessions on a virtual clock, for the tests and the headless link check (scripts/check-link.js): every packet is delivered after `latency` ms plus a random jitter (so
// packets can overtake each other) or lost with the chance `loss`. Not used by the page.
import { LinkSession } from './session.js';
import { ROLE } from './packets.js';

export function lossyLine({ latency = 20, jitter = 15, loss = 0, seed = 1, archive = [0xabcd, 0xabcd], roles = [ROLE.HOST, ROLE.GUEST] } = {}) {
  let t = 0, s = seed, queue = [];
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  const sessions = [];
  const make = i => new LinkSession({ role: roles[i], archive: archive[i], now: () => t, nonce: i + 1, send: bytes => { if (rand() >= loss) queue.push({ at: t + latency + Math.floor(rand() * jitter), to: 1 - i, bytes: Uint8Array.from(bytes) }); } });
  sessions.push(make(0), make(1));
  const advance = ms => {
    for (let end = t + ms; t < end;) {
      t += 5; // the virtual clock goes on in steps of 5 ms
      const due = queue.filter(p => p.at <= t).sort((a, b) => a.at - b.at); queue = queue.filter(p => p.at > t);
      for (const p of due) sessions[p.to].receive(p.bytes);
      sessions.forEach(x => x.tick());
    }
  };
  return { sessions, advance, now: () => t };
}
