// DOSBox observation records (src/evidence/obs/*.json): numeric-only facts about a run of the
// real game, written by tools/dosbox/observe.mjs. A record is evidence only through a check that
// cross-validates it against the in-process decode (docs/evidence.md). Records never hold asset
// bytes: strings are short labels, and numbers are addresses, counts, values and CRC-32s.
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../evidence/obs/', import.meta.url));
const REQUIRED = ['id', 'tool', 'date', 'exe', 'moment'];

function guard(value, path, errors) {
  if (typeof value === 'string') { if (value.length > 200) errors.push(`${path}: string longer than 200 characters`); } // @math label length cap: a record holds labels, not data
  else if (Array.isArray(value)) {
    if (value.length > 4096) errors.push(`${path}: array longer than 4096 entries`); // @math record size cap
    if (value.length > 64 && value.every(v => Number.isInteger(v) && v >= 0 && v < 256)) errors.push(`${path}: looks like raw bytes`); // @math long arrays of byte values are asset bytes
    value.forEach((v, i) => guard(v, `${path}[${i}]`, errors));
  } else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) guard(v, `${path}.${k}`, errors);
  else if (typeof value !== 'number' && typeof value !== 'boolean' && value !== null) errors.push(`${path}: unsupported value type`);
}

export function validateObs(record, file = 'record') {
  const errors = [];
  for (const k of REQUIRED) if (!(k in record)) errors.push(`${file}: missing ${k}`);
  if (record.id !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id)) errors.push(`${file}: invalid id`);
  if (record.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) errors.push(`${file}: date must be YYYY-MM-DD`);
  guard(record, file, errors);
  return errors;
}

export async function loadObs() {
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.json')).sort(), records = new Map(), errors = [];
  for (const f of files) {
    const record = JSON.parse(await readFile(resolve(dir, f), 'utf8'));
    errors.push(...validateObs(record, f));
    if (record.id !== f.replace(/\.json$/, '')) errors.push(`${f}: id must equal the file name`);
    records.set(record.id, record);
  }
  return { records, errors };
}
