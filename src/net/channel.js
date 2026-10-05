// The "COM port" of a COMM-BAT link (docs/comm-bat.md): one RTCDataChannel that carries raw Uint8Array packets and, like a serial line, may lose them. `{ ordered: false, maxRetransmits: 0 }`
// switches off the channel's own retransmission, so a packet is sent once and is either there or not (the session above repeats what matters). Both transports (PeerJS and the local
// signaling server) open their connection and then call `openCom` on its RTCPeerConnection.
export const COM = Object.freeze({ label: 'COM1', options: { ordered: false, maxRetransmits: 0 }, timeoutMs: 15000 });

// What the session sees: send(bytes), a message handler, a close handler. `raw` is the data channel.
export class ComChannel {
  constructor(raw, pc = null) {
    this.raw = raw; this.pc = pc; this.dispose = null; this.onmessage = null; this.onclose = null; this.closed = false;
    raw.binaryType = 'arraybuffer';
    raw.onmessage = e => { if (typeof e.data !== 'string' && this.onmessage) this.onmessage(new Uint8Array(e.data)); }; // a text message is not a packet of this protocol
    raw.onclose = () => this.finish(); raw.onerror = () => this.finish();
  }
  send(bytes) { if (!this.closed && this.raw.readyState === 'open') this.raw.send(bytes); } // a packet sent into a dead line is lost like any other
  finish() { if (this.closed) return; this.closed = true; this.onclose?.(); }
  close() { try { this.raw.close(); this.pc?.close(); this.dispose?.(); } catch { /* already gone */ } this.finish(); } // the peer connection goes with the channel
}

// The initiator opens the channel, the other side receives it. Resolves with the ComChannel once it is open; rejects after `timeoutMs`.
export function openCom(pc, { initiator, timeoutMs = COM.timeoutMs }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('THE OTHER PLAYER DID NOT ANSWER')), timeoutMs);
    const ready = raw => {
      const done = () => { clearTimeout(timer); resolve(new ComChannel(raw, pc)); };
      if (raw.readyState === 'open') done(); else raw.onopen = done;
    };
    if (initiator) { ready(pc.createDataChannel(COM.label, COM.options)); return; }
    const before = pc.ondatachannel; // PeerJS has its own handler for the channel it opens itself: leave that one to it
    pc.ondatachannel = e => { if (e.channel.label === COM.label) ready(e.channel); else before?.call(pc, e); };
  });
}
