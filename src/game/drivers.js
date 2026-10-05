// The eight drivers and the random order the computer racers get them in (racer.driver-slots, STATIC).
import { K } from '../evidence/k.js';

const DRIVERS = () => K({ routine: 0xbe3c, generator: 0x33088, seeder: 0x330ac, tableAt: 0x10720, humanWord: 0x28b96, timerWord: 0x1e71c, drivers: 8, seedMin: 8, multiplier: 0x41c64e6d, increment: 0x3039, shift: 16, mask: 0x7fff, names: ['UNO', 'SULTAN', 'MORRIS', 'PEGGLES', 'RAZER', 'RINGO', 'BLOMBO', 'TIGI'], files: ['PANDA.SP', 'CAMEL.SP', 'MOOSE.SP', 'PELICAN.SP', 'SHARK.SP', 'RINGO.SP', 'ELE.SP', 'TIGER.SP'] }, 'racer.driver-slots');

export const driverName = slot => DRIVERS().names[slot];
export const driverFile = slot => DRIVERS().files[slot];
export const driverCount = () => DRIVERS().drivers;

// The library's generator: x = x * 0x41c64e6d + 0x3039 (32 bits), the number is x >> 16 masked with 0x7fff.
function generator(seed) {
  const D = DRIVERS();
  let x = Math.max(seed, D.seedMin) | 0; // @math the seed is a 32-bit word
  return () => { x = (Math.imul(x, D.multiplier) + D.increment) | 0; return (x >>> D.shift) & D.mask; }; // @math 32-bit arithmetic
}

// The driver of every racer (obj2+0x10720): word 0 the human's, then random drivers that are not yet in the table.
export function driverSlots(seed, human) {
  const D = DRIVERS(), next = generator(seed), table = Array.from({ length: D.drivers }, () => -1);
  table[0] = human;
  for (let n = 1; n < D.drivers; n++) {
    for (;;) {
      const r = next();
      if (r > D.drivers - 1) continue;
      const slot = (r + 1) % D.drivers; // @math one more, wrapping from the last to 0 (obj1+0xbeca)
      if (!table.includes(slot)) { table[n] = slot; break; }
    }
  }
  return table;
}
