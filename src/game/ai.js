// The computer racers (ai.rules, STATIC; ai.motion-observed for what a recording shows): they start on the grid, each on the route at the point as far along
// as its row is from the route's start with a sideways offset that wears off, then walk the route's point array a number of points a frame set by a state
// machine, and the progress update counts their laps. Racer 0 is the player and is not moved here.
import { K } from '../evidence/k.js';
import { blinkStart } from './blink.js';
import { rasterSegment } from '../formats/route.js';
import { gridValue } from './laps.js';
import { CONTACT } from './contact.js';
import { stunStep } from './shots.js';
import { kid } from './classes.js';

const RULES = () => K({ startBranch: 0x70f6, loop: 0x18cac, helper: 0x18b20, aiLap: 0x2e86, firstRacer: 1, lastRacer: 7, level: 89, states: { first: 0, second: 1, level: 2, boost: 3 }, lateral: { decay: 4, left: 3, right: 4 }, push: { range: 0x14, steps: 0x3c }, minAdvance: 1, firstStep: 1, finishExtra: 1, catchUp: { firstIndex: 4, base: 7, counter: 0x7d00, bonuses: [0x10, 0x1c, 0x24, 0x28], playerFirst: 5, playerBoosts: { 1: [3, 4, 5], 2: [3, 2, 1], 3: [2, 1, 0] } }, lapShift: 10, keyWords: [0x843a, 0x843e], routeRefWords: [0x28c04, 0x28c06] }, 'ai.rules');
const SETUP = () => K({ levelAt: 0x28b84, racers: 0x08, startState: 0x00, phaseOneFrames: 0x18, fastBonus: 0x3c, rankStep: 0x0a, slowOffset: 0x04, counters: [0x16, 0x1c, 0x1e, 0x22, 0x28, 0x32, 0x3a, 0x3c], effectWords: [4, 4, 4, 4, 4, 3, 3, 3] }, 'ai.speed-setup');
const GRID = () => K({ branch: 0x00, gridFlag: 0x00, firstIndex: 0x04, xBias: 0x50, xStep: 0x14, entries: 0x08, second: { track: 7, y: 2144, x: [1248, 1268, 1288, 1308, 1328, 1188, 1208, 1228] }, shoot: { track: 16, gridFlag: 1, racers: 2, x: [1248, 2848, 1248, 1312, 1248, 1312, 1248, 1312], y: [2042, 2072, 1792, 1888, 1984, 2080, 2176, 2272] } }, 'racer.start-grid');
const ROUTE = () => K({ tableObject: 2, tableOffset: 0x12350, entryBytes: 0x08, countOffset: 0x04, compassOffset: 0x06, pointBytes: 0x04, coordWords: [0x00, 0x02, 0x04, 0x06], coordBias: 0x0400 }, 'rd.route');
const TOUCH_RANGE = () => CONTACT().range;
const READ = () => K({ countBytes: 0x02, recordBytes: 0x0e, coordBias: 0x0400, words: [0x00, 0x02], tableWord: 0x0a }, 'rd.read');

const routeCache = new WeakMap();

// The route as the loader makes it: for every record the rasterised points and the file's compass word (rd.route, rd.read).
export function routeEntries(route) {
  if (!routeCache.has(route)) {
    const R = ROUTE(), D = READ(), [ax, ay, bx, by] = R.coordWords.map(w => w / 2), compass = D.tableWord / 2; // @math word offsets to word indices
    routeCache.set(route, route.map(r => ({ points: rasterSegment(r[ax] + R.coordBias, r[ay] + R.coordBias, r[bx] + R.coordBias, r[by] + R.coordBias), compass: r[compass] })));
  }
  return routeCache.get(route);
}

// The eight start positions of a road race: the grid line of racer.start-grid, the first racer's x and y being the player's start (the table is filled from
// the entry 4 down, wrapping from 0 to 7).
export function gridPositions(start) {
  const G = GRID(), xs = new Array(G.entries);
  let at = G.firstIndex, x = start.x + G.xBias;
  for (let k = 1; k <= G.entries; k++) { xs[at] = x; at--; x -= G.xStep; if (at < 0) at = G.entries - 1; } // @math the last entry
  return xs.map(px => ({ x: px, y: start.y }));
}

// The computer racers at the start of a race (the grid branch of racer.init and ai.speed-setup, the speed words replaced by VEL.TAB values as ai.race-speeds
// has it). `speeds` is VEL.TAB; the level is the word obj2+0x28b84 (ai.rules: 89 in every record). Returns null when the start does not lie on the first route entry
// (the grid branch reads |y - y_ref| points into it): the shootout, duck shoot and bonus starts of the archive (tracks 16, 17, 18, 40, 41 and 42) are other branches.
// The lateral word of a racer that starts at the grid x `x` (obj1+0x70f6): left or right of the route's first point, or 0 on it; the humans of a two player race have it too.
export function startMode(world, x) {
  const A = RULES(), D = READ(), ref = world.route[0][D.words[0] / 2] + D.coordBias; // @math word offsets to word indices
  return x < ref ? A.lateral.left : x > ref ? A.lateral.right : 0;
}

export function createAi(world, { level = RULES().level, speeds = world.aiSpeeds, threshold = 0, computers = null } = {}) { // `computers` the first computer racer of a two player race (the racers before it are the humans)
  const A = RULES(), S = SETUP(), entries = routeEntries(world.route), first = world.route[0], D = READ();
  const ref = { x: first[D.words[0] / 2] + D.coordBias, y: first[D.words[1] / 2] + D.coordBias }; // @math word offsets to word indices
  const positions = gridPositions(world.start), top = entries[0].points.length;
  if (Math.abs(world.start.y - ref.y) >= top) return null;
  const racers = positions.map((p, n) => {
    const index = Math.abs(p.y - ref.y), lateral = Math.abs(ref.x - p.x);
    return {
      n, x: p.x, y: p.y, blink: blinkStart(), hit: 0, hitStamp: 0, hitSpin: 0, entry: 0, index, compass: entries[0].compass, lap: 0, prev: gridValue(world.pos, p.x, p.y), key1: gridValue(world.pos, p.x, p.y), key2: gridValue(world.pos, p.x, p.y), place: 0,
      mode: p.x < ref.x ? A.lateral.left : p.x > ref.x ? A.lateral.right : 0, lateral, state: S.startState, first: S.phaseOneFrames, second: S.counters[n],
      level: speeds[level], fast: speeds[level + S.fastBonus - S.rankStep * (A.lastRacer - n)], slow: level - S.slowOffset - S.rankStep * (A.lastRacer - n), // the word +0xc is not a table index after the start
    };
  });
  return { racers, entries, last: entries.length - 1, level, speeds, threshold, finished: 0, ...(computers === null ? {} : { first: computers }) };
}

const copy = r => ({ ...r });

// The catch-up helper of state 2 (ai.rules): returns the advance and moves the racer into state 3 when it is far enough behind the player.
function helper(r, advance, env, level, speeds, threshold, events) {
  const A = RULES(), C = A.catchUp;
  if (env.noHelper || r.n < C.firstIndex) return advance; // the helper does nothing in a two player race (obj1+0x18b2d)
  const d = env.playerKey2 - r.key2, t = C.base + threshold - r.n; // t = 7 less the index plus the class's word obj2+0x1ece0 (race.class-levels)
  if (t > d) { if (r.state === A.states.boost) r.state = A.states.level; }
  else if (r.state !== A.states.boost) {
    r.state = A.states.boost; r.second = C.counter; r.fast = speeds[level] + C.bonuses[r.n - C.firstIndex]; advance = r.fast; events.add('the catch-up helper and state 3');
  }
  if (r.n >= C.playerFirst) {
    const boosts = C.playerBoosts[env.playerPlace], bonus = boosts ? boosts[r.n - C.playerFirst] : 0;
    if (bonus > 0) { advance += bonus; events.add('the bonus of racers 5 to 7 for the player in 1st to 3rd place'); }
  }
  return advance;
}

// One race frame of the computer racers: the walk of each, then the progress update of each. env = { pos, trailer, total, playerKey2, playerPlace, tick, clock }.
export function stepAi(ai, env) {
  const A = RULES(), events = new Set(), racers = ai.racers.map(copy), { entries, last } = ai, humans = env.humans ?? (env.human ? [env.human] : []), contactsBy = humans.map(() => []);
  for (let n = ai.first ?? A.firstRacer; n <= A.lastRacer; n++) { // the humans of a two player race are the racers before `first`
    const r = racers[n];
    if (r.hit !== 0) { racers[n] = stunStep(r, env.tick, env.clock, env.sounds); continue; } // a hit racer does not move, steer or count its states (obj1+0x18cdb)
    let advance = 0;
    if (r.state === A.states.first) { advance = r.slow; r.first--; if (r.first <= 0) r.state = A.states.second; }
    else if (r.state === A.states.second) { advance = r.fast; r.second--; if (r.second <= 0) r.state = A.states.level; }
    else if (r.state === A.states.level) advance = env.child ? r.level : helper(r, r.level, env, ai.level, ai.speeds, ai.threshold, events); // the helper does nothing in the kid mode
    else if (r.state === A.states.boost) { // the boosted advance while the counter runs and the player is far enough ahead
      advance = r.fast; r.second--;
      const d = env.playerKey2 - r.key2;
      if (!(r.second > 0 && d > A.catchUp.base + ai.threshold - n)) r.state = A.states.level;
    }
    let offset = 0;
    if (r.mode !== 0) { offset = r.mode === A.lateral.left ? -r.lateral : r.lateral; r.lateral -= A.lateral.decay; if (r.lateral <= 0) r.mode = 0; }
    if (r.mode === 0 && r.state === A.states.level) {
      for (let k = A.lastRacer; k >= A.firstRacer; k--) {
        if (k === n) continue;
        if (Math.abs(racers[k].x - r.x) + Math.abs(racers[k].y - r.y) < A.push.range) { advance += A.push.steps; events.add('the push of racers close together'); break; }
      }
    }
    if (env.child && !env.finished) { advance -= kid().slowdown; if (advance <= kid().floor) advance = kid().floor; } // the kid mode slows every computer racer until the finish (obj1+0x18ebb)
    for (let s = 1; s <= advance; s++) {
      const e = entries[r.entry], p = e.points[r.index];
      r.x = p[0] + offset; r.y = p[1]; r.index++;
      if (r.index >= e.points.length) { r.entry = r.entry + 1 > last ? 0 : r.entry + 1; r.index = 0; r.compass = entries[r.entry].compass; }
      humans.forEach((human, h) => { if (human && Math.abs(r.x - human.x) + Math.abs(r.y - human.y) < TOUCH_RANGE() && !contactsBy[h].includes(n)) { contactsBy[h].push(n); if (r.crashed) r.crashed = false; } }); // after every route point the racer looks at the human's car point (racer.contact-response); the contact sets its state word to 1 again, which ends a crash (race.head-on)
    }
  }
  const moved = { ...ai, racers };
  return { ai: env.deferProgress ? moved : progressAi(moved, env), events: [...events], contacts: contactsBy[0] ?? [], contactsBy };
}

// The progress update of the computer racers (obj1+0x2e86): the lap count, the finishing numbers and the progress keys of every racer, after the player's own.
export function progressAi(ai, env) {
  const A = RULES(), racers = ai.racers.map(copy);
  let finished = ai.finished;
  for (let n = ai.first ?? A.firstRacer; n <= A.lastRacer; n++) { // the progress update of the computer racers (obj1+0x2e86)
    const r = racers[n], v = gridValue(env.pos, r.x, r.y);
    if (v === A.firstStep && r.prev === env.trailer && r.lap < env.total + v) r.lap++;
    if (r.lap === env.total + A.finishExtra && r.place === 0) { finished++; r.place = finished; }
    r.key1 = r.lap * (1 << A.lapShift) + v; r.key2 = r.lap * env.trailer + v; r.prev = v;
  }
  return { ...ai, racers, finished };
}

// The player's place (obj1+0x28a4): the racers sorted by their first key, the highest first, by the routine's exchange sort; the place is the player's position
// in that order, 1 to 8, and stays as it was while another racer holds the same key.
export function rankPlayer(keys, place, who = 0) { // `who` the racer whose place it is (the second human of a two player race is the racer 1)
  const list = keys.map((key, n) => ({ key, n }));
  for (let i = 0; i < list.length - 1; i++) for (let j = i + 1; j < list.length; j++) if (list[i].key < list[j].key) { const t = list[i]; list[i] = list[j]; list[j] = t; }
  const at = list.findIndex(e => e.n === who), tie = list.some((e, i) => i !== at && e.key === keys[who]);
  return tie ? place : at + 1; // @math places count from 1
}
