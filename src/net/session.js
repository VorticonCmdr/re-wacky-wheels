// One COMM-BAT link between two pages (docs/comm-bat.md): the hello exchange that finds out the other side is a page of this game with the same archive, the host's setup of the race, and the
// lockstep that follows: both sides run the same race and swap their players' input every frame. The session knows nothing of WebRTC: it is given a `send(Uint8Array)` and the packets that
// arrive, over a channel that loses and reorders packets, and the time. A control packet is repeated until it is answered; a frame packet carries every input not yet acknowledged, so a lost
// packet costs nothing but the wait for the next one.
import { TYPE, ROLE, VERSION, NONE, MAX_FRAMES, typeOf, encodeHello, decodeHello, encodeSetup, decodeSetup, encodeSetupAck, encodeFrame, decodeFrame, encodePing, decodePing, encodeBye, encodePick, decodePick, encodePickAck, encodeDone } from './packets.js';

export const PHASE = Object.freeze({ HELLO: 'hello', LINKED: 'linked', SETUP: 'setup', RUNNING: 'running', CLOSED: 'closed' });
const DONE_MS = 100, RESEND_MS = 250, FRAME_RESEND_MS = 40, PING_MS = 250, SILENCE_MS = 6000, STALL_MS = 5000, RTT_SAMPLES = 8, HASH_EVERY = 64;

export class LinkSession {
  // `role` is ROLE.HOST or ROLE.GUEST, `archive` the CRC-32 of the game archive, `send` puts one packet on the channel.
  constructor({ role, archive, send, now = () => performance.now(), nonce = Math.floor(Math.random() * 0x100000000) }) {
    Object.assign(this, { role, archive: archive >>> 0, send, now, nonce, phase: PHASE.HELLO, peer: null, setup: null, rtts: [], reason: null, handlers: {} });
    this.lastHeard = this.lastHello = this.lastPing = this.lastSetup = this.lastFrameSent = now();
    this.frames = null; this.reported = null; this.picks = {}; this.pending = null; this.lastPick = 0; this.finished = false; this.peerDone = false; this.lastDone = 0;
  }

  on(name, fn) { this.handlers[name] = fn; return this; } // 'phase' (new phase), 'setup' (the guest got the race), 'pick' (role, slot), 'desync' (frame), 'error' (reason)
  emit(name, ...args) { this.handlers[name]?.(...args); }
  get rtt() { return this.rtts.length ? this.rtts.reduce((a, b) => a + b, 0) / this.rtts.length : null; } // the mean round trip in ms
  setPhase(phase, reason = null) { if (this.phase === phase) return; this.phase = phase; this.reason = reason; this.emit('phase', phase, reason); }

  // The driver this player chose: sent until the other side has it. `picks[role]` holds what each side chose (the other's once it arrived).
  pick(slot) { this.picks[this.role] = slot; this.pending = slot; this.lastPick = this.now(); this.send(encodePick(this.role, slot)); }

  // The host chooses the race: the number of frames of input delay, the seed and the page's own `params` bytes. It is repeated until the guest answers.
  start({ delay, seed, params = new Uint8Array(0), size }) {
    if (this.role !== ROLE.HOST || this.phase !== PHASE.LINKED) throw new Error('only a linked host starts a race');
    this.setup = { delay, seed: seed >>> 0, params, size };
    this.setPhase(PHASE.SETUP); this.sendSetup(); this.begin(this.setup);
  }
  sendSetup() { this.lastSetup = this.now(); this.send(encodeSetup({ ...this.setup, params: Uint8Array.from([this.setup.size, ...this.setup.params]) })); }

  // Both sides: the lockstep begins. The first `delay` frames of both players are agreed to be empty, so the race can start before any input has crossed the channel.
  begin({ delay, size }) {
    const zero = new Uint8Array(size);
    this.frames = { delay, size, local: Array.from({ length: delay }, () => zero), remote: Array.from({ length: delay }, () => zero), sim: 0, acked: delay - 1, hashes: new Map(), stalled: null };
  }

  receive(bytes) {
    const type = typeOf(bytes);
    if (type === null || this.phase === PHASE.CLOSED) return;
    this.lastHeard = this.now();
    const parse = decode => { try { return decode(bytes); } catch { return null; } }; // a damaged packet is dropped like a line error; what the handlers do with a good one is not caught
    const p = type === TYPE.HELLO ? parse(decodeHello) : type === TYPE.SETUP ? parse(decodeSetup) : type === TYPE.FRAME ? parse(decodeFrame) : type === TYPE.PICK ? parse(decodePick) : type === TYPE.PING || type === TYPE.PONG ? parse(decodePing) : true;
    if (p === null) return;
    if (type === TYPE.HELLO) this.onHello(p);
    else if (type === TYPE.SETUP) this.onSetup(p);
    else if (type === TYPE.SETUP_ACK) { if (this.phase === PHASE.SETUP) this.setPhase(PHASE.RUNNING); }
    else if (type === TYPE.FRAME) this.onFrame(p);
    else if (type === TYPE.PICK) { this.send(encodePickAck(p.role)); if (p.role !== this.role && this.picks[p.role] === undefined) { this.picks[p.role] = p.slot; this.emit('pick', p.role, p.slot); } }
    else if (type === TYPE.PICK_ACK) { if (bytes[1] === this.role) this.pending = null; }
    else if (type === TYPE.PING) this.send(encodePing(TYPE.PONG, p.stamp));
    else if (type === TYPE.PONG) this.onPong(p.stamp);
    else if (type === TYPE.BYE) this.close('THE OTHER PLAYER LEFT');
    else if (type === TYPE.DONE) { if (!this.peerDone) { this.peerDone = true; this.emit('done'); } }
  }

  onHello(h) {
    if (this.phase !== PHASE.HELLO) { if (this.phase !== PHASE.CLOSED) this.send(encodeHello({ role: this.role, archive: this.archive, nonce: this.nonce })); return; } // a side that is still waiting gets an answer
    if (h.version !== VERSION) return this.fail('DIFFERENT VERSIONS OF THE GAME');
    if (h.role === this.role) return this.fail('BOTH PLAYERS WANT THE SAME PLACE');
    if (h.archive !== this.archive) return this.fail('THE GAME FILES ARE NOT THE SAME');
    this.peer = h; this.setPhase(PHASE.LINKED);
    this.send(encodeHello({ role: this.role, archive: this.archive, nonce: this.nonce })); // the other side may still be waiting for this one
  }
  onSetup(s) {
    if (this.role !== ROLE.GUEST) return;
    if (this.phase !== PHASE.LINKED && !this.setup) return; // not before the hello has shown that the other side plays this game with the same files
    this.send(encodeSetupAck());
    if (this.setup) return;
    const size = s.params[0], params = s.params.slice(1);
    this.setup = { delay: s.delay, seed: s.seed, params, size }; this.begin(this.setup);
    this.setPhase(PHASE.RUNNING); this.emit('setup', this.setup);
  }
  onPong(stamp) {
    const rtt = (this.now() - stamp) >>> 0;
    if (rtt < SILENCE_MS) { this.rtts.push(rtt); if (this.rtts.length > RTT_SAMPLES) this.rtts.shift(); }
  }

  // Housekeeping, from a timer: the repeats of the hello, the setup and the frames, the pings and the time-outs (the DOS game too gave up on a silent line, "MODEM NOT RESPONDING").
  tick() {
    const t = this.now();
    if (this.phase === PHASE.CLOSED) return;
    if (this.phase === PHASE.HELLO && t - this.lastHello >= RESEND_MS) { this.lastHello = t; this.send(encodeHello({ role: this.role, archive: this.archive, nonce: this.nonce })); }
    if (this.phase === PHASE.SETUP && t - this.lastSetup >= RESEND_MS) this.sendSetup();
    if (this.pending !== null && t - this.lastPick >= RESEND_MS) { this.lastPick = t; this.send(encodePick(this.role, this.pending)); }
    if ((this.phase === PHASE.LINKED || this.phase === PHASE.SETUP || this.phase === PHASE.HELLO) && t - this.lastPing >= PING_MS) { this.lastPing = t; this.send(encodePing(TYPE.PING, t)); }
    if (this.phase === PHASE.RUNNING && this.frames && t - this.lastFrameSent >= FRAME_RESEND_MS && this.frames.acked < this.lastLocal) this.sendFrames();
    if (this.finished && t - this.lastDone >= DONE_MS) { this.lastDone = t; this.send(encodeDone()); }
    if (this.phase !== PHASE.HELLO && !this.peerDone && t - this.lastHeard >= SILENCE_MS) this.close('THE OTHER PLAYER IS NOT ANSWERING'); // a side that said it is done is quiet on purpose
    const f = this.frames;
    if (f && this.phase === PHASE.RUNNING && f.stalled !== null && t - f.stalled >= STALL_MS) this.close('THE OTHER PLAYER IS NOT ANSWERING');
  }

  // ---- the lockstep
  get lastLocal() { return this.frames.local.length - 1; }
  get simFrame() { return this.frames.sim; }

  // The input of the local player for the next frame (the one `delay` frames after the one just stepped); sent at once with every earlier one the other side has not acknowledged.
  submit(bytes) {
    const f = this.frames;
    if (bytes.length !== f.size) throw new Error(`an input is ${f.size} bytes, not ${bytes.length}`);
    f.local.push(Uint8Array.from(bytes)); this.sendFrames();
  }
  sendFrames() {
    const f = this.frames, first = f.acked + 1, from = Math.max(first, f.local.length - MAX_FRAMES), data = new Uint8Array((f.local.length - from) * f.size);
    for (let i = from; i < f.local.length; i++) data.set(f.local[i], (i - from) * f.size);
    const last = this.reported ?? null;
    this.lastFrameSent = this.now();
    this.send(encodeFrame({ ack: this.contiguous(), first: from, size: f.size, data, hashFrame: last ? last.frame : NONE, hash: last ? last.hash : 0 }));
  }
  contiguous() { const f = this.frames; return f.remote.length - 1; } // frames are only kept in order: remote holds every frame from 0 to its last, with no gap

  onFrame(p) {
    const f = this.frames;
    if (!f) return; // the guest has not got the setup yet: the host repeats it
    if (this.phase === PHASE.SETUP) this.setPhase(PHASE.RUNNING); // a frame answers the setup, too
    if (p.size !== f.size) return;
    for (let i = 0; i < p.count; i++) { // accept the frames that continue the line; the ones before it are repeats, the ones after a gap wait for the repeat
      const n = p.first + i;
      if (n === f.remote.length) f.remote.push(p.data.slice(i * f.size, (i + 1) * f.size));
    }
    if (p.ack !== NONE && p.ack > f.acked) f.acked = Math.min(p.ack, this.lastLocal);
    if (p.hashFrame !== NONE) { const mine = f.hashes.get(p.hashFrame); if (mine !== undefined && mine !== p.hash) this.emit('desync', p.hashFrame); }
  }

  // Whether both players' input for the next frame has arrived.
  ready() { const f = this.frames; return Boolean(f) && this.phase === PHASE.RUNNING && f.remote.length > f.sim && f.local.length > f.sim; }
  // The inputs of the next frame as [host's, guest's], and the frame counted as stepped. `stalled` times how long the race has waited for the other player.
  take() {
    const f = this.frames, n = f.sim, mine = f.local[n], theirs = f.remote[n];
    f.sim++; f.stalled = null;
    return this.role === ROLE.HOST ? [mine, theirs] : [theirs, mine];
  }
  waiting() { const f = this.frames; if (f.stalled === null) f.stalled = this.now(); } // the loop calls this when it wants a frame and `ready()` said no
  // The game's checksum after the frame just stepped; every HASH_EVERY frames it is kept and sent along so that the other side can compare.
  report(hash) {
    const f = this.frames, n = f.sim - 1;
    if (n % HASH_EVERY === 0) { f.hashes.set(n, hash >>> 0); this.reported = { frame: n, hash: hash >>> 0 }; if (f.hashes.size > 8) f.hashes.delete(f.hashes.keys().next().value); }
  }

  // This side's race is over: say so (repeated by `tick`), so that the other side, which may be a few frames behind, does not take the line going quiet and closing for a failure.
  finish() { this.finished = true; this.lastDone = this.now(); this.send(encodeDone()); }

  close(reason = null) {
    if (this.phase === PHASE.CLOSED) return;
    if (!reason) this.send(encodeBye()); // a close the player asked for tells the other side; one forced by the line cannot
    this.setPhase(PHASE.CLOSED, reason);
  }
  fail(reason) { this.close(reason); this.emit('error', reason); }
}
