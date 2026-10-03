// node tools/dosbox/jev-judge.mjs [--dry-run] [--questions file.json]
// A test-play oracle: reads the paused player's numeric state from the running game through the DOSBox bridge and asks the jev model (TypeSafe's System One API, docs in jev/, which
// is gitignored) typed questions about it, for example whether the car is stuck or whether a boost is running. Nothing is sent but these numbers (no archive bytes, no pictures).
// The request goes to api.typesafe.ai, so it needs TYPESAFE_API_KEY in the environment (node --env-file=.env tools/dosbox/jev-judge.mjs; .env is gitignored) and is made only without --dry-run; --dry-run prints the request and sends nothing.
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, questions: { type: 'string' } } });
const BASE = 0x239000; // @math the data object's live base in this DOSBox build (obj2; the records carry the bases)
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
const car = await i32(BASE + 0x1d5b0);
const state = { game: 'Wacky Wheels (1994), race paused by the test harness', car: { throttle: await i16(car + 0x42), speed: await i16(car + 0x26), boostActive: await i16(car + 0xb4), boostTimer: await i16(car + 0xb6), surface: await i16(car + 0x56) },
  heading: await i32(BASE + 0x1d5d4), headingNote: 'one turn is 1920; 0 is +x, 480 is +y (down the map)', terrainValue: await i32(BASE + 0x1e568), collisionWord: await i16(BASE + 0x28bae), collisionNote: '0 none, 1 wall, 2 object, 3 racer, 4 pit', worldColumn: await i32(BASE + 0x1d7a4), worldRow: await i32(BASE + 0x1d7a8), throttleCap: 100 };
const questions = values.questions ? JSON.parse(await readFile(values.questions, 'utf8')) : {
  moving: { type: 'noul', instructions: 'Is the car moving at a speed above zero?' },
  stuck: { type: 'noul', instructions: 'Has the car just hit a wall (the collision word is 1)?' },
  boosting: { type: 'noul', instructions: 'Is a boost running (the boost word is 1 and the boost timer above 0)?' },
  onRoad: { type: 'choice', instructions: 'Which kind of surface is the car on? Terrain value 0 is road, 1 is grass or sand, 2 a boost strip, 3 a wall.', criteria: { road: null, offroad: null, boostStrip: null, wall: null, other: null } },
};
const body = { state, model: 'jev-latest', questions };
if (values['dry-run']) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
if (!process.env.TYPESAFE_API_KEY) { console.error('TYPESAFE_API_KEY is not set; use --dry-run to see the request'); process.exit(1); }
const res = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
console.log(res.status, JSON.stringify(await res.json(), null, 2));
