// Runs the two player modes headless on a local WACKY.DAT: the shoot-out on the twelve zone tracks (both players driving and firing on scripted keys, a forced wreck that must lead through the message to the
// next round with the score of the survivor, and a match that must end at the hits word) and the two player race on every race track (head to head and with all cars: the countdown, the drive and a forced finish). A smoke test of the integration (src/game/versus.js, race.js), not evidence: it fails on an exception, a
// number that is not finite or a round that does not go on. usage: node scripts/check-versus.js [WACKY.DAT] [--frames N]
import { readFile } from 'node:fs/promises';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { startRace, stepRace } from '../src/game/race.js';
import { duckTrack } from '../src/game/duck.js';
import { carsBySeat } from '../src/game/versus.js';
import { parseMov } from '../src/game/figure.js';

const args = process.argv.slice(2), frames = Number(args[args.indexOf('--frames') + 1] || 600), path = args.find(a => /\.dat$/i.test(a)); // @math the default length of a drive: about a minute
const dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT');
const members = archiveMembers(dat);
const tracks = [1, 2, 3, 4, 5, 6].flatMap(zone => [duckTrack(zone), ...(members.has(`${duckTrack(zone, true)}.GAM`) ? [duckTrack(zone, true)] : [])]); // @math six zones of each kind
const none = { accelerate: false, brake: false, left: false, right: false, spin: false, fire: false };
let problems = 0;
const start = (track, hits) => {
  const world = { ...loadTrack(dat, String(track), 2, 7, { split: true }), lion: lionBytes(members) }; // @math the 6 hp engine and the first driver slot of the human
  const state = { mov: parseMov(members.get('GIG.MOV')), unproven: new Set(), hud: null, detail: 1, class: 4, engine: 2, versusMode: { hits, slots: [7, 3], scores: [0, 0] }, humanSlot: 7 }; // @math the class 4 and the drivers 7 and 3
  startRace(state, world, 1);
  return state;
};
const finite = (state, label) => {
  for (const c of carsBySeat(state)) if (![c.cx, c.cy, c.px, c.py, c.heading, c.throttle, c.speed].every(Number.isFinite) || [c.cx, c.cy, c.px, c.py].some(v => v < 0 || v >= 0x10000)) throw new Error(`${label}: bad car ${JSON.stringify([c.cx, c.cy, c.px, c.py, c.heading])}`); // @math the world is a 16-bit square of words
};
const wreckSeat = (state, n, pic = 0) => { // the second seat is held apart while the first is the viewer
  const holder = n === 0 ? state : state.seat2, car = { ...holder.car, wrecked: true, wreckPic: pic, wreckShown: pic, throttle: 0 };
  holder.car = car; holder.player = { ...holder.player, car };
};
for (const track of tracks) {
  try {
    const state = start(track, 2); // @math a match to 2 hits
    for (let f = 0; f < frames; f++) { // both drive and fire, a steering change every thirty frames
      const k = Math.floor(f / 30) % 3; // @math thirty frames a steering change
      stepRace(state, { p1: { ...none, accelerate: true, left: k === 1, right: k === 2, fire: f % 60 < 20, taunt: f % 100 === 5 ? 1 + (Math.floor(f / 100) % 6) : undefined }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }); // @math the fire key held a third of the time, a taunt every hundred frames
      finite(state, `drive frame ${f}`);
    }
    if (state.tauntCount > 6) throw new Error(`${state.tauntCount} taunts taken, six a round are the limit`); // @math six taunts a round
    const match = start(track, 2); // @math a match to 2 hits: two forced wrecks of player two end it
    let rounds = 0;
    for (let f = 0; f < 4000 && !match.versus.over; f++) { // @math enough frames for two rounds
      if (match.versus.message === null && !carsBySeat(match)[1].wrecked && f > 20) { wreckSeat(match, 1); rounds++; } // @math a wreck after the first frames of a round
      stepRace(match, { p1: none, p2: none });
      finite(match, `match frame ${f}`);
    }
    if (!match.versus.over || match.result !== 'versus' || match.versus.scores[0] !== 2) throw new Error(`the match did not end: ${JSON.stringify([match.versus.over, match.result, match.versus.scores, rounds])}`); // @math two hits
    console.log(`ok   track ${track}: ${frames} frames driven, a match of ${rounds} rounds to ${match.versus.scores.join(':')}`);
  } catch (e) { problems++; console.log(`FAIL track ${track}: ${e.message}`); }
}
// the two player race on the race tracks: 1 to 15 and the bonus pack's 22 to 36
const raceTracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.replace('.GAM', ''))).filter(n => !tracks.includes(n)).sort((a, b) => a - b);
const startRaceTrack = (track, cars) => {
  const world = { ...loadTrack(dat, String(track), 1, 7, { split: true }), lion: lionBytes(members) }; // @math the 12 hp engine and the first driver slot of the human
  const state = { mov: parseMov(members.get('GIG.MOV')), unproven: new Set(), hud: null, detail: 1, class: 1, engine: 1, versusMode: { kind: 'race', cars, laps: 2, class: 1, engine: 1, slots: [7, 4] }, humanSlot: 7 }; // @math two laps, the class 1 and the drivers 7 and 4
  startRace(state, world, 2); // @math the two laps
  return state;
};
for (const track of raceTracks) {
  for (const cars of [1, 2]) { // @math the word 1 is RACE HEAD TO HEAD and 2 RACE WITH ALL CARS
    try {
      const state = startRaceTrack(track, cars); let lionGone = false;
      if (Boolean(state.ai) !== (cars === 2)) throw new Error('the computer racers of the mode'); // @math the word 2
      for (let f = 0; f < frames && !state.result; f++) {
        const k = Math.floor(f / 30) % 3; // @math thirty frames a steering change
        stepRace(state, { p1: { ...none, accelerate: true, left: k === 1, right: k === 2, fire: f % 60 < 20 }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }); // @math the fire key held a third of the time
        finite(state, `race frame ${f}`);
        if (state.lionOn === false && (state.lionShown !== false || state.seat2.lionShown !== false)) throw new Error(`race frame ${f}: the starter word is off but a viewer still draws the lion`); // both viewers share the word (race.start-rules)
        if (state.tick < 2) lionGone = false; // a restart after a head-on crash sets up the race again, the starter word included (obj1+0x2014c)
        if (state.lionOn === false) lionGone = true; else if (lionGone) throw new Error(`race frame ${f}: the starter word is back on`);
        if (f === 200) state.seat2.laps = { ...state.seat2.laps, lap: state.total + 1 }; // @math a forced finish of player two at the frame 200
      }
      if (state.result !== 'versusRace') throw new Error(`the race did not end: ${state.result}`);
      console.log(`ok   race track ${track}, ${cars === 2 ? 'all cars' : 'head to head'}: finished by player ${state.versus.finisher + 1}`); // @math players count from 1
    } catch (e) { problems++; console.log(`FAIL race track ${track} cars ${cars}: ${e.message}`); }
  }
}
console.log(`check:versus ${tracks.length} zone tracks and ${raceTracks.length} race tracks, ${problems} problems`);
process.exitCode = problems ? 1 : 0;
