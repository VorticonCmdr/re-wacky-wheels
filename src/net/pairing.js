// WEBRTC LOCAL, the server's side (docs/comm-bat.md): pages that open the same address on the local network and choose WEBRTC LOCAL find each other without a code. The server only pairs
// them in the order they arrive (the first to wait is the host, player one) and passes their signaling messages on; the game's packets never touch it. This part knows nothing of sockets:
// a client is an object with `send(message)`, so it can be tested without a network.
export class Pairing {
  constructor() { this.waiting = null; this.pairs = new Map(); } // never more than one page waits: the next to come is paired with it

  // A page asks to play: it waits for a partner, or it is the partner a page waits for.
  join(client) {
    if (this.pairs.has(client) || this.waiting === client) return;
    const host = this.waiting;
    if (!host) { this.waiting = client; client.send({ type: 'waiting' }); return; }
    this.waiting = null; this.pairs.set(host, client); this.pairs.set(client, host);
    host.send({ type: 'paired', role: 'host', peer: client.address ?? null }); client.send({ type: 'paired', role: 'guest', peer: host.address ?? null }); // each gets the other's address as the server sees it (local.js uses it where a browser hides its own)
  }

  // A signaling message from a paired page goes to its partner; one from a page that is not paired is dropped.
  relay(client, data) { this.pairs.get(client)?.send({ type: 'signal', data }); }

  // A page leaves (it closed the socket, or has its channel and no longer needs the server). Its partner is told, and a partner that was not yet connected waits again.
  leave(client) {
    if (this.waiting === client) this.waiting = null;
    const partner = this.pairs.get(client);
    this.pairs.delete(client);
    if (partner) { this.pairs.delete(partner); partner.send({ type: 'left' }); }
  }
}
