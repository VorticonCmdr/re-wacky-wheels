// Runs the page's race frames headless on every track of a local WACKY.DAT: the countdown, the drive on the keys below and, in a second run with the lap word one short of the laps
// word, the finish. It is a smoke test of the integration (src/game/race.js), not evidence: it fails on an exception, a number that is not finite or a position outside the world.
// usage: node scripts/check-race.js [WACKY.DAT] [--frames N]
import { readFile } from 'node:fs/promises';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { parseMov } from '../src/game/figure.js';
import { startRace, stepRace, beginIntro } from '../src/game/race.js';

const args = process.argv.slice(2), frames = Number(args[args.indexOf('--frames') + 1] || 1500), path = args.find(a => /\.dat$/i.test(a)); // @math the default length of a run: about two minutes of racing
const dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT');
const members = archiveMembers(dat), mov = parseMov(members.get('GIG.MOV'));
const names = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => n.replace('.GAM', '')).sort((a, b) => a - b);
const WORLD = 0x10000; // @math the world is a 16-bit square of words
let problems = 0;
const finite = (state, label) => {
  const c = state.car, values = [c.cx, c.cy, c.px, c.py, c.heading, c.throttle, c.speed, state.tick, state.place];
  if (!values.every(Number.isFinite) || [c.cx, c.cy, c.px, c.py].some(v => v < 0 || v >= WORLD)) throw new Error(`${label}: bad values ${JSON.stringify(values)}`);
};
for (const name of names) {
  for (const mode of ['drive', 'finish', 'results', 'intro']) {
    try {
      const world = { ...loadTrack(dat, name), lion: lionBytes(members) }, state = { mov, unproven: new Set(), hud: null };
      startRace(state, world, 6); // @math the six lap race
      if (mode === 'finish') state.laps = { ...state.laps, lap: 5 }; // @math one lap short of the laps word
      if (mode === 'intro') { // the fly-in before the countdown (race.intro): it ends at the race's own camera with the frame counter still 0
        const before = { cx: state.car.cx, cy: state.car.cy, heading: state.car.heading };
        beginIntro(state);
        if (!state.intro) throw new Error('no intro');
        let passes = 0;
        while (state.intro && passes < 100) { stepRace(state, { accelerate: true, brake: false, left: false, right: false, spin: false, fire: false }); passes++; } // @math a bound far above the longest intro
        if (state.intro || passes < 12 || passes > 25) throw new Error(`the intro took ${passes} passes`); // @math the swing alone takes 12 passes, the slide adds up to 13
        if (state.car.cx !== before.cx || state.car.cy !== before.cy || state.car.heading !== before.heading || state.tick !== 0) throw new Error('the intro did not end at the race camera with the counter 0');
      }
      if (mode === 'results' && !state.ai) continue; // the tracks without computer cars have no places to hand out
      let lionGone = false; // the starter's word: once a frame leaves the lion out of view it stays off (race.start-rules)
      for (let f = 0; f < frames; f++) {
        if (mode === 'results') { // the human finishes at frame 100, two computer racers at 120: the labels, the message and the leaderboard 800 counts later
          if (f === 100) state.laps = { ...state.laps, lap: state.total + 1 }; // @math the lap word one past the laps word
          if (f === 120) state.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (n === 1 || n === 2 ? { ...r, lap: state.total + 1 } : r)) }; // @math two computer racers on the last step
        }
        const wiggle = Math.floor(f / 40) % 3; // @math a steering change every forty frames
        if (f === 100) state.player.car = { ...state.player.car, held: 3, counter: 20 }; // @math a held fan and some hedgehogs, so that the fire has something to shoot (the pickups are not on every route)
        stepRace(state, { accelerate: true, brake: f % 300 > 280, left: wiggle === 1, right: wiggle === 2, spin: f % 200 > 190, fire: f % 90 < 30 }); // @math the brake, the hand brake and the fire keys in turns
        finite(state, `${name} ${mode} frame ${f}`);
        if (state.lionShown === false) lionGone = true; else if (lionGone) throw new Error(`${name} ${mode} frame ${f}: the starter lion is drawn again`);
        for (const d of state.fx.after) if (d.x < 0 || d.y < 0 || d.x + d.width > 320 || d.y >= 200 || d.bytes.length !== d.width * d.height) throw new Error(`${name} ${mode} frame ${f}: an effect blit starting outside the screen or of the wrong size (the tyre strips run off the bottom: the game cuts their rows) ${JSON.stringify([d.width, d.height, d.x, d.y, d.bytes.length])}`); // @math the screen is 320 x 200
      }
      if (mode === 'results') {
        const r = state;
        if (r.playerPlace !== 1 || r.labels.length !== 3 || !r.message || r.result !== 'leaderboard' || r.totals[0] !== 9) throw new Error(`results: place ${r.playerPlace}, labels ${r.labels.length}, message ${r.message?.text}, result ${r.result}, totals ${r.totals}`); // @math three labels and the 9 points of the first place of an amateur race
      }
      console.log(`ok   track ${name} ${mode}: tick ${state.tick}, lap ${state.laps.lap}, finished ${state.finished}, place ${state.place}, counter ${state.car.counter}, wrecked ${state.car.crashed}`);
    } catch (e) { problems++; console.log(`FAIL track ${name} ${mode}: ${e.message}`); }
  }
}
console.log(`check:race ${names.length} tracks, ${problems} problems`);
process.exitCode = problems ? 1 : 0;
