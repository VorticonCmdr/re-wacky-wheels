// Runs a COMM-BAT game headless on a local WACKY.DAT: two machines, each with its own race state, linked by sessions over a virtual line that loses and reorders packets, swap the players' input every
// frame (the host is player one, the guest player two) and must stay in step: the same checksum at every frame and the same places at the end; each machine also draws its own view of the race.
// A smoke test like the other check:* scripts. usage: node scripts/check-link.js [WACKY.DAT] [--frames N] [--loss 0.2]
import { readFile } from 'node:fs/promises';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { startRace, stepRace, beginIntro } from '../src/game/race.js';
import { carsBySeat, swapSeat } from '../src/game/versus.js';
import { finalPlaces } from '../src/game/versus-race.js';
import { defaultSettings } from '../src/game/menus.js';
import { loadHudArt } from '../src/render/hud.js';
import { drawRaceFrame } from '../src/render/race-frame.js';
import { parseMov } from '../src/game/figure.js';
import { lossyLine } from '../src/net/loopback.js';
import { PHASE } from '../src/net/session.js';
import { INPUT_SIZE, encodeInput, decodeInput, raceHash, delayFor } from '../src/net/race.js';
import { crc32 } from '../src/evidence/crc32.js';

const args = process.argv.slice(2), arg = (name, dflt) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : dflt), frames = arg('--frames', 900), loss = arg('--loss', 0.2); // the default length of a drive: about 13 seconds
const path = args.find(a => /\.dat$/i.test(a)), dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT'), members = archiveMembers(dat), archive = crc32(dat);
const none = { left: false, right: false, accelerate: false, fire: false, brake: false, spin: false };
let problems = 0;

const machine = (track, cars, slots, seed) => {
  const world = { ...loadTrack(dat, String(track), 1, slots[0], { split: false }), lion: lionBytes(members) };
  const state = { mov: parseMov(members.get('GIG.MOV')), unproven: new Set(), detail: 1, class: 1, engine: 1, dat, hudArt: loadHudArt(members), menu: { settings: defaultSettings() }, seed, humanSlot: slots[0], slots: null, versusMode: { kind: 'race', cars, laps: 2, class: 1, engine: 1, slots, scores: [0, 0] } };
  startRace(state, world, 2); beginIntro(state); state.versusMode = null;
  return state;
};
// What a player holds at a frame: accelerate always, the steering changes every thirty frames and differently for the two players, fire in bursts.
const keysOf = (who, f) => { const k = Math.floor(f / 30 + who) % 3; return { ...none, accelerate: true, left: k === 1, right: k === 2, fire: (f + who * 7) % 60 < 5 }; };

const raceTracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.replace('.GAM', ''))).sort((a, b) => a - b).slice(0, 6);
for (const track of raceTracks) for (const cars of [1, 2]) {
  try {
    const line = lossyLine({ loss, seed: track * 7 + cars, archive: [archive, archive] }), [hostSession, guestSession] = line.sessions, slots = [7, 4], seed = 1000 + track;
    line.advance(2500);
    if (hostSession.phase !== PHASE.LINKED || guestSession.phase !== PHASE.LINKED) throw new Error('the sessions did not link');
    hostSession.start({ delay: delayFor(hostSession.rtt, 14), seed, size: INPUT_SIZE }); line.advance(1500); // @math the frame period in ms, about
    const sides = [{ session: hostSession, state: machine(track, cars, slots, seed), seat: 0 }, { session: guestSession, state: machine(track, cars, slots, seed), seat: 1 }];
    const hashes = [[], []], steps = [0, 0];
    for (let guard = 0; guard < 200000 && steps.some(n => n < frames); guard++) { // @math a bound on the virtual time
      line.advance(5);
      sides.forEach((side, i) => {
        while (steps[i] < frames && side.session.ready()) {
          const [one, two] = side.session.take();
          stepRace(side.state, { p1: decodeInput(one), p2: decodeInput(two) });
          hashes[i].push(raceHash(side.state, carsBySeat(side.state))); side.session.report(hashes[i].at(-1));
          side.session.submit(encodeInput(keysOf(side.seat, steps[i] + side.session.frames.delay)));
          steps[i]++;
          if (steps[i] % 100 === 0) { if (side.seat === 1) swapSeat(side.state); drawRaceFrame(side.state, new Uint8Array(320 * 200)); if (side.seat === 1) swapSeat(side.state); } // @math a draw of the own view every hundred frames
        }
        if (steps[i] < frames && !side.session.ready()) side.session.waiting();
      });
    }
    if (steps.some(n => n < frames)) throw new Error(`the race stalled at ${steps}`);
    const at = hashes[0].findIndex((h, i) => h !== hashes[1][i]);
    if (at >= 0) throw new Error(`the two games differ from frame ${at}`);
    const places = sides.map(s => finalPlaces(s.state).join());
    if (places[0] !== places[1]) throw new Error(`the places differ: ${places}`);
    console.log(`ok   track ${track}, ${cars === 1 ? 'head to head' : 'all cars'}: ${frames} frames in step over a line that loses ${Math.round(loss * 100)}%, round trip ${Math.round(hostSession.rtt)} ms, delay ${hostSession.frames.delay}`);
  } catch (e) { problems++; console.log(`FAIL track ${track} cars ${cars}: ${e.stack?.split('\n').slice(0, 3).join(' | ') ?? e.message}`); }
}
console.log(`check:link ${raceTracks.length * 2} games, ${problems} problems`);
process.exit(problems ? 1 : 0);
