// K(value, claimId): the only way a constant enters src/{formats,render,audio,game,verify/checks}.
// It throws unless the registry records exactly this value for the claim, so a constant cannot
// drift from its evidence. npm run mutate sets globalThis.__DR_MUTATE__ = {id, path, variant}
// (node only; nothing reads process.env here, so the module is bundle-safe) to prove that the
// claim's checks actually assert the value.
import { claim, weakest } from './registry.js';

const collectors = [];

export function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}

// Every leaf of a value, as a path of keys. The mutate runner perturbs each leaf in turn.
export function leaves(value, path = []) {
  if (value && typeof value === 'object') return Object.keys(value).flatMap(k => leaves(value[k], [...path, k]));
  return [path];
}

export function perturb(value, variant) {
  if (typeof value === 'number') return variant === 'inc' ? value + 1 : value - 1;
  if (typeof value === 'string') return value ? value.slice(0, -1) + String.fromCharCode(value.charCodeAt(value.length - 1) ^ 1) : '?';
  if (typeof value === 'boolean') return !value;
  throw new Error(`Cannot perturb ${typeof value}`);
}

function mutated(value, m) {
  if (!m.path.length) return perturb(value, m.variant);
  const copy = Array.isArray(value) ? [...value] : { ...value };
  const [key, ...rest] = m.path;
  copy[key] = mutated(value[key], { ...m, path: rest });
  return copy;
}

export function K(value, id) {
  const c = claim(id);
  if (!('value' in c)) throw new Error(`Claim ${id} records no value; it cannot back a constant`);
  if (!same(c.value, value)) throw new Error(`K(${JSON.stringify(value)}, ${id}) differs from the registry value ${JSON.stringify(c.value)}`);
  for (const steps of collectors) steps.add(id);
  const m = globalThis.__DR_MUTATE__;
  return m && m.id === id ? mutated(value, m) : value;
}

// Records the claims used while fn runs (UNKNOWN() records too), so a viewer can badge a decode
// with its weakest step. Synchronous only: async work must collect inside each sync section.
export function withSteps(fn) {
  const steps = new Set();
  collectors.push(steps);
  try {
    const result = fn();
    return { result, steps: [...steps], tag: weakest([...steps].map(id => claim(id).tag)) };
  } finally { collectors.splice(collectors.lastIndexOf(steps), 1); }
}

export function noteStep(id) {
  claim(id);
  for (const steps of collectors) steps.add(id);
}
