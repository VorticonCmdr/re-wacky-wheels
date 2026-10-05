# COMM-BAT PLAY over WebRTC

A deviation from the DOS game. The original links two machines by **modem** or **serial cable** (main menu item 5, COMM-BAT™ PLAY). The page replaces the two links:

| DOS menu item | The page's item | Link |
| --- | --- | --- |
| MODEM | **WEBRTC PEERJS** | PeerJS's free cloud server (0.peerjs.com) swaps the two browsers' session descriptions; the game's packets then go straight between the browsers. |
| SERIAL CABLE | **WEBRTC LOCAL** | The pages of one address on the local network find each other through a small WebSocket server and need no code. |

Only the page's menus (`settings.famous`) have the new items; the records of the game's own menu (`menu.tree-observed`) still show MODEM and SERIAL CABLE, and the replays of the records use those.

Nothing in this feature is evidence about the DOS game. What the game does when it links is read only in part (below); the link protocol, the packets and the race rules around them are the page's own (`src/net/`, `src/play-link.js`).

## Playing

1. Main menu > COMM-BAT™ PLAY.
2. **WEBRTC PEERJS**
   * **WAIT FOR CALL** (the game's MODEM menu has the same two items, MAKE CALL and WAIT FOR CALL): the page asks the PeerJS server for a peer id and shows a four digit code (`YOUR CODE IS 6311`). The one that waits is player one, the **host**.
   * **MAKE CALL**: the other player types the code and presses Enter; they are player two, the **guest**.
3. **WEBRTC LOCAL**: both players choose it. The first to wait is the host, the next is the guest, no code. It needs the page to have been loaded from a server that carries the signaling: `npm run serve:lan` (the production build, `dist/`, on `0.0.0.0:8080` — pass `-- --port 8081` to change it), `npm run dev:lan` or the dev and preview servers (`/signal`). The server prints the addresses to open, for example `http://192.168.1.50:8080/play.html`. The hosted site is static and has no such server: the item then says `NO LOCAL GAME SERVER HERE`.
4. Once linked the host picks a car on the vehicle screen first, then the guest (the host's car is crossed out); each pick goes to the other side.
5. The host chooses the race with the menus of the two player race: RACE HEAD TO HEAD or RACE WITH ALL CARS (then the class), the laps and the engine, on the track chosen on the page. The race type menu is left out. The guest sees WAITING FOR PLAYER.
6. Both machines run the race. Esc leaves for both players (a link race cannot be paused); a finished race ends with `YOU WON THE RACE` or `YOU CAME IN PLACE n` and the menu.

Both players need **the same WACKY.DAT**: each page sends the CRC-32 of its archive with its hello, and a different one stops the link (`THE GAME FILES ARE NOT THE SAME`). The page serves no game files; every player opens their own archive.

## What the two machines share

Both pages run the same two player race (`src/game/versus*.js`, the rules of TWO PLAYER RACE, whose full-screen view the page draws for the own car) and swap the players' input every frame — **lockstep**. The host is player one (seat 0), the guest player two (seat 1); each draws its own seat full screen with the usual panel and the other human as an ordinary car. The input of a player is two bytes: the six keys of the player's layout (`left right accelerate fire brake spin`, one bit each) and the taunt key. The local player always uses the first player's key layout; F1 to F6 (or 1 to 6) taunt.

* The host's setup carries the seed (the computer racers' drivers), the detail level (it sets the steering rate, so it must agree), the drivers, the class, laps, engine and track.
* Each side delays its own input by `delay` frames, chosen by the host from the measured round trip (2 to 8 frames, 14 ms each), so that the other player's input is usually there when the frame needs it. The first `delay` frames of both players are agreed to be empty. A frame whose input has not arrived is not stepped (as the game's serial link waited); the page does not run ahead when it does arrive.
* The race clock follows the frames, not the wall clock, so both machines agree.
* Every 64 frames each side sends a checksum of both cars; a mismatch ends the game (`THE TWO GAMES DO NOT AGREE`).
* A line that is silent for six seconds, or a race that waits five seconds for the other player, ends the game (`THE OTHER PLAYER IS NOT ANSWERING`) — a tab that is in the background does not run frames, so it stalls the other player.

## The serial line

The game's own routines pass bytes over a COM port (`obj1+0x1dd30` and the library around it, below). The page keeps that shape: **raw `Uint8Array` packets** through one RTCDataChannel (`dataChannel.send(bytes)`, `binaryType = 'arraybuffer'`), made **unordered with no retransmission** (`{ ordered: false, maxRetransmits: 0 }`) — a UDP-like line that, like a serial or modem line, may lose a byte. Over it the session (`src/net/session.js`) keeps what a lockstep needs:

* a control packet (hello, setup, driver pick) is sent again every 250 ms until it is answered;
* a frame packet carries every input the other side has not yet acknowledged and the highest frame received without a gap, so a lost packet costs nothing but the wait for the next one;
* a packet from another program, a short or a damaged one is dropped.

`src/net/packets.js` lists the packets (HELLO, SETUP, SETUP_ACK, FRAME, PING, PONG, BYE, PICK, PICK_ACK, DONE; big-endian). When a race ends the side that gets there first (lockstep lets it lead by up to `delay` frames) says DONE, keeps the line up until the other side has acknowledged its last inputs, and then closes it without a BYE: the other side, which has all the input it needs for its last frames, finishes them and shows its own result. PeerJS makes its own reliable channel for the connection; the game's channel is a second one on the same RTCPeerConnection (`src/net/channel.js`), and the PeerJS server is left (`peer.disconnect()`) once the link is up. WEBRTC LOCAL uses no STUN server: the machines connect from their own addresses. A browser hides its own address behind a made-up name ("…-….local") that the other machine has to resolve by multicast DNS, which some networks and machines do not do (seen on the development machine: the two pages never connected); the signaling server therefore tells each page the other's address as the server sees it, and the page puts it in place of such a name in the candidates and descriptions it receives (`rewriteSignal` in `src/net/local.js`).

## Determinism

Two machines stay in step only if the race step gives the same numbers on both. The step uses integer and table arithmetic; a search of `src/game`, `src/render` and `src/formats` (2026-10-05) for `Math.sin|cos|tan|atan|asin|acos|exp|log|pow|hypot|cbrt` finds none. The `Math` functions the three directories use are `floor`, `min`, `abs`, `max`, `trunc`, `round`, `imul`, `ceil`, `sign` (all exact), `sqrt` (the integer square root in `src/game/view.js`; IEEE 754 requires it to be correctly rounded, so every engine gives the same value) and `random`, which seeds the computer racers' drivers from the host's seed (`src/game/race.js`) and drives the duck game (not part of a link race). No clock or storage is read by the step (the race clock of a link race is advanced by frames). The checksum every 64 frames stops a game that drifts anyway.

## Privacy and the network

* WEBRTC PEERJS contacts the PeerJS cloud server and, through PeerJS's default configuration, public STUN (and PeerJS's TURN relay) servers; the two players see each other's network addresses, as in any WebRTC game. WEBRTC LOCAL contacts nothing outside the local network. Nothing is contacted unless the player opens one of the two items.
* A code names one waiting host, four digits: someone who guesses it first can take the seat. The host takes the first caller only. For a private game use WEBRTC LOCAL, or check the other player's driver name on the vehicle screen.
* Without a TURN relay two players behind symmetric NATs may not connect; PeerJS's default configuration has one, the local mode has none.
* The signaling server of WEBRTC LOCAL pairs the pages that ask it and relays their session descriptions; it never sees the game's packets and serves no game files. It limits a message to 16 kB and drops anything that is not a join, a signal or a leave.

## What is read of the DOS link and what is not ported

Partly read (2026-10-05, listing only, not confirmed in the running game; a lead, not a claim — docs/leads/menus.md has the menus):

* the swap routine `obj1+0x1dd30` (`WW.EXE:obj1+0x1dd30 fp=fd8e2919`; eax and edx hold a byte each, ebx a flag; it returns 0 or 1 and leaves the result word obj2+0x28c14: 1 a time-out, 2 Esc) is called by the menus (`obj1+0x5160`, `+0x5d4c`, `+0x7fd7`, `+0x80c6`, `+0x8b30`, `+0x987d`, `+0xac54`, `+0xb146`, `+0xc816`, `+0xf601`, `+0x10c45`) and before the race (`obj1+0x1bf58`, `+0x1c4b1`: the byte pair is the fire word and a second byte, the link word obj2+0x28c0c = 1 marks the one side), so the two machines' menus and the start are kept in step by swapping bytes;
* its states are the codes 0x44, 0x57, 0x5a and 0x4e that the send routine `obj1+0x1dc38` (`fp=280911f2`) takes and the receive routine `obj1+0x1db00` (`fp=e96a698a`) returns (what each code stands for was not established); the receive ring is a 0x4000 byte buffer at obj2+0x24b00 with a head word at +0x24afc and a count word at +0x24afe, read by `obj1+0x1df70` (one byte, a time-out of 0x110 counts), `+0x1e008` (a wait for one byte) and `+0x1e0a8` (a flush);
* the serial cable's handshake is `obj1+0x1e0fc` (`fp=00c11aed`); the modem's dialling is `obj1+0xe58`.

Not read, and not ported: the format of the DOS packets, what the game swaps each frame of a link race, the modem-mode branches of the race (a stun lasts 4 counts instead of 33 or 50, a time-out wrecks the human, `docs/leads/fire-items.md`), the phone book (the six numbers of the configuration, `comm.config-use`), the baud menu and the modem initialisation. The page's link race uses the rules of the two player race as they are ported.

## Not tested

* Two physical devices, two different browsers (Chrome against Firefox or Safari: the determinism above is read from the code, not measured), PeerJS across the internet (where STUN and the TURN relay actually come into play: the tests ran two pages in one Chrome through the real cloud server), WEBRTC LOCAL across a real network (only two pages of one machine through the loopback address), the frame rate and delay over a real line, and a game longer than a few hundred frames in the browser (the headless check ran 900).
* A page in the background does not run frames (the browser stops its animation frames), so it stalls the other player until the five second time-out.

## Testing

* `npm test` — `test/net.test.js`: the packets, the session over a virtual line that loses and reorders packets (lockstep gives both sides the same inputs, repeats, desync and time-outs), the pairing and the signaling server (real WebSockets), the page's menus and setup bytes.
* `npm run check:link` — two machines with their own race state, linked by sessions over a line that loses 20% of the packets, race every track of the first six in both modes for 900 frames: the same checksum at every frame and the same places; each draws its own view (needs a local WACKY.DAT).
* `tools/link-test.html` (served by `npm run dev`) connects two pages of any of the three kinds and runs 600 frames of dummy input; `tools/link-frames.html` shows two copies of the game side by side and has helpers (`linkUp()`, `raceUp()`) that drive both through the menus, for tests by script.
