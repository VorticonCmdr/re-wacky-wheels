import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVfs } from '../src/vfs/core.js';
import { openGameFolder } from '../src/vfs/node.js';
import { openDevGame } from '../src/vfs/dev.js';
import { openPicked } from '../src/vfs/picker.js';

const file = (path, bytes, size = bytes.length) => ({ path, size, read: async () => Uint8Array.from(bytes).buffer });

test('core matches by case-insensitive basename, caches reads, and refuses ambiguity', async () => {
  let reads = 0;
  const vfs = createVfs([{ path: 'a/Wacky.DAT', size: 2, read: async () => { reads++; return new Uint8Array([1, 2]); } }, file('b/other.bin', [3])]);
  assert.deepEqual(vfs.list(), ['a/Wacky.DAT', 'b/other.bin']);
  assert.ok(vfs.has('wacky.dat'));
  assert.ok(!vfs.has('missing.bin'));
  assert.deepEqual([...await vfs.open('WACKY.dat')], [1, 2]);
  await vfs.open('wacky.dat');
  assert.equal(reads, 1);
  await assert.rejects(vfs.open('missing.bin'), /not found/);
  const dup = createVfs([file('x/ww.exe', [1]), file('y/WW.EXE', [2])]);
  assert.throws(() => dup.has('ww.exe'), /ambiguous.*x\/ww\.exe.*y\/WW\.EXE/);
  await assert.rejects(createVfs([file('big.bin', [1], 10)], { maxBytes: 5 }).open('big.bin'), /limit/);
  assert.deepEqual([...await createVfs([file('win\\style.bin', [7])]).open('STYLE.BIN')], [7]);
  // openPath reaches one of several files with the same name, which open() refuses.
  const twin = createVfs([file('SB16/WACKY.CFG', [1]), file('SC55/WACKY.CFG', [2])]);
  assert.throws(() => twin.has('wacky.cfg'), /ambiguous/);
  assert.deepEqual([...await twin.openPath('sc55\\wacky.cfg')], [2]);
  await assert.rejects(twin.openPath('nope/WACKY.CFG'), /not found/);
});

test('node adapter reads nested files, skips dotfiles and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ww-vfs-'));
  try {
    await mkdir(join(root, 'inst', 'WACKY'), { recursive: true });
    await writeFile(join(root, 'inst', 'WACKY', 'WW.EXE'), new Uint8Array([9, 8]));
    await writeFile(join(root, '.hidden'), 'x');
    await symlink(join(root, 'inst'), join(root, 'link'));
    const vfs = await openGameFolder(root);
    assert.deepEqual(vfs.list(), ['inst/WACKY/WW.EXE']);
    assert.deepEqual([...await vfs.open('ww.exe')], [9, 8]);
    assert.ok(!vfs.has('.hidden'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('dev adapter fetches the manifest once and files lazily', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (url.endsWith('__game/manifest')) return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ['WackyWhe/WACKY/WW.EXE'] };
    return { ok: true, arrayBuffer: async () => new Uint8Array([5, 6]).buffer };
  };
  const vfs = await openDevGame({ base: '/app/', fetchImpl });
  assert.deepEqual(calls, ['/app/__game/manifest']);
  assert.deepEqual([...await vfs.open('WW.EXE')], [5, 6]);
  assert.equal(calls[1], '/app/__game/file?path=WackyWhe%2FWACKY%2FWW.EXE');
  const html = async () => ({ ok: true, headers: new Headers({ 'content-type': 'text/html' }) });
  await assert.rejects(openDevGame({ fetchImpl: html }), /npm run dev/);
  const failing = async url => url.includes('manifest') ? { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ['a.bin'] } : { ok: false };
  await assert.rejects((await openDevGame({ fetchImpl: failing })).open('a.bin'), /Could not load a\.bin/);
});

test('picker adapter uses relative paths, ignores dotfiles, and enforces the size limit', async () => {
  const f = (name, rel, bytes) => ({ name, webkitRelativePath: rel, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
  const vfs = openPicked([f('WACKY.DAT', 'WACKY/WACKY.DAT', [1]), f('.DS_Store', 'WACKY/.DS_Store', [0]), f('loose.cfg', '', [2])]);
  assert.deepEqual(vfs.list(), ['WACKY/WACKY.DAT', 'loose.cfg']);
  assert.deepEqual([...await vfs.open('wacky.dat')], [1]);
  const big = openPicked([{ name: 'huge.bin', size: 100, arrayBuffer: async () => new ArrayBuffer(0) }], { maxBytes: 10 });
  await assert.rejects(big.open('huge.bin'), /limit/);
});
