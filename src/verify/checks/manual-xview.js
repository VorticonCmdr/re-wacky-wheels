import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { expected } from '../expect.js';

const values = () => ({ x: expected('manual.xview'), layout: expected('manual.exe.layout') });

const latin1 = bytes => String.fromCharCode(...bytes);
const cString = (data, at) => latin1(data.subarray(at, data.indexOf(0, at)));

// MANUAL.EXE is a script viewer: its data holds the script words it knows and its messages, and the shipped COMMANDS.TXT script
// uses only those words and names page files that exist next to it.
function validate(manual, script, files, V) {
  const X = V.x, { le, overlay } = locateLe(manual), data = le.objects[X.dataObject - 1].data; // @math object numbers count from 1
  assert.equal(overlay, V.layout.overlay, 'the overlay of manual.exe.layout');
  for (const { at, text, keyword } of X.strings) {
    assert.equal(latin1(data.subarray(at, at + text.length)), text, `the string at 0x${at.toString(16)}`); // @math hexadecimal radix
    if (keyword) assert.equal(data[at + text.length], 0, `the keyword ${text} ends with a NUL`);
  }
  const symbols = manual.subarray(manual.length - overlay);
  assert.equal(cString(symbols, X.sourcePathAt), X.sourcePath, 'the overlay names the source file of the program');
  const words = new Set(X.strings.filter(s => s.keyword).map(s => s.text.toLowerCase())), lines = latin1(script).split(/\r?\n/).filter(l => l.trim() && !l.startsWith(X.comment));
  assert.equal(lines.length, X.commandLines, 'the command lines of the script');
  const named = new Set(files.map(p => p.split('/').pop().toLowerCase())), pages = [];
  for (const line of lines) {
    const [verb, file, ...rest] = line.trim().split(/\s+/);
    assert.ok(words.has(verb.toLowerCase()), `command ${verb}`);
    for (const w of rest) assert.ok(words.has(w.toLowerCase()), `word ${w}`);
    assert.ok(named.has(file.toLowerCase()), `page ${file}`);
    pages.push(file.toLowerCase());
  }
  assert.deepEqual([...words].sort(), X.keywords.map(w => w.toLowerCase()).sort(), 'the keywords of the table');
  assert.equal(new Set(pages).size, X.pages, 'the distinct page files');
}

export default {
  id: 'manual-xview',
  claims: ['manual.xview'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('MANUAL.EXE'), await ctx.open('COMMANDS.TXT'), ctx.list(), values()); },
  async discriminate(ctx) {
    const manual = await ctx.open('MANUAL.EXE'), script = await ctx.open('COMMANDS.TXT'), files = ctx.list(), V = values(), x = patch => () => validate(manual, script, files, { ...V, x: { ...V.x, ...patch } });
    return [
      { label: 'first string one byte on', fn: x({ strings: V.x.strings.map((s, i) => (i ? s : { ...s, at: s.at + 1 })) }) },
      { label: 'a keyword missing', fn: x({ strings: V.x.strings.filter(s => s.text !== 'nomove') }) },
      { label: 'the data in the other object', fn: x({ dataObject: V.x.dataObject - 1 }) },
      { label: 'source path elsewhere in the overlay', fn: x({ sourcePathAt: V.x.sourcePathAt + 1 }) },
      { label: 'one command line more', fn: x({ commandLines: V.x.commandLines + 1 }) },
      { label: 'one page more', fn: x({ pages: V.x.pages + 1 }) },
      { label: 'a script without its pages', fn: () => validate(manual, script, files.filter(p => !/page1/i.test(p)), V) },
    ];
  },
};
