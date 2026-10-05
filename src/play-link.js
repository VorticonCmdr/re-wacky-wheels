// COMM-BAT PLAY on the page (docs/comm-bat.md): the replacement of the game's MODEM and SERIAL CABLE links by WebRTC. This module makes the connection and keeps the session (net/session.js) of the
// link; the page (play.js) draws its messages over the menu and takes over once the two sides are linked. A deviation from the DOS game: nothing here is read from WW.EXE except the wording of
// the messages the game shows while it dials ("SYNC IN PROGRESS", "COULD NOT SYNC!!!", "WAITING FOR PLAYER", docs/leads/menus.md).
import { hostPeerJs, joinPeerJs, codeOk } from './net/peerjs.js';
import { connectLocal } from './net/local.js';
import { LinkSession, PHASE } from './net/session.js';
import { ROLE } from './net/packets.js';
import { crc32 } from './evidence/crc32.js';

export const KIND = Object.freeze({ PEER_HOST: 'peerjs-host', PEER_JOIN: 'peerjs-join', LOCAL: 'local' });
const CODE_DIGITS = 4, GRACE_MS = 3000, DONE_WAIT_MS = 400, TICK_MS = 50, ERROR_MS = 300 * 1000 / 136; // the session's housekeeping; a message stays up for 300 counts of the 136 Hz clock, as the game's messages do

// `archive` is the game archive's bytes (its CRC-32 is what the two sides compare), `on` the page's callbacks: linked(link), failed(reason), closed(reason).
export function createLink({ archive, on }) {
  const L = { closing: false, finishing: 0, kind: null, stage: 'idle', lines: [], code: '', entry: '', session: null, com: null, role: null, until: 0, cancel: () => {}, timer: null, crc: null };

  const say = (...lines) => { L.lines = lines; };
  const stop = () => { clearInterval(L.timer); L.timer = null; L.cancel(); L.cancel = () => {}; };
  function fail(reason) {
    stop(); L.session?.close(reason); L.com?.close(); L.stage = 'error'; L.until = performance.now() + ERROR_MS; say(reason);
  }

  // The link is up: the session runs the hello; the page is told when the other side has answered it.
  function connected(com, role) {
    L.com = com; L.role = role; L.crc ??= crc32(archive); L.cancel = () => {}; // from here the channel's own close ends the connection
    const s = L.session = new LinkSession({ role, archive: L.crc, send: bytes => com.send(bytes) });
    com.onmessage = bytes => s.receive(bytes);
    com.onclose = () => { if (s.phase !== PHASE.CLOSED && !s.peerDone) s.close('THE LINE WENT DEAD'); }; // a line closed after the other side said it was done is not a failure
    s.on('phase', (phase, reason) => {
      if (phase === PHASE.LINKED) { L.stage = 'linked'; on.linked(api); }
      else if (phase === PHASE.CLOSED) { if (L.closing) return; stop(); com.close(); if (L.stage === 'linked' || L.stage === 'running') { L.stage = 'closed'; on.closed(reason ?? 'THE LINE WENT DEAD'); } else fail(reason ?? 'COULD NOT SYNC!!!'); }
    });
    say('SYNC IN PROGRESS');
    L.timer = setInterval(() => s.tick(), TICK_MS);
  }

  // Starts a link of `kind`.
  function start(kind) {
    L.kind = kind; L.stage = 'connecting'; L.code = ''; L.entry = ''; L.session = null; L.com = null;
    const status = text => { if (L.stage === 'connecting' && (!L.code || text === 'SYNC IN PROGRESS')) say(text); };
    const failed = e => { if (L.stage === 'connecting') fail(e.message); };
    if (kind === KIND.PEER_HOST) {
      const h = hostPeerJs({ status }); L.cancel = h.cancel; say('CONNECTING TO PEERJS');
      h.ready.then(code => { L.code = code; say(`YOUR CODE IS ${code}`, 'WAITING FOR PLAYER'); }, failed);
      h.link.then(com => { say('SYNC IN PROGRESS'); connected(com, ROLE.HOST); }, failed);
    } else if (kind === KIND.LOCAL) {
      const c = connectLocal({ status }); L.cancel = c.cancel; say('CONNECTING TO THE LOCAL GAME SERVER');
      c.paired.then(() => say('SYNC IN PROGRESS'), failed);
      c.link.then(com => c.paired.then(role => connected(com, role === 'host' ? ROLE.HOST : ROLE.GUEST)), failed);
    } else if (kind === KIND.PEER_JOIN) { L.stage = 'entry'; entryLines(); }
  }
  const entryLines = () => say('ENTER THE FOUR DIGIT CODE', `CODE ${L.entry.padEnd(4, '_')}`);

  // Joins the game with the code typed. Returns false (and says why) when the code is not four digits.
  function call() {
    if (!codeOk(L.entry)) return false;
    L.stage = 'connecting'; L.code = L.entry; say('CONNECTING TO PEERJS');
    const j = joinPeerJs(L.entry, { status: text => { if (L.stage === 'connecting') say(text); } }); L.cancel = j.cancel;
    j.link.then(com => connected(com, ROLE.GUEST), e => { if (L.stage === 'connecting') fail(e.message); });
    return true;
  }

  // A key while the link screen is up: returns 'leave' when the player gave up (the page goes back to the menu).
  function key(e) {
    if (e.code === 'Escape') { close(); return 'leave'; }
    if (L.stage === 'entry') {
      if (/^\d$/.test(e.key) && L.entry.length < CODE_DIGITS) L.entry += e.key;
      else if (e.code === 'Backspace') L.entry = L.entry.slice(0, -1);
      else if (e.code === 'Enter') { call(); return null; }
      entryLines();
    }
    return null;
  }

  // Once a frame: after the error message's count the page goes back to the menu.
  function step(now) { if (L.stage === 'error' && now >= L.until) { L.stage = 'idle'; return 'leave'; } return null; }

  // Gives the link up (leaving the race or the menu): the other side is told.
  function close() { L.closing = true; stop(); L.session?.close(); L.com?.close(); L.stage = 'idle'; L.closing = false; } // the session's own close handler is not to report what the player asked for

  // The race is over on this side: the result is shown and the session goes on for a moment, because the other player may still be a few frames behind and needs the last inputs (the resends of the
  // session carry them, and a lost packet is made good); once the other side has them the line is closed without a goodbye, which would end the other player's race too soon.
  function finish(reason) {
    const started = performance.now(), s = L.session;
    L.finishing = started + GRACE_MS; L.stage = 'error'; L.until = started + ERROR_MS; say(reason);
    s?.finish(); clearInterval(L.timer);
    L.timer = setInterval(() => {
      const now = performance.now(), f = s?.frames;
      s?.tick();
      const theyHaveIt = s.peerDone || (f && f.acked >= s.lastLocal && now - started >= DONE_WAIT_MS); // the last inputs have been acknowledged and the word that this side is done has been sent a few times
      if (!s || s.phase === PHASE.CLOSED || now >= L.finishing || theyHaveIt) { L.closing = true; stop(); s?.close('RACE OVER'); L.com?.close(); L.closing = false; L.finishing = 0; }
    }, TICK_MS);
  }

  // A message of the link (on the link screen) and the same as a notice that ends in `leave` after its count.
  const say_ = (...lines) => say(...lines);
  const notice = reason => { stop(); L.stage = 'error'; L.until = performance.now() + ERROR_MS; say(reason); };
  const api = { L, start, key, step, close, call, say: say_, notice, finish, get lines() { return L.lines; }, get stage() { return L.stage; }, get session() { return L.session; }, get role() { return L.role; }, get kind() { return L.kind; } };
  return api;
}
