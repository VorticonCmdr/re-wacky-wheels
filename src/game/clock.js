// The race's logic frame: one frame of the race routine every `period` counts of the 136 Hz counter (tick.rate), 12 by default.
import { K } from '../evidence/k.js';

const CLOCK = () => K({ counters: [{ hz: 136, rateAt: 156871, address: 124704, addressAt: 156881 }, { hz: 10, rateAt: 156891, address: 124700, addressAt: 156901 }, { hz: 1, rateAt: 156921, address: 125556, addressAt: 156926 }], library: { numerator: 1192030, divideAt: 200320 }, period: 12, periodWord: 126216, activeWord: 125532, defaultAt: 154868, copyAt: 27995, limiterAt: 135432, lastWord: 124708, frameWord: 126052, incAt: 135500, tolerance: 0.02 }, 'tick.rate');

// Milliseconds a race frame takes: period counts of the fast counter, which runs `hz` times a second.
export function frameMs(period) {
  const C = CLOCK(), p = period ?? C.period;
  return 1000 * p / C.counters[0].hz; // @math milliseconds in a second
}

// Milliseconds between two counts of the race timer's 10 Hz counter.
export function timerPeriodMs() { return 1000 / CLOCK().counters[1].hz; } // @math milliseconds in a second

// The race timer counts at the registered rate of its counter (tenths of a second): `ticks` counts to seconds.
export function timerSeconds(ticks) { return ticks / CLOCK().counters[1].hz; }
