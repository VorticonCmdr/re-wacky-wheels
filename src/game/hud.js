// The race HUD's state and rules, as far as they are proven: the speedometer's number eases toward twice the car's speed word (hud.place-speed-observed,
// hud.speed-rules), the timer counts tenths of a second on its own 10 Hz counter (tick.rate) and is shown as MM:SS:T (hud.timer-observed), and the
// Race Screen Options switches gate the two (hud.speed-rules, menu.tree-observed).
import { K } from '../evidence/k.js';
import { timerPeriodMs } from './clock.js';
import { switchOf } from './menus.js';

const RULES = () => K({ routine: 0x1a92c, shownWord: 0x8438, targetWord: 0x8436, targetFactor: 2, cap: 0x63, modeWord: 0x28c44, racingMode: 2, padChar: 0x30, radix: 10, steps: { racing: { rise: 2, fall: 4 }, other: { rise: 4, fall: 10 } }, speedSwitchWord: 0x175d4, clockSwitchWord: 0x175d2, timeTrialWord: 0x28bb2, timeTrialMode: 4, tickWord: 0x1e71c }, 'hud.speed-rules');
const TIMER = () => K({ samples: 5, x: 264, y: 112, advance: 7, glyphSize: [7, 9], glyphBytes: 63, glyphsAt: 13733, glyphs: 11, colon: 10, places: 7, tickWord: 0x1e71c, tenths: 10, secondsPerMinute: 60, cap: 36000, exact: 3, behind: 2 }, 'hud.timer-observed');

// The HUD state: `word` is the speed word that eases (obj2+0x8438), `shown` the number the last call drew, `ticks` the 10 Hz race counter, `rest` the
// milliseconds since its last tick and `timerShown` the counter as the last call read it.
export const createHud = () => ({ word: 0, shown: 0, ticks: 0, rest: 0, timerShown: 0 });

// One call of the speedometer code for a word and the car's speed word: the number it draws (the word as it stands, limited to the cap, 0 outside the
// racing mode) and the word after the easing (hud.speed-rules).
export function stepSpeed(word, speed, racing = true) {
  const R = RULES(), steps = racing ? R.steps.racing : R.steps.other, target = speed * R.targetFactor;
  let next = word;
  if (word < target) next = Math.min(word + steps.rise, target);
  else if (word > target) next = Math.max(word - steps.fall, target);
  return { shown: racing ? Math.min(word, R.cap) : 0, word: next };
}

// One race frame of the HUD: the speedometer's call, and the timer's counter read as it stands (0 outside the racing mode). Returns the next state and
// the list of unproven things this frame relied on (hud.speed-rules: read from the code, not observed).
export function stepHud(hud, car, racing = true) {
  const R = RULES(), { shown, word } = stepSpeed(hud.word, car.speed, racing), unproven = [];
  if (racing && hud.word > R.cap) unproven.push('the speedometer limit of 99');
  if (racing && shown < R.radix) unproven.push('the speedometer under 10 (the tens digit a zero)');
  return { hud: { ...hud, word, shown, timerShown: racing ? hud.ticks : 0 }, unproven };
}

// The 10 Hz race counter advances with the wall clock, whatever the frame rate.
export function advanceTimer(hud, ms) {
  const period = timerPeriodMs();
  let rest = hud.rest + ms, ticks = hud.ticks;
  while (rest >= period) { rest -= period; ticks++; }
  return { ...hud, rest, ticks };
}

// The two digits of the speedometer: the decimal text of the number, one character long padded in front with the zero character.
export function speedDigits(number) {
  const R = RULES(), text = number.toString(R.radix).padStart(2, String.fromCharCode(R.padChar)); // @math two places
  return [...text].map(Number);
}

// The timer text MM:SS:T of a tick count (a count above the cap shows 0).
export function timerText(ticks) {
  const T = TIMER(), n = ticks > T.cap ? 0 : ticks, t = Math.floor(n / T.tenths), two = v => String(v).padStart(2, '0'); // @math two places
  return `${two(Math.floor(t / T.secondsPerMinute))}:${two(t % T.secondsPerMinute)}:${n % T.tenths}`;
}

// What the Race Screen Options switches let the HUD draw: the speedometer by the SPEEDOMETER word, the timer by the CLOCK DISPLAY word.
export function hudGates(settings) {
  const R = RULES();
  return { speedometer: settings.switches[switchOf(R.speedSwitchWord)] === 1, timer: settings.switches[switchOf(R.clockSwitchWord)] === 1 };
}
