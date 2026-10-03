// npm run dump:le -- [--game DIR] [--out analysis/ww] [--exe WW.EXE]
// Writes derived artefacts for Ghidra into analysis/ (git-ignored; src/ never reads them):
//   obj<N>.bin    pre-fixup object image, zero-filled to its virtual size
//   fixups.json   [{object, offset, type, value}] object-relative sites, value = base + target
//   layout.json   {exe, objects:[{number, base, virtualSize, flags}], eip, esp}
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { openGameFolder } from '../src/vfs/node.js';
import { locateLe, parseFixups, objectBytes, objectFixups } from '../src/formats/le.js';

const { values } = parseArgs({ options: { game: { type: 'string' }, out: { type: 'string', default: 'analysis/ww' }, exe: { type: 'string', default: 'WW.EXE' } } });
const vfs = await openGameFolder(values.game && resolve(values.game));
const exe = await vfs.open(values.exe), { le } = locateLe(exe), out = resolve(values.out);
await mkdir(out, { recursive: true });
for (const obj of le.objects) await writeFile(resolve(out, `obj${obj.number}.bin`), objectBytes(le, obj.number, 0, obj.virtualSize));
const fixups = objectFixups(le, parseFixups(exe, le)).map(f => ({ ...f, value: le.objects[f.targetObject - 1].base + f.target }));
await writeFile(resolve(out, 'fixups.json'), JSON.stringify(fixups));
await writeFile(resolve(out, 'layout.json'), JSON.stringify({
  exe: values.exe, size: exe.length, mz: le.mz, header: le.header,
  objects: le.objects.map(({ number, base, virtualSize, flags }) => ({ number, base, virtualSize, flags })),
  eip: le.eip, esp: le.esp,
}, null, 2));
console.log(`dump:le: ${le.objects.length} objects and ${fixups.length} fixups written to ${values.out}`);
