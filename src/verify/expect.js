// Checks read a claim's recorded value through K() so that npm run mutate can perturb it.
// Only src/verify/checks/ uses this; product code writes the literal inside K(...).
import { K } from '../evidence/k.js';
import { claim } from '../evidence/registry.js';

export const expected = id => K(claim(id).value, id);
