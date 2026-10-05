// The touch of a computer racer on the human car (racer.contact-response): found in the AI's walk, answered by the contact routine.
import { K } from '../evidence/k.js';

export const CONTACT = () => K({ aiWalk: 0x18fa9, flagSite: 0x19005, humanPoint: [0xaaa6, 0xaaa8], range: 14, flag: 0x7c, response: 0x1d3fc, turn: 0x12, nudge: 1, rightZone: 5, push: { amount: 0x28, cap: 0xbe, nearer: 2, farther: 1 }, sound: 0x16 }, 'racer.contact-response');
