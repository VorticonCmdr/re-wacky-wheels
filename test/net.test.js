import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeHello, decodeHello, encodeSetup, decodeSetup, encodeFrame, decodeFrame, encodePing, decodePing, typeOf, TYPE, ROLE, NONE, MAX_FRAMES } from '../src/net/packets.js';
import { PHASE } from '../src/net/session.js';
import { lossyLine } from '../src/net/loopback.js';

const line = lossyLine;

test('packets survive a round trip and a short or foreign packet is not a packet', () => {
  assert.deepEqual(decodeHello(encodeHello({ role: ROLE.GUEST, archive: 0xdeadbeef, nonce: 7 })), { version: 1, role: ROLE.GUEST, archive: 0xdeadbeef, nonce: 7 });
  const setup = decodeSetup(encodeSetup({ delay: 3, seed: 0x01020304, params: Uint8Array.of(9, 8, 7) }));
  assert.equal(setup.delay, 3); assert.equal(setup.seed, 0x01020304); assert.deepEqual([...setup.params], [9, 8, 7]);
  const frame = decodeFrame(encodeFrame({ ack: 5, first: 6, size: 2, data: Uint8Array.of(1, 2, 3, 4), hashFrame: 64, hash: 0xfeedface }));
  assert.deepEqual({ ack: frame.ack, first: frame.first, size: frame.size, count: frame.count, hashFrame: frame.hashFrame, hash: frame.hash }, { ack: 5, first: 6, size: 2, count: 2, hashFrame: 64, hash: 0xfeedface });
  assert.deepEqual([...frame.data], [1, 2, 3, 4]);
  assert.equal(decodePing(encodePing(TYPE.PING, 123456)).stamp, 123456);
  assert.equal(typeOf(new Uint8Array(0)), null); assert.equal(typeOf(Uint8Array.of(99)), null); assert.equal(typeOf('text'), null); assert.equal(typeOf(Uint8Array.of(TYPE.BYE)), TYPE.BYE);
  assert.throws(() => decodeFrame(Uint8Array.of(TYPE.FRAME, 0, 0)), /short FRAME/);
  assert.throws(() => encodeFrame({ ack: NONE, first: 0, size: 1, data: new Uint8Array(MAX_FRAMES + 1) }), /whole inputs/);
});

test('two sessions find each other over a line that loses a third of the packets', () => {
  const l = line({ loss: 0.35 }), [host, guest] = l.sessions;
  l.advance(4000);
  assert.equal(host.phase, PHASE.LINKED); assert.equal(guest.phase, PHASE.LINKED);
  assert.ok(host.rtt > 0 && host.rtt < 200, `a round trip was measured: ${host.rtt}`);
});

test('a driver pick reaches the other side over a lossy line, once, and is repeated until answered', () => {
  const l = line({ loss: 0.5, seed: 11 }), [host, guest] = l.sessions, seen = [];
  guest.on('pick', (role, slot) => seen.push([role, slot])); l.advance(2500);
  host.pick(5); l.advance(3000);
  assert.deepEqual(seen, [[ROLE.HOST, 5]]); assert.equal(guest.picks[ROLE.HOST], 5); assert.equal(host.pending, null, 'the host stopped repeating');
  guest.pick(2); l.advance(3000); assert.equal(host.picks[ROLE.GUEST], 2);
});

test('another archive, the same role or another version do not link, and both sides are told', () => {
  const a = line({ archive: [1, 2] }); a.advance(1500);
  assert.equal(a.sessions[0].phase, PHASE.CLOSED); assert.match(a.sessions[0].reason, /FILES/);
  const b = line({ roles: [ROLE.GUEST, ROLE.GUEST] }); b.advance(1500);
  assert.equal(b.sessions[0].phase, PHASE.CLOSED); assert.match(b.sessions[0].reason, /SAME PLACE/);
  const errors = []; const c = line(); c.sessions[0].on('error', r => errors.push(r)); c.sessions[0].receive(Uint8Array.of(TYPE.HELLO, 9, 1, 0, 0, 0xab, 0xcd, 0, 0, 0, 5)); // another version
  assert.equal(c.sessions[0].phase, PHASE.CLOSED); assert.match(errors[0], /VERSIONS/);
});

// Both sides run a "game": a state that mixes the two players' inputs, so that any difference in the inputs or their order shows in the checksum.
function play({ l, frames, size = 2, until = 120000 }) {
  const [host, guest] = l.sessions, out = [0, 1].map(() => ({ state: 0, steps: 0, log: [] }));
  const keys = (who, f) => Uint8Array.of((f * 7 + who * 3) & 0xff, (f >> 2) & 0xff);
  const step = (who, session) => {
    const o = out[who];
    while (o.steps < frames && session.ready()) {
      const [a, b] = session.take(), f = o.steps;
      o.state = (Math.imul(o.state, 31) + a[0] * 256 + a[1] + Math.imul(b[0] * 256 + b[1], 17) + f) >>> 0; o.log.push([a[0], a[1], b[0], b[1]].join());
      o.steps++; session.report(o.state); session.submit(keys(who, f + session.frames.delay)); // the input for the frame `delay` after this one
    }
    if (o.steps < frames && !session.ready()) session.waiting();
  };
  const finish = () => out.every(o => o.steps >= frames);
  for (let i = 0; i < until / 5 && !finish(); i++) { l.advance(5); step(0, host); step(1, guest); }
  return { out, finish: finish() };
}

function startRace(l, { delay = 3, size = 2, loss } = {}) {
  const [host, guest] = l.sessions; l.advance(2500);
  assert.equal(host.phase, PHASE.LINKED); assert.equal(guest.phase, PHASE.LINKED);
  let got = null; guest.on('setup', s => { got = s; });
  host.start({ delay, seed: 0x12345678, params: Uint8Array.of(4, 5, 6), size });
  l.advance(1500);
  assert.equal(host.phase, PHASE.RUNNING, 'the guest answered the setup'); assert.equal(guest.phase, PHASE.RUNNING);
  assert.equal(got.delay, delay); assert.equal(got.seed, 0x12345678); assert.deepEqual([...got.params], [4, 5, 6]); assert.equal(got.size, size);
}

test('the lockstep gives both sides the same inputs in the same order over a lossy, reordering line', () => {
  for (const loss of [0, 0.2, 0.4]) {
    const l = line({ loss, seed: 3 + Math.floor(loss * 10) }); startRace(l, { delay: 3 });
    const r = play({ l, frames: 600 });
    assert.ok(r.finish, `all frames stepped at loss ${loss}`);
    assert.equal(r.out[0].state, r.out[1].state, `the same game state at loss ${loss}`);
    assert.deepEqual(r.out[0].log, r.out[1].log, `the same inputs at loss ${loss}`);
  }
});

test('the first frames are empty on both sides and the host is player one in the pair', () => {
  const l = line(); startRace(l, { delay: 3 }); const [host, guest] = l.sessions;
  for (let i = 0; i < 3; i++) { const h = host.take(), g = guest.take(); assert.deepEqual([...h[0], ...h[1]], [0, 0, 0, 0]); assert.deepEqual(h.map(x => [...x]), g.map(x => [...x])); }
  assert.ok(host.ready() === false || host.ready() === true); // the line decides whether the first real frame has crossed yet
});

test('a game that has drifted apart is noticed through the checksums', () => {
  const l = line(); startRace(l, { delay: 2 }); const [host, guest] = l.sessions, seen = [];
  host.on('desync', f => seen.push(f)); guest.on('desync', f => seen.push(f));
  let h = 0, g = 0;
  for (let i = 0; i < 400; i++) {
    l.advance(5);
    if (host.ready()) { host.take(); host.report(1000 + h); host.submit(Uint8Array.of(0, 0)); h++; } else host.waiting();
    if (guest.ready()) { guest.take(); guest.report(h > 100 ? 77 : 1000 + g); guest.submit(Uint8Array.of(0, 0)); g++; } else guest.waiting(); // the guest's game goes its own way after frame 100
  }
  assert.ok(seen.length > 0, 'a desync was reported');
});

test('a silent line ends the race instead of leaving it waiting for ever', () => {
  const l = line(); startRace(l, { delay: 2 }); const [host, guest] = l.sessions; let reason = null; host.on('phase', (p, r) => { if (p === PHASE.CLOSED) reason = r; });
  for (let i = 0; i < 20; i++) { l.advance(5); if (host.ready()) { host.take(); host.submit(Uint8Array.of(0, 0)); } }
  guest.send = () => {}; // the guest's side of the line dies
  for (let i = 0; i < 4000 && host.phase !== PHASE.CLOSED; i++) { l.advance(5); if (host.ready()) { host.take(); host.submit(Uint8Array.of(0, 0)); } else host.waiting(); }
  assert.equal(host.phase, PHASE.CLOSED); assert.match(reason, /NOT ANSWERING/);
});

test('leaving tells the other side', () => {
  const l = line(); startRace(l, { delay: 2 }); const [host, guest] = l.sessions;
  host.close(); l.advance(200);
  assert.equal(guest.phase, PHASE.CLOSED); assert.match(guest.reason, /LEFT/);
});

// ---- the local signaling: the pairing and the server that carries it
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { Pairing } from '../src/net/pairing.js';
import { attachSignaling, plainAddress } from '../src/net/signal-server.js';
import { rewriteCandidate, rewriteSignal } from '../src/net/local.js';

const person = () => { const got = []; return { got, send: m => got.push(m) }; };

test('pages are paired in the order they arrive and the first to wait is the host', () => {
  const p = new Pairing(), a = person(), b = person(), c = person(), d = person();
  p.join(a); assert.deepEqual(a.got, [{ type: 'waiting' }]);
  p.join(b); assert.deepEqual(a.got.at(-1), { type: 'paired', role: 'host', peer: null }); assert.deepEqual(b.got, [{ type: 'paired', role: 'guest', peer: null }]);
  p.join(c); p.join(d); assert.deepEqual(c.got.at(-1), { type: 'paired', role: 'host', peer: null }); assert.deepEqual(d.got.at(-1), { type: 'paired', role: 'guest', peer: null });
  p.relay(a, { sdp: 1 }); assert.deepEqual(b.got.at(-1), { type: 'signal', data: { sdp: 1 } }); assert.equal(d.got.length, 1);
  p.leave(b); assert.deepEqual(a.got.at(-1), { type: 'left' });
  const before = b.got.length; p.relay(a, { sdp: 2 }); assert.equal(b.got.length, before, 'what a sends after the pair is gone goes nowhere');
});

test('a page that left while waiting is not paired, and one that joins twice is not paired with itself', () => {
  const p = new Pairing(), a = person(), b = person(), c = person(); p.join(a); p.join(a); p.leave(a); p.join(b);
  assert.deepEqual(b.got, [{ type: 'waiting' }], 'b waits: a had left'); assert.equal(a.got.length, 1);
  p.join(c); assert.deepEqual(b.got.at(-1), { type: 'paired', role: 'host', peer: null });
});

test('the signaling server pairs two sockets and relays what they send', async () => {
  const server = createServer(); const signaling = attachSignaling(server, { rejectOthers: true }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/signal`;
  const sockets = [], open = () => new Promise((resolve, reject) => { const ws = new WebSocket(url), got = []; sockets.push(ws); ws.on('message', m => got.push(JSON.parse(m.toString()))); ws.on('open', () => resolve({ ws, got })); ws.on('error', reject); });
  const wait = async (fn) => { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('timed out'); };
  try {
    const a = await open(), b = await open();
    a.ws.send(JSON.stringify({ type: 'join' })); await wait(() => a.got.length === 1); assert.equal(a.got[0].type, 'waiting');
    b.ws.send(JSON.stringify({ type: 'join' })); await wait(() => b.got.length === 1);
    assert.deepEqual(a.got.at(-1), { type: 'paired', role: 'host', peer: '127.0.0.1' }); assert.deepEqual(b.got[0], { type: 'paired', role: 'guest', peer: '127.0.0.1' });
    a.ws.send(JSON.stringify({ type: 'signal', data: { description: { type: 'offer', sdp: 'x' } } })); await wait(() => b.got.length === 2);
    assert.deepEqual(b.got[1], { type: 'signal', data: { description: { type: 'offer', sdp: 'x' } } });
    a.ws.send('not json'); a.ws.send(JSON.stringify({ type: 'nothing' })); // dropped
    b.ws.close(); await wait(() => a.got.at(-1).type === 'left');
    const stray = new WebSocket(`ws://127.0.0.1:${server.address().port}/other`); await new Promise(r => { stray.on('error', r); stray.on('close', r); }); // another path is not ours
    a.ws.close();
  } finally { sockets.forEach(w => w.terminate()); signaling.close(); server.close(); server.closeAllConnections?.(); }
});

// ---- what the page defines for a game
import { encodeInput, decodeInput, encodeParams, decodeParams, delayFor, raceHash, checkParams } from '../src/net/race.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';
import { LINK_MENU } from '../src/game/link-menus.js';

test('a player\'s input survives its two bytes', () => {
  const input = { left: true, right: false, accelerate: true, fire: false, brake: true, spin: false };
  assert.deepEqual(decodeInput(encodeInput(input)), input);
  assert.deepEqual(decodeInput(encodeInput({ ...input, taunt: 4 })), { ...input, taunt: 4 });
  assert.deepEqual([...encodeInput({})], [0, 0]);
});

test('the race the host chose survives its setup bytes', () => {
  const p = { cars: 2, cls: 1, laps: 8, engine: 2, track: 17, slotOne: 3, slotTwo: 6, detail: 2 };
  assert.deepEqual(decodeParams(encodeParams(p)), p);
  assert.throws(() => decodeParams(Uint8Array.of(1, 2, 3)), /eight/);
});

test('the delay grows with the round trip and stays within its limits', () => {
  assert.equal(delayFor(null, 14), 2); assert.equal(delayFor(10, 14), 2); assert.ok(delayFor(100, 14) > delayFor(40, 14)); assert.equal(delayFor(5000, 14), 8);
});

test('the checksum notices a car that is one place off', () => {
  const cars = [{ cx: 1, cy: 2, heading: 3, throttle: 4, speed: 5 }, { cx: 6, cy: 7, heading: 8, throttle: 9, speed: 10 }];
  assert.equal(raceHash({ tick: 5 }, cars), raceHash({ tick: 5 }, cars.map(c => ({ ...c }))));
  assert.notEqual(raceHash({ tick: 5 }, cars), raceHash({ tick: 5 }, [{ ...cars[0], cx: 2 }, cars[1]]));
  assert.notEqual(raceHash({ tick: 5 }, cars), raceHash({ tick: 6 }, cars));
});

test('a race the other side chose is run only if this page can run it', () => {
  const ok = { cars: 2, cls: 1, laps: 8, engine: 2, track: 17, slotOne: 3, slotTwo: 6, detail: 2 }, env = { tracks: [1, 2, 17], drivers: 8 };
  assert.equal(checkParams(ok, env), null);
  for (const bad of [{ cars: 3 }, { cls: 0 }, { laps: 0 }, { laps: 99 }, { engine: 3 }, { detail: 4 }, { track: 18 }, { slotOne: 8 }, { slotTwo: 3 }]) assert.match(checkParams({ ...ok, ...bad }, env), /CANNOT RUN/, JSON.stringify(bad));
});

test('COMM-BAT PLAY offers the WebRTC links in the page, and the game\'s own two items in the records', () => {
  assert.deepEqual(menuDef('comm', defaultSettings(1, false)).items, ['MODEM', 'SERIAL CABLE', 'LEAVE THIS MENU']);
  const page = menuDef('comm', defaultSettings(1, true));
  assert.deepEqual(page.items, [...LINK_MENU.items, 'LEAVE THIS MENU']); assert.deepEqual(page.actions, [{ open: 'peer' }, { link: 'local' }, { back: true }]);
  const peer = menuDef('peer', defaultSettings(1, true));
  assert.deepEqual(peer.items, [...LINK_MENU.peer, 'LEAVE THIS MENU']); assert.deepEqual(peer.actions, [{ link: 'peerjs-join' }, { link: 'peerjs-host' }, { back: true }]);
});

test('the host\'s setup menus of a link race end at the engine menu', () => {
  const linked = { ...defaultSettings(1, true), link: true };
  assert.deepEqual(menuDef('laps', linked).actions.map(a => a.goto), ['engine', 'engine', 'engine']);
  assert.deepEqual(menuDef('engine', linked).actions, [{ race: 1 }, { race: 1 }]);
  assert.deepEqual(menuDef('engine', defaultSettings(1, true)).actions.map(a => a.goto), ['races', 'races']);
});

test('the pages of a local game get each other\'s address from the server, and a made-up host name is replaced by it', () => {
  const p = new Pairing(), a = { address: '192.168.1.5', got: [], send(m) { this.got.push(m); } }, b = { address: '192.168.1.9', got: [], send(m) { this.got.push(m); } };
  p.join(a); p.join(b); assert.equal(a.got.at(-1).peer, '192.168.1.9'); assert.equal(b.got.at(-1).peer, '192.168.1.5');
  assert.equal(plainAddress('::ffff:10.0.0.2'), '10.0.0.2'); assert.equal(plainAddress('::1'), '127.0.0.1'); assert.equal(plainAddress('fe80::1'), null); assert.equal(plainAddress(undefined), null);
  const name = '5d61aafd-57a0-4b59-8c8d-b25e78344055.local', text = `candidate:2566681509 1 udp 2113937151 ${name} 50123 typ host generation 0`;
  assert.equal(rewriteCandidate(text, '192.168.1.9'), 'candidate:2566681509 1 udp 2113937151 192.168.1.9 50123 typ host generation 0');
  assert.equal(rewriteCandidate(text, null), text);
  assert.equal(rewriteSignal({ candidate: { candidate: text, sdpMid: '0' } }, '10.0.0.1').candidate.candidate.includes('10.0.0.1'), true);
  assert.match(rewriteSignal({ description: { type: 'offer', sdp: `v=0\r\na=candidate:1 1 udp 1 ${name} 9 typ host\r\n` } }, '10.0.0.1').description.sdp, /10\.0\.0\.1 9 typ host/);
  const real = '203.0.113.7'; assert.equal(rewriteCandidate(`candidate:1 1 udp 1 ${real} 9 typ srflx`, '10.0.0.1').includes(real), true); // a real address stays
});

test('a side that says it is done may go quiet without ending the other side\'s race', () => {
  const l = line({ latency: 20, jitter: 5 }); startRace(l, { delay: 2 }); const [host, guest] = l.sessions, seen = [];
  guest.on('done', () => seen.push('done'));
  // the host steps ahead as far as the guest's inputs allow, then finishes; the guest is behind
  for (let i = 0; i < 40; i++) { l.advance(5); if (host.ready()) { host.take(); host.submit(Uint8Array.of(0, 0)); } if (guest.ready() && i % 4 === 0) { guest.take(); guest.submit(Uint8Array.of(0, 0)); } }
  host.finish(); l.advance(300); host.send = () => {}; // the host's line goes quiet for good
  assert.deepEqual(seen, ['done']); assert.ok(guest.peerDone);
  const behind = guest.frames.local.length - guest.simFrame;
  let steps = 0; for (let i = 0; i < 4000 && guest.phase !== PHASE.CLOSED; i++) { l.advance(5); if (guest.ready()) { guest.take(); guest.submit(Uint8Array.of(0, 0)); steps++; } }
  assert.ok(steps > 0, 'the guest stepped the frames it had the input for'); assert.ok(steps <= behind + 4, 'and no more');
  assert.equal(guest.phase, PHASE.RUNNING, 'the line going quiet did not end the guest\'s race (no silence time-out after DONE)');
});
