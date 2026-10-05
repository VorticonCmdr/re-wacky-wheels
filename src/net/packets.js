// The packets of a COMM-BAT link (a deviation from the DOS game, docs/comm-bat.md): raw Uint8Array packets, one to a data channel message, the way the game's own routines pass bytes
// over a COM port. The channel is unordered and may lose a packet (a UDP-like link, `{ ordered: false, maxRetransmits: 0 }`), so every packet is self-contained: a control packet is sent
// again until it is answered, and a frame packet carries every input the other side has not yet acknowledged. Numbers are big-endian. Nothing here is evidence about the DOS game's own
// serial protocol (docs/leads/menus.md: not read); the layout is the page's own.
export const TYPE = Object.freeze({ HELLO: 1, SETUP: 2, SETUP_ACK: 3, FRAME: 4, PING: 5, PONG: 6, BYE: 7, PICK: 8, PICK_ACK: 9, DONE: 10 });
export const VERSION = 1; // two pages with different versions of this protocol do not play together
export const ROLE = Object.freeze({ HOST: 0, GUEST: 1 }); // the host is player one (the one that waits for the call), the guest is player two
export const MAX_FRAMES = 32; // the unacknowledged frames one frame packet may carry
export const NONE = 0xffffffff; // "no frame yet" in an acknowledgement

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const need = (bytes, n, what) => { if (bytes.length < n) throw new Error(`short ${what} packet: ${bytes.length} of ${n} bytes`); };

// HELLO: protocol version, role, the CRC-32 of the sender's game archive (both sides must hold the same one: the track files decide the race) and a nonce that names this attempt.
const HELLO_SIZE = 11;
export function encodeHello({ role, archive, nonce }) {
  const b = new Uint8Array(HELLO_SIZE), v = view(b);
  b[0] = TYPE.HELLO; b[1] = VERSION; b[2] = role; v.setUint32(3, archive >>> 0); v.setUint32(7, nonce >>> 0);
  return b;
}
export function decodeHello(bytes) {
  need(bytes, HELLO_SIZE, 'HELLO');
  const v = view(bytes);
  return { version: bytes[1], role: bytes[2], archive: v.getUint32(3), nonce: v.getUint32(7) };
}

// SETUP (host to guest): the number of frames both sides delay their own input by, the seed of the race's random numbers and `params`, the bytes of the race the host chose (the page defines them).
const SETUP_FIXED = 7;
export function encodeSetup({ delay, seed, params }) {
  const b = new Uint8Array(SETUP_FIXED + params.length), v = view(b);
  b[0] = TYPE.SETUP; b[1] = delay; v.setUint32(2, seed >>> 0); b[6] = params.length; b.set(params, SETUP_FIXED);
  return b;
}
export function decodeSetup(bytes) {
  need(bytes, SETUP_FIXED, 'SETUP');
  const n = bytes[6]; need(bytes, SETUP_FIXED + n, 'SETUP');
  return { delay: bytes[1], seed: view(bytes).getUint32(2), params: bytes.slice(SETUP_FIXED, SETUP_FIXED + n) };
}
export const encodeSetupAck = () => Uint8Array.of(TYPE.SETUP_ACK);

// FRAME: the sender's input for `count` frames from `first` on (`size` bytes each, in `data`), the highest frame of the other side that arrived with no gap before it (`ack`, NONE for none yet)
// and, now and then, the sender's checksum of its game state after the frame `hashFrame`, so that two games that have drifted apart notice it.
const FRAME_HEAD = 11, FRAME_TAIL = 8;
export function encodeFrame({ ack, first, size, data, hashFrame = NONE, hash = 0 }) {
  const count = data.length / size;
  if (!Number.isInteger(count) || count > MAX_FRAMES) throw new Error(`a frame packet carries up to ${MAX_FRAMES} whole inputs, not ${data.length} bytes of ${size}`);
  const end = FRAME_HEAD + data.length, b = new Uint8Array(end + FRAME_TAIL), v = view(b);
  b[0] = TYPE.FRAME; v.setUint32(1, ack >>> 0); v.setUint32(5, first >>> 0); b[9] = size; b[10] = count; b.set(data, FRAME_HEAD);
  v.setUint32(end, hashFrame >>> 0); v.setUint32(end + 4, hash >>> 0);
  return b;
}
export function decodeFrame(bytes) {
  need(bytes, FRAME_HEAD, 'FRAME');
  const v = view(bytes), size = bytes[9], count = bytes[10], end = FRAME_HEAD + size * count;
  need(bytes, end + FRAME_TAIL, 'FRAME');
  return { ack: v.getUint32(1), first: v.getUint32(5), size, count, data: bytes.slice(FRAME_HEAD, end), hashFrame: v.getUint32(end), hash: v.getUint32(end + 4) };
}

// PING and PONG: the sender's clock in milliseconds (a dword, wrapping), answered with the same word, to measure the round trip before the race and to see that the other side is there.
export const encodePing = (type, stamp) => { const b = new Uint8Array(5); b[0] = type; view(b).setUint32(1, stamp >>> 0); return b; };
export const decodePing = bytes => { need(bytes, 5, 'PING'); return { stamp: view(bytes).getUint32(1) }; };
export const encodeBye = () => Uint8Array.of(TYPE.BYE);
// DONE: the sender's race is over and it is about to go quiet and close the line; the other side may still have frames to step, which it has all the input for (not a BYE, which ends the game).
export const encodeDone = () => Uint8Array.of(TYPE.DONE);

// PICK: the driver a player chose on the vehicle screen (the second player's list has the first one's crossed out, so the host's pick comes first); answered with PICK_ACK of the same role.
export const encodePick = (role, slot) => Uint8Array.of(TYPE.PICK, role, slot);
export const decodePick = bytes => { need(bytes, 3, 'PICK'); return { role: bytes[1], slot: bytes[2] }; };
export const encodePickAck = role => Uint8Array.of(TYPE.PICK_ACK, role);

// The type of a packet, or null for an empty or unknown one (a packet from another program on the channel is dropped, not trusted).
export function typeOf(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return null;
  return Object.values(TYPE).includes(bytes[0]) ? bytes[0] : null;
}
