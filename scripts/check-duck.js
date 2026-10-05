// Runs the duck game's race frames headless on the twelve zone tracks of a local WACKY.DAT: the drive on the keys below with hogs to fire, and a second run in which every duck is stunned at once
// so that the explosions and the next rounds happen. A smoke test of the integration (src/game/duck.js, race.js), not evidence: it fails on an exception, a number that is not finite or a duck that
// leaves the route's neighbourhood. usage: node scripts/check-duck.js [WACKY.DAT] [--frames N]
import { readFile } from 'node:fs/promises';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { startRace, stepRace } from '../src/game/race.js';
import { duckTrack, duckRules } from '../src/game/duck.js';

const args = process.argv.slice(2), frames = Number(args[args.indexOf('--frames') + 1] || 900), path = args.find(a => /\.dat$/i.test(a)); // @math the default length of a run: about 80 seconds of play
const dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT');
const members = archiveMembers(dat), R = duckRules();
const tracks = [1, 2, 3, 4, 5, 6].flatMap(zone => [duckTrack(zone), ...(members.has(`${duckTrack(zone, true)}.GAM`) ? [duckTrack(zone, true)] : [])]); // @math six zones of each kind
let problems = 0;
for (const track of tracks) {
  for (const mode of ['drive', 'stun']) {
    try {
      let seed = track; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // @math the Lehmer generator, a repeatable stand-in for the draw of the route entry
      const state = { class: R.level, engine: R.engine, detail: 1, humanSlot: 7, duckMode: { zone: 1 }, rng };
      startRace(state, { ...loadTrack(dat, String(track), R.engine, 7), lion: lionBytes(members) }, 1);
      if (state.ai.racers.length !== R.racers + 1) throw new Error(`${state.ai.racers.length} racers`);
      let rounds = 0;
      for (let f = 0; f < frames; f++) {
        if (f === 100) state.player.car = { ...state.player.car, counter: 20 }; // @math some hogs
        if (mode === 'stun' && f % 150 === 20) state.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (n === 0 || r.crashed || r.hit ? r : { ...r, hit: 1, hitStamp: state.tick, hitSpin: 0 })) }; // @math a stun of every duck every 150 frames
        const wiggle = Math.floor(f / 40) % 3; // @math a steering change every forty frames
        stepRace(state, { accelerate: true, brake: f % 300 > 280, left: wiggle === 1, right: wiggle === 2, spin: false, fire: f % 90 < 30 }); // @math the brake and the fire keys
        for (const r of state.ai.racers) if (![r.x, r.y].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.x > 0xffff || r.y > 0xffff) throw new Error(`frame ${f}: a duck at ${r.x}, ${r.y}`);
        if (!Number.isFinite(state.duck.score) || state.duck.score < 0 || state.duck.score > R.scoreCap) throw new Error(`frame ${f}: score ${state.duck.score}`);
        rounds = state.duck.round;
      }
      if (mode === 'stun' && rounds < 2) throw new Error(`only ${rounds} rounds after ${frames} frames`); // @math the stuns at 20, 170 and 320 end the first round and the next
      console.log(`ok   track ${track} ${mode}: score ${state.duck.score}, round ${rounds}, ammo ${state.car.counter}`);
    } catch (e) { problems++; console.log(`FAIL track ${track} ${mode}: ${e.message}`); }
  }
}
console.log(`check:duck ${tracks.length} tracks, ${problems} problems`);
process.exitCode = problems ? 1 : 0;
