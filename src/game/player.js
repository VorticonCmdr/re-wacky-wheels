// The player's car with the objects it touches: one call of the race frame for the player (the car step with the walk's contacts, then the object pass). The live objects
// carry their consumed words; the call after a contact with an obstacle at the throttle cap is the one that wrecks the car (pickups.js, car.js).
import { stepCar, wreck, collisionCodes, bumpCar } from './car.js';
import { touch } from './pickups.js';
import { viewSetup } from './view.js';
import { objectRecord } from './objects.js';
import { playerRecord } from './player-car.js';
import { isCentred, zonesOf } from './zones.js';

const CODES = collisionCodes;
const K_COUNTER = 2; // @math the counter pickup is the last kind that is not a held item (atr.kind-effects)
const HIT = 1; // @math the hit marker of the object's word +2 (pickups.js)
const DRIVER = 'driver', SWIPE = 22, BOOM = 13, CLANG = 21, ZONE_CENTRE = 3; // @math the sound numbers SWIPE, BOOM and CLANG (audio.race-sounds) and the middle column zone (car.object-zones)

export const createPlayer = (car, objects) => ({ car, objects, pending: false, word: 0, touched: 0, volley: 0 }); // volley: the racer word +0x12, the shots of the last fire still in flight (item.shot-rules)

// One call. `racers` are the computer racers' records (positions), `racing` whether the race mode is 2. Returns the next player and what the call relied on without proof.
export function stepPlayer(player0, input, world, { racing = true, racers = [], ...env } = {}) {
  const C = CODES(), cleared = player0.objects.some(o => o.consumed === HIT); // the hit marker lasts one call: the object pass sets the word +2 back to 0 (car.object-observed)
  const player = cleared ? { ...player0, objects: player0.objects.map(o => (o.consumed === HIT ? { ...o, consumed: 0 } : o)) } : player0;
  if (player.pending && !player.car.crashed) return { player: { ...player, car: wreck(player.car, world), pending: false, touched: 0 }, unproven: [], sounds: [] }; // the call after the contact: the wreck, nothing moves
  const out = stepCar(player.car, input, world, { racing, objects: player.objects, racers, ...env });
  let { car, objects } = { car: out.car, objects: player.objects }, pending = false, word = out.car.crashed ? player.word : 0;
  const unproven = [...out.unproven], sounds = [...out.sounds];
  if (out.hit) word = C.wall;
  if (out.touched?.code === C.racer) word = C.racer;
  if (out.touched?.code === C.object) {
    word = C.object;
    const object = objects[out.touched.index], kind = world.sprites[object.id].kind;
    const camera = { x: car.cx, y: car.cy, heading: car.heading }, shown = objectRecord(world, viewSetup(world, camera), camera, out.touched.index, object); // the object's draw record decides whether it is on the car's column (an obstacle) and the side of the bump (every contact that takes nothing)
    const centred = kind > 0 || !shown || isCentred(shown, playerRecord(world, car, null, undefined, null, false)); // an obstacle that is not drawn is taken as centred (the record is only missing at the screen's edge)
    const taken = touch(car, object, kind, { centered: centred, child: Boolean(env.child), top: shown?.top, noCrash: Boolean(env.duck || env.versus) });
    car = taken.car; pending = taken.wrecks;
    if (kind > 1 && taken.consumed !== HIT) sounds.push(DRIVER); // a counter or an item is taken: the driver's own voice (obj1+0x1328a)
    if (kind === 1 && taken.consumed !== HIT) sounds.push(SWIPE); // the tyre stack's pickup (obj1+0x132f7)
    if (taken.wrecks) sounds.push(BOOM); // the head-on hit: BOOM (obj1+0x133bf); the car is wrecked in the call after
    else if (taken.consumed === HIT) car = bumpCar(world, car, shown ? zonesOf(shown, playerRecord(world, car, null, undefined, null, false)).column : ZONE_CENTRE, CLANG); // a contact that takes nothing and does not wreck bumps the car, an obstacle or a pickup that was refused (a held item, a full counter, a busy tyre screen: obj1+0x1345b falls into obj1+0x1369f)
    objects = objects.map((o, i) => (i === out.touched.index ? { ...o, consumed: taken.consumed } : o));
    if (kind === 1 && !shown) unproven.push('the tyre stack\'s strips where the stack is not in the draw list (their start row is the entry\'s)');
    if (kind > K_COUNTER) unproven.push('the held item\'s use and its icon for the kinds 4 to 7 (only the kind 3 icon is observed)');
    if (kind <= 0 && !taken.wrecks) unproven.push('an obstacle touched below the throttle cap (the same bump as a refused pickup\'s, which the track 4 demo shows; an obstacle itself is not observed)');
  }
  if (car.events.length) { sounds.push(...car.events); car = { ...car, events: [] }; }
  const taken = objects.flatMap((o, i) => (o.consumed !== player.objects[i].consumed && o.consumed !== HIT && o.consumed !== 0 ? [i] : [])); // the objects this call took: the draw of the same frame still shows them (a grab of the running game)
  return { player: { ...player, car, objects, pending, word, taken, racerTouch: out.touched?.code === C.racer ? out.touched.index : -1, touched: objects.some((o, i) => o !== player.objects[i] && o.consumed === HIT) ? 1 : 0 }, unproven, sounds };
}
