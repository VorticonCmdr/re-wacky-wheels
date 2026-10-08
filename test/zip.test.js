// The artwork packs' zip archives (src/zip.js) and a pack's files (src/enhance/pack-format.js packFiles): a written zip read back, a deflated
// entry and an entry written as a stream (bit 3, its sizes only in the central directory), the reader's refusals and its cap on a file's size;
// the pack.json found at any depth, the macOS Finder's leftovers skipped, the pictures found by their paths in the manifest (loose files by
// their names) and never outside the pack's folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readZip, writeZip } from '../src/zip.js';
import { packFiles } from '../src/enhance/pack-format.js';
import { crc32 } from '../src/evidence/crc32.js';

const enc = s => new TextEncoder().encode(s);
async function deflateRaw(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }

// A zip of one deflated file written by hand, as the systems' zip tools write it; `stream` writes it as a stream (bit 3: the local header's
// sizes and CRC zero, a data descriptor after the data, the sizes in the central directory).
async function handZip(name, data, { stream = false } = {}) {
  const n = enc(name), packed = await deflateRaw(data), crc = crc32(data);
  const local = new Uint8Array(30 + n.length), lv = new DataView(local.buffer); // @math a local header's fixed part
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, stream ? 8 : 0, true); lv.setUint16(8, 8, true); // @math the signature, version 2.0, the stream flag (bit 3), deflated
  if (!stream) { lv.setUint32(14, crc, true); lv.setUint32(18, packed.length, true); lv.setUint32(22, data.length, true); } // @math the CRC and the sizes
  lv.setUint16(26, n.length, true); local.set(n, 30); // @math the name's length and the name
  const descriptor = stream ? new Uint8Array(16) : new Uint8Array(0); // @math a data descriptor with its signature
  if (stream) { const dv = new DataView(descriptor.buffer); dv.setUint32(0, 0x08074b50, true); dv.setUint32(4, crc, true); dv.setUint32(8, packed.length, true); dv.setUint32(12, data.length, true); } // @math the descriptor's words
  const central = new Uint8Array(46 + n.length), cv = new DataView(central.buffer); // @math a central header's fixed part
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, stream ? 8 : 0, true); cv.setUint16(10, 8, true); // @math the signature, versions, flags, deflated
  cv.setUint32(16, crc, true); cv.setUint32(20, packed.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, n.length, true); cv.setUint32(42, 0, true); central.set(n, 46); // @math the CRC, the sizes, the name's length, the local header at 0
  const at = local.length + packed.length + descriptor.length, end = new Uint8Array(22), ev = new DataView(end.buffer); // @math the end record
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true); ev.setUint32(12, central.length, true); ev.setUint32(16, at, true); // @math one entry; the directory's size and place
  const out = new Uint8Array(at + central.length + end.length);
  out.set(local, 0); out.set(packed, local.length); out.set(descriptor, local.length + packed.length); out.set(central, at); out.set(end, at + central.length);
  return out;
}

test('a written zip reads back: names, bytes and order, folders and an empty file', async () => {
  const files = [{ name: 'pack.json', data: enc('{"a":1}') }, { name: 'tiles/A_F1.png', data: Uint8Array.from({ length: 3000 }, (_, i) => (i * 7) & 0xff) }, { name: 'empty.txt', data: new Uint8Array(0) }, { name: 'ünïcode/naïve.txt', data: enc('é') }]; // @math a byte pattern
  const zip = writeZip(files, { date: new Date(2026, 9, 7, 12, 30, 10) }); // @math a fixed date
  const back = await readZip(zip);
  assert.deepEqual(back.map(f => f.name), files.map(f => f.name));
  back.forEach((f, i) => assert.deepEqual(f.data, files[i].data));
});

test('a deflated entry, and one written as a stream with its sizes only in the central directory', async () => {
  const data = enc('a deflated picture '.repeat(200)); // @math enough to compress
  for (const stream of [false, true]) {
    const back = await readZip(await handZip('dir/pic.png', data, { stream }));
    assert.equal(back.length, 1); assert.equal(back[0].name, 'dir/pic.png'); assert.deepEqual(back[0].data, data);
  }
});

test('the reader refuses what it cannot read, with the reason', async () => {
  await assert.rejects(readZip(enc('not a zip at all, just some text that is long enough to scan')), /not a zip/);
  const zip = writeZip([{ name: 'a.txt', data: enc('hello') }]);
  const damaged = zip.slice(); damaged[30 + 'a.txt'.length] ^= 0xff; // @math the first data byte after the local header
  await assert.rejects(readZip(damaged), /damaged/);
  const locked = zip.slice(); new DataView(locked.buffer).setUint16(locked.length - 22 - 46 - 'a.txt'.length + 8, 1, true); // @math the central header's flags: encrypted
  await assert.rejects(readZip(locked), /encrypted/);
  const other = zip.slice(); new DataView(other.buffer).setUint16(other.length - 22 - 46 - 'a.txt'.length + 10, 12, true); // @math method 12 (bzip2)
  await assert.rejects(readZip(other), /method 12/);
});

test('the reader\'s cap: a file larger than maxBytes refused before it is read, a deflated file inflated no further than its directory\'s size', async () => {
  const data = new Uint8Array(200000), bomb = await handZip('tiles/A_F1.png', data); // @math 200 000 zero bytes deflate to a few hundred
  assert.equal((await readZip(bomb, { maxBytes: data.length }))[0].data.length, data.length, 'at the cap');
  await assert.rejects(readZip(bomb, { maxBytes: data.length - 1 }), /at most 199999 bytes/); // @math one byte under it
  const understated = bomb.slice(), cv = new DataView(understated.buffer), central = understated.length - 22 - 46 - 'tiles/A_F1.png'.length; // @math the end record, the central header's fixed part
  cv.setUint32(central + 24, 1000, true); // @math the directory says 1000 bytes
  await assert.rejects(readZip(understated), /inflates to more than the 1000 bytes/);
});

test('a pack\'s files: pack.json at any depth (the shallowest), the Finder\'s leftovers skipped, pictures by their paths, none outside the pack', () => {
  const json = enc(JSON.stringify({ format: 'wackywheels-artpack' }));
  const files = [{ name: '__MACOSX/My pack/._pack.json', data: enc('junk') }, { name: 'My pack/.DS_Store', data: enc('junk') }, { name: 'My pack/pack.json', data: json }, { name: 'My pack/extra/pack.json', data: enc('{}') }, { name: 'My pack/tiles/A_F1.png', data: enc('png') }, { name: 'secret.txt', data: enc('outside') }];
  const pack = packFiles(files);
  assert.equal(pack.reason, null); assert.equal(pack.json.format, 'wackywheels-artpack');
  assert.deepEqual(pack.file('tiles/A_F1.png'), enc('png'));
  assert.deepEqual(pack.file('./tiles/a_f1.PNG'), enc('png'), 'a path in another case is found');
  assert.equal(pack.file('../secret.txt'), null, 'never outside the pack\'s folder');
  assert.equal(pack.file('tiles/none.png'), null);
  assert.equal(packFiles([{ name: 'a.png', data: enc('x') }]).json, null);
  assert.match(packFiles([{ name: 'pack.json', data: enc('{oops') }]).reason, /not JSON/);
  assert.deepEqual(packFiles([{ name: 'pack.json', data: json }, { name: 'p.png', data: enc('y') }]).file('p.png'), enc('y'), 'a pack of loose files');
  // Files picked one by one have no folders: a picture the manifest puts in a folder is found by its name, unless two files share it.
  const loose = packFiles([{ name: 'pack.json', data: json }, { name: 'A_F1.png', data: enc('t') }, { name: 'BACK1.png', data: enc('s') }]);
  assert.deepEqual(loose.file('tiles/A_F1.png'), enc('t')); assert.deepEqual(loose.file('sky/back1.PNG'), enc('s')); assert.equal(loose.file('tiles/A_F2.png'), null);
  assert.equal(packFiles([{ name: 'pack.json', data: json }, { name: 'a.png', data: enc('1') }, { name: 'A.PNG', data: enc('2') }]).file('tiles/a.png'), null, 'two files of one name: neither');
  assert.equal(pack.file('extra/A_F1.png'), null, 'files in folders are found by their paths only');
});
