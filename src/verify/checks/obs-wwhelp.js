import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unpackLzexe } from '../../formats/lzexe.js';
import { crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ l: expected('wwhelp.image'), w: expected('wwhelp.packed'), rules: expected('lzexe.decode') });

// Cross-validate the `image` record: the file that was run is the installed WWHELP.EXE; decoding it must give the image length the claim names, end
// where the stream is said to end, and match the running program's memory page by page except in the pages the claim counts.
function validate(exe, record, V) {
  const L = V.l;
  assert.equal(record.file.size, exe.length, 'the program that was run is as long as the installed one');
  assert.equal(record.file.sha1, createHash('sha1').update(exe).digest('hex'), 'and the same bytes');
  assert.equal(record.imageAt, L.imageAt, 'the image starts after the PSP');
  assert.equal(record.pageBytes, L.pageBytes, 'the page size');
  assert.equal(record.bytes, L.imageBytes, 'the length of the image the tool read');
  assert.equal(new DataView(exe.buffer, exe.byteOffset, exe.length).getUint16(V.rules.headerParasAt, true) * V.rules.paragraph, L.packedStart, 'the stream starts at the end of the header'); // @math the header size in paragraphs
  const { image, packedEnd } = unpackLzexe(exe);
  assert.equal(image.length, L.imageBytes, 'the decoded length');
  assert.equal(packedEnd, L.packedEnd, 'the stream ends where the claim says');
  assert.equal(V.w.signature, 'LZ91'); // @math the packer's signature of wwhelp.packed, which this claim relies on
  assert.equal(record.pageCrcs.length, L.pages, 'the number of pages');
  let equal = 0, differing = 0;
  record.pageCrcs.forEach((live, p) => {
    const page = image.subarray(p * L.pageBytes, (p + 1) * L.pageBytes);
    if (crc(page) === live) equal++; else differing++;
  });
  assert.equal(equal, L.equalPages, 'the pages equal to the running program');
  assert.equal(equal + differing, L.pages);
  return image;
}

export default {
  id: 'obs-wwhelp',
  claims: ['lzexe.decode', 'wwhelp.image'],
  obs: ['wwhelp-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WWHELP.EXE'), ctx.obs('wwhelp-1'), values()); },
  async discriminate(ctx) {
    const exe = await ctx.open('WWHELP.EXE'), V = values(), r = ctx.obs('wwhelp-1'), l = patch => ({ ...V, l: { ...V.l, ...patch } });
    return [
      { label: 'a page of the live image changed', fn: () => validate(exe, { ...r, pageCrcs: r.pageCrcs.map((c, i) => (i === 0 ? '00000000' : c)) }, V) },
      { label: 'one more page equal', fn: () => validate(exe, r, l({ equalPages: V.l.equalPages + 1 })) },
      { label: 'another image length', fn: () => validate(exe, r, l({ imageBytes: V.l.imageBytes + 1 })) },
      { label: 'the stream ending elsewhere', fn: () => validate(exe, r, l({ packedEnd: V.l.packedEnd + 1 })) },
      { label: 'a program of another size', fn: () => validate(exe.subarray(1), r, V) },
    ];
  },
};
