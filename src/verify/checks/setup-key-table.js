import assert from 'node:assert/strict';
import { setupNames } from '../setup-keys.js';
import { expected } from '../expect.js';

const values = () => ({ table: expected('setup.key-table'), decode: expected('cfg.key-names') });

// The table of the claim against the records SETUP.EXE's builder holds: the same scancodes and, for each, the first name the builder gives it.
function validate(setup, V) {
  const names = setupNames(setup, V.decode);
  assert.equal(names.size, V.table.keys.length, 'one record group for each scancode of the table');
  for (const [scancode, name] of V.table.keys) {
    assert.ok(names.has(scancode), `SETUP.EXE has a record for the scancode ${scancode}`);
    assert.equal(names.get(scancode)[0], name, `the name of the scancode ${scancode}`);
  }
}

export default {
  id: 'setup-key-table',
  claims: ['setup.key-table'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { validate(await ctx.open('SETUP.EXE'), values()); },
  async discriminate(ctx) {
    const setup = await ctx.open('SETUP.EXE'), V = values(), k = keys => () => validate(setup, { ...V, table: { keys } });
    return [
      { label: 'a name changed', fn: k(V.table.keys.map(([c, n], i) => (i === 0 ? [c, `${n}X`] : [c, n]))) },
      { label: 'a scancode shifted', fn: k(V.table.keys.map(([c, n], i) => (i === 0 ? [c + 1, n] : [c, n]))) },
      { label: 'a key missing', fn: k(V.table.keys.slice(1)) },
      { label: 'two names swapped', fn: k(V.table.keys.map(([c, n], i) => (i === 0 ? [c, V.table.keys[1][1]] : i === 1 ? [c, V.table.keys[0][1]] : [c, n]))) },
    ];
  },
};
