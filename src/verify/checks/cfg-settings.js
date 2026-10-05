import assert from 'node:assert/strict';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('menu.default-settings'), cfg: expected('cfg.read'), menu: expected('menu.tree-observed') });

// The file offset of the game word at obj2+`address`: the piece of WACKY.CFG (cfg.read) that the game reads over it.
function fileOffset(cfg, address) {
  let at = 0;
  for (const part of cfg.parts) {
    if (address >= part.offset && address < part.offset + part.bytes) return at + address - part.offset;
    at += part.bytes;
  }
  throw new Error(`obj2+0x${address.toString(0x10)} is in no piece of the configuration`); // @math hex
}

// The words the menus show (menu.tree-observed) as they stand in a configuration file: the three race screen switches, then the single and the split screen detail level.
function validate(file, V, name) {
  assert.equal(file.length, V.cfg.size, `${name}: the file size of cfg.read`);
  const dv = view(file), T = V.menu.menus, words = [...T.toggles.words, T.single.word, T.split.word];
  assert.equal(words.length, V.d.words, 'three switches and two levels');
  words.forEach((address, k) => {
    const at = fileOffset(V.cfg, address), expect = k < T.toggles.words.length ? V.d.switch : V.d.level;
    assert.equal(at, V.d.fileOffsets[k], `${name}: the file offset of obj2+0x${address.toString(0x10)}`); // @math hex
    assert.equal(dv.getUint16(at, true), expect, `${name}: the word at ${at.toString(0x10)}`); // @math hex
  });
}

export default {
  id: 'cfg-settings',
  claims: ['menu.default-settings'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) {
    const V = values(), paths = ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p));
    assert.equal(paths.length, V.d.files, 'the installed WACKY.CFG files');
    for (const path of paths) validate(await ctx.openPath(path), V, path);
  },
  async discriminate(ctx) {
    const V = values(), path = ctx.list().find(p => /(^|\/)wacky\.cfg$/i.test(p)), file = await ctx.openPath(path), k = patch => () => validate(file, { ...V, d: { ...V.d, ...patch } }, path);
    return [
      { label: 'switches off', fn: k({ switch: 0 }) },
      { label: 'low detail', fn: k({ level: V.d.level + 2 }) }, // @math the third level, LOW
      { label: 'offsets shifted', fn: k({ fileOffsets: V.d.fileOffsets.map(o => o + 2) }) }, // @math one word on
      { label: 'wrong file size', fn: () => validate(file.subarray(1), V, path) },
    ];
  },
};
