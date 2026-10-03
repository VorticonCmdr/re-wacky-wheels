// UNKNOWN('UNKNOWN_X') stands in for a value nobody has established. It renders as a label, and
// any numeric use throws, so it cannot silently become a plausible number. Renderers draw a
// hatched, labelled tile for it; audio plays silence.
import { claim } from './registry.js';
import { noteStep } from './k.js';

const MARK = Symbol('unknown');

export function UNKNOWN(id) {
  if (claim(id).tag !== 'UNKNOWN') throw new Error(`${id} is tagged ${claim(id).tag}; use K()`);
  noteStep(id);
  const fail = () => { throw new Error(`${id} is not established (see docs/TODO.md)`); };
  return Object.freeze({
    [MARK]: true,
    id,
    valueOf: fail,
    toJSON: () => id,
    toString: () => id,
    [Symbol.toPrimitive]: hint => hint === 'string' ? id : fail(),
  });
}

export function isUnknown(value) { return Boolean(value && value[MARK]); }
