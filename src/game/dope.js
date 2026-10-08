// The DOPE easter egg (dope.scene, STATIC): holding the left key and the brake through 54 calls of the countdown of a one-screen race brings up a face from below the picture and a speech bubble
// with a belch, then the face sinks again. The trigger is the counter of the control routine (obj1+0x19415 to +0x19541), the scene is obj1+0x3858 with the animation words of the loader obj1+0x3780.
import { K } from '../evidence/k.js';

const SCENE = () => K({ member: 'DOPE.SP', belch: 'BELCH.VOC', memberBytes: 0x2e77, loader: 0x3780, draw: 0x3858, controlSite: 0x19415, frames: 0x36, face: { size: [80, 72], frameBytes: 0x1680, frames: 2, x: 0x78, startY: 0xc7, bottom: 0xc7, riseTo: 0x70, rise: 8, sink: 4 }, bubble: { size: [25, 15], at: 0x2d00, x: 0xb0, wobble: 1, below: 0x25, fall: 2, endY: 0x6e, bottom: 0xc7 }, holds: [0x10, 0x14], states: 4, figureBlockBytes: 0x1a20 }, 'dope.scene');

// The scene's pictures and timeline (dope.scene), for the renderer.
export const dopeScene = () => SCENE();
export const dopeMember = () => SCENE().member;
export const belchMember = () => SCENE().belch;
export const dopeBytes = () => SCENE().memberBytes;

// The words of the scene before any trigger: the counter 0x1ed24 and the scene word 0x1ed40.
export const createDope = () => ({ count: 0, on: false, state: 0, frame: 0, y: 0, stamp: 0, bubble: 0, bubbleY: 0 });

// The counter and the trigger of one call of the control routine. `c` is { left (the steer-left flag after the inverted swap), still (the car's step word is 0), starter (the starter word 0x28c38),
// accelerate (the throttle flag 0x28b40), brake (the brake flag 0x28b44), alone (a one-screen race) }. Returns the words after the call and whether the loader ran.
export function triggerDope(dope, c, tick) {
  const S = SCENE();
  let count = c.left && c.still && c.starter ? dope.count + 1 : 0;
  if (c.accelerate) count = 0;
  if (c.alone) {
    if (!c.brake || !c.starter) count = 0;
    else if (!dope.on && count >= S.frames) return { dope: { ...startDope(tick), count: 0 }, started: true };
  }
  return { dope: { ...dope, count }, started: false };
}

// The loader's animation words (obj1+0x37dd to +0x3841): the face below the picture, state 0, frame 0, no bubble.
function startDope(tick) {
  const S = SCENE();
  return { count: 0, on: true, state: 0, frame: 0, y: S.face.startY, stamp: tick, bubble: 0, bubbleY: 0 };
}

// One call of the scene routine (obj1+0x3858) with the race counter `tick`: what it draws, then the step of its state. `draw` is { face: { frame, x, y }, bubble: { x, y } | null } (the pictures are
// drawn only while their y is not below the picture's last row), `belch` is true on the call that plays BELCH.VOC; the scene is null once it has ended.
export function stepDope(dope, tick) {
  const S = SCENE(), F = S.face, B = S.bubble;
  const draw = { face: dope.y <= F.bottom ? { frame: dope.frame, x: F.x, y: dope.y } : null, bubble: null };
  let { state, frame, y, stamp, bubble, bubbleY } = dope, belch = false, on = true;
  if (bubble !== 0) {
    if (bubbleY <= B.bottom) draw.bubble = { x: bubble === 1 ? B.x + B.wobble : B.x - B.wobble, y: bubbleY };
    bubble = bubble === 1 ? 2 : 1; // @math the word alternates between 1 and 2, the x between plus and minus one
    if (bubbleY === B.endY) bubble = 0;
    else bubbleY = Math.max(bubbleY - B.fall, B.endY);
  }
  if (state === 0) { y -= F.rise; if (y <= F.riseTo) { y = F.riseTo; state = 1; stamp = tick; } }
  else if (state === 1) { if (tick - stamp >= S.holds[0]) { stamp = tick; state = 2; frame = 1; bubble = 1; bubbleY = y + B.below; belch = true; } } // @math the states count 0 to 3 in the order the face rises, waits, talks and sinks
  else if (state === 2) { if (tick - stamp >= S.holds[1]) { state = 3; frame = 0; } } // @math the next state after the talk
  else if (state === 3) { y += F.sink; if (y > F.bottom) on = false; } // @math the last state
  return { dope: on ? { ...dope, state, frame, y, stamp, bubble, bubbleY } : { ...dope, on: false, state, frame, y, stamp, bubble, bubbleY }, draw, belch };
}

// The members' bytes that the reaction figure reads after the loader ran: DOPE.SP over the start of the GIGGLES.SP buffer (obj1+0x378c), the rest unchanged.
export function overlayDope(giggles, dope) {
  const out = Uint8Array.from(giggles);
  out.set(dope.subarray(0, Math.min(dope.length, out.length)), 0);
  return out;
}
