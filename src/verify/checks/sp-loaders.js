import assert from 'node:assert/strict';
import { locateLe, parseFixups, objectFixups } from '../../formats/le.js';
import { parseDatDirectory } from '../../formats/dat.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ s: expected('sp.loader-sizes'), offset32: expected('le.fixup-record').source.offset32 });

// Every code site that loads a .SP member name into eax (`mov eax, name`) and, a few bytes later, a size into edx (`mov edx, size`).
function loaders(exe, V) {
  const S = V.s, { le } = locateLe(exe), code = le.objects[S.codeObject - 1].data, data = le.objects[S.dataObject - 1].data, dv = view(code); // @math object numbers count from 1
  const sites = objectFixups(le, parseFixups(exe, le)).filter(f => f.type === V.offset32 && f.object === S.codeObject && f.targetObject === S.dataObject);
  const found = [];
  for (const f of sites) {
    const name = String.fromCharCode(...data.subarray(f.target, data.indexOf(0, f.target)));
    if (!/^[A-Z0-9_]+\.SP$/i.test(name) || code[f.offset - 1] !== S.movEax) continue; // @math the opcode byte sits just before its dword
    const at = f.offset - 1 + S.movLength; // @math the instruction after the name load
    if (code[at] !== S.movEdx) continue;
    found.push({ name, site: f.offset - 1, size: dv.getUint32(at + 1, true) }); // @math the dword after the opcode
  }
  return found.sort((a, b) => a.site - b.site);
}

function validate(exe, dat, V) {
  const S = V.s, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), found = loaders(exe, V);
  assert.deepEqual(found, S.loaders, 'the loaders that name a member and its size');
  for (const { name, size } of found) assert.equal(members.get(name.toUpperCase()).length, size, `${name}: the member is exactly the size the loader asks for`);
  assert.equal(new Set(found.map(f => f.name)).size, S.members, 'the distinct members');
}

export default {
  id: 'sp-loaders',
  claims: ['sp.loader-sizes'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), dat = await ctx.open('WACKY.DAT'), V = values(), s = patch => () => validate(exe, dat, { ...V, s: { ...V.s, ...patch } });
    const first = V.s.loaders[0];
    return [
      { label: 'a loader dropped', fn: s({ loaders: V.s.loaders.slice(1) }) },
      { label: 'a size one more', fn: s({ loaders: [{ ...first, size: first.size + 1 }, ...V.s.loaders.slice(1)] }) },
      { label: 'a site one byte on', fn: s({ loaders: [{ ...first, site: first.site + 1 }, ...V.s.loaders.slice(1)] }) },
      { label: 'one member more', fn: s({ members: V.s.members + 1 }) },
      { label: 'the mov edx opcode as mov ecx', fn: s({ movEdx: V.s.movEdx + 1 }) },
      { label: 'name load 6 bytes long', fn: s({ movLength: V.s.movLength + 1 }) },
    ];
  },
};
