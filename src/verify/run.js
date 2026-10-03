// npm run verify: re-executes every check against the user's own game files, re-hashes every
// citation, and fails if a PROVEN claim lacks a passing, maintainer-reviewed check.
//   node src/verify/run.js [--game DIR] [--report FILE] [--only CLAIM] [--mutate JSON] [--json]
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { claims, CITATION } from '../evidence/registry.js';
import { crc32, hex8, FP_LENGTH } from '../evidence/crc32.js';
import { locateLe, objectBytes } from '../formats/le.js';
import { openGameFolder } from '../vfs/node.js';
import { loadObs } from './obs.js';

const here = fileURLToPath(new URL('.', import.meta.url));

export async function loadChecks(dir = resolve(here, 'checks')) {
  const files = (await readdir(dir)).filter(f => f.endsWith('.js')).sort(), checks = new Map();
  for (const file of files) {
    const c = (await import(pathToFileURL(resolve(dir, file)))).default, id = basename(file, '.js');
    if (!c || c.id !== id) throw new Error(`${file}: default export must be a check with id "${id}"`);
    if (typeof c.run !== 'function') throw new Error(`${id}: missing run(ctx)`);
    if (c.discriminate !== undefined && typeof c.discriminate !== 'function') throw new Error(`${id}: discriminate must be a function`);
    if (c.reviewed !== null && !(typeof c.reviewed?.by === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.reviewed?.date))) throw new Error(`${id}: reviewed must be null or {by, date: YYYY-MM-DD}`);
    if (!Array.isArray(c.claims) || !c.claims.length) throw new Error(`${id}: claims must list the claims it executes`);
    checks.set(id, c);
  }
  return checks;
}

// Claims and checks must name each other; a one-sided link is a bookkeeping error, not evidence.
// An observation record is evidence only through a check that declares it (`obs: [ids]`) and is
// listed by a claim that cites it; an orphan record or a claim citing a missing one is an error.
export function crossValidate(checks, obs = new Map()) {
  const errors = [];
  for (const c of claims.values()) for (const id of c.evidence.checks ?? []) {
    if (!checks.has(id)) errors.push(`${c.id}: check ${id} does not exist`);
    else if (!checks.get(id).claims.includes(c.id)) errors.push(`${c.id}: check ${id} does not list it`);
  }
  for (const k of checks.values()) for (const id of k.claims) {
    if (!claims.has(id)) errors.push(`${k.id}: unknown claim ${id}`);
    else if (!(claims.get(id).evidence.checks ?? []).includes(k.id)) errors.push(`${k.id}: claim ${id} does not cite it`);
  }
  const cited = new Set();
  for (const c of claims.values()) for (const id of c.evidence.obs ?? []) {
    cited.add(id);
    if (!obs.has(id)) errors.push(`${c.id}: observation ${id} does not exist in src/evidence/obs`);
    else if (!(c.evidence.checks ?? []).some(k => checks.get(k)?.obs?.includes(id))) errors.push(`${c.id}: no check of this claim declares observation ${id}`);
  }
  for (const id of obs.keys()) if (!cited.has(id)) errors.push(`observation ${id} is cited by no claim`);
  for (const k of checks.values()) for (const id of k.obs ?? []) if (!obs.has(id)) errors.push(`${k.id}: declares unknown observation ${id}`);
  return errors;
}

async function citation(ctx, at) {
  const [, file, object, offset, fp] = at.match(CITATION);
  const { le } = locateLe(await ctx.open(file));
  const got = hex8(crc32(objectBytes(le, Number(object), parseInt(offset, 16), FP_LENGTH))); // @math hex radix
  if (got !== fp) throw new Error(`${at}: bytes hash to ${got}`);
}

async function runCheck(ctx, check) {
  const result = { id: check.id, reviewed: check.reviewed, pass: false, discriminators: [] };
  try { await check.run(ctx); result.pass = true; } catch (e) { result.error = e.message; }
  if (result.pass && check.discriminate) {
    try {
      for (const { label, fn } of await check.discriminate(ctx)) {
        let failed = false;
        try { await fn(); } catch { failed = true; }
        result.discriminators.push({ label, failed });
        if (!failed) { result.pass = false; result.error = `discriminator "${label}" did not fail`; }
      }
    } catch (e) { result.pass = false; result.error = `discriminate: ${e.message}`; }
  }
  return result;
}

export async function verify({ game, only, mutate } = {}) {
  if (mutate) globalThis.__DR_MUTATE__ = mutate;
  const checks = await loadChecks(), { records: obs, errors: obsErrors } = await loadObs(), errors = [...obsErrors, ...crossValidate(checks, obs)];
  const vfs = await openGameFolder(game ? resolve(game) : undefined);
  const ctx = { ...vfs, obs: id => { const r = obs.get(id); if (!r) throw new Error(`No observation ${id}`); return r; } };
  const selected = only ? new Set(claims.get(only)?.evidence.checks ?? []) : null;
  const results = new Map();
  for (const check of checks.values()) if (!selected || selected.has(check.id)) results.set(check.id, await runCheck(ctx, check));
  const report = { date: new Date().toISOString(), errors, checks: [...results.values()], claims: [] };
  for (const c of claims.values()) {
    if (only && c.id !== only) continue;
    const listed = (c.evidence.checks ?? []).map(id => results.get(id)).filter(Boolean);
    const passing = listed.filter(r => r.pass), reviewed = passing.filter(r => r.reviewed);
    const citations = [];
    for (const at of c.evidence.at ?? []) {
      try { await citation(ctx, at); citations.push({ at, ok: true }); } catch (e) { citations.push({ at, ok: false, error: e.message }); }
    }
    const citationsOk = citations.every(x => x.ok), allPass = listed.length > 0 && passing.length === listed.length;
    let status;
    if (c.tag === 'PROVEN') status = allPass && reviewed.length && citationsOk ? 'ok' : 'FAIL';
    else if (!citationsOk) status = 'FAIL';
    else status = allPass && reviewed.length ? 'promotable' : 'ok';
    report.claims.push({ id: c.id, tag: c.tag, status, checks: listed.map(r => ({ id: r.id, pass: r.pass, reviewed: Boolean(r.reviewed), error: r.error })), citations });
  }
  report.ok = !errors.length && report.claims.every(c => c.status !== 'FAIL');
  return report;
}

function print(report) {
  for (const e of report.errors) console.error(`ERROR ${e}`);
  for (const r of report.checks) {
    console.log(`${r.pass ? 'pass' : 'FAIL'}  check ${r.id}${r.reviewed ? '' : ' (unreviewed)'}${r.error ? ` — ${r.error}` : ''}`);
    for (const d of r.discriminators) console.log(`        discriminator ${d.failed ? 'rejected' : 'ACCEPTED'}: ${d.label}`);
  }
  for (const c of report.claims) {
    const bad = c.citations.filter(x => !x.ok).map(x => x.error);
    console.log(`${c.status.padEnd(10)} ${c.tag.padEnd(7)} ${c.id}${bad.length ? ` — ${bad.join('; ')}` : ''}`); // @math column widths
  }
  console.log(report.ok ? `verify: ${report.claims.length} claims, ${report.checks.length} checks, all consistent` : 'verify: FAILED');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { game: { type: 'string' }, report: { type: 'string' }, only: { type: 'string' }, mutate: { type: 'string' }, json: { type: 'boolean' } } });
  try {
    const report = await verify({ game: values.game, only: values.only, mutate: values.mutate && JSON.parse(values.mutate) });
    if (values.json) process.stdout.write(JSON.stringify(report));
    else {
      print(report);
      if (values.report) {
        await mkdir(dirname(resolve(values.report)), { recursive: true });
        await writeFile(resolve(values.report), JSON.stringify(report, null, 2));
      }
    }
    process.exitCode = report.ok ? 0 : 1;
  } catch (e) { console.error(`verify: ${e.message}`); process.exitCode = 2; } // @math distinct exit for setup errors
}
