// npm run mutate: for every PROVEN claim with a value, perturb each leaf of the value (±1 for
// numbers, a flipped bit for strings/booleans) through K()'s __DR_MUTATE__ hook in a fresh process
// and re-run only that claim's checks. A mutation the checks survive means the claim is not
// actually asserted, and the run fails.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { claims } from '../evidence/registry.js';
import { leaves } from '../evidence/k.js';

// A mutation can make a check loop forever (a step count of zero or a negative size): a runner that outlives this is killed and counted as having noticed it.
const TIMEOUT_MS = 5 * 60 * 1000; // @math five minutes, far above the seconds a check takes
const run = promisify(execFile), runner = fileURLToPath(new URL('./run.js', import.meta.url));

function variants(value) {
  return leaves(value).flatMap(path => {
    const leaf = path.reduce((v, k) => v[k], value);
    return typeof leaf === 'number' ? [{ path, variant: 'inc' }, { path, variant: 'dec' }] : [{ path, variant: 'flip' }];
  });
}

const { values } = parseArgs({ options: { game: { type: 'string' }, only: { type: 'string' } } });
const targets = [...claims.values()].filter(c => c.tag === 'PROVEN' && 'value' in c && (!values.only || c.id === values.only));
let survivors = 0, total = 0;
for (const c of targets) {
  const jobs = variants(c.value).map(async v => {
    const args = [runner, '--json', '--only', c.id, '--mutate', JSON.stringify({ id: c.id, ...v }), ...(values.game ? ['--game', values.game] : [])];
    let report;
    try { report = JSON.parse((await run(process.execPath, args, { maxBuffer: 1 << 26, timeout: TIMEOUT_MS, killSignal: 'SIGKILL' })).stdout); } // @math stdout buffer size
    catch (e) {
      // A runner that dies under the mutation has noticed it; the original value never crashes it.
      if (!e.stdout) return { ...v, killed: true, crashed: e.killed ? 'timed out' : (e.stderr || e.message).trim().split('\n')[0] };
      report = JSON.parse(e.stdout);
    }
    return { ...v, killed: report.checks.some(r => !r.pass) };
  });
  for (const r of await Promise.all(jobs)) {
    total++;
    if (r.crashed) console.log(`crashed  ${c.id} ${r.path.join('.')} ${r.variant}: ${r.crashed}`);
    if (!r.killed) { survivors++; console.log(`SURVIVED ${c.id} ${r.path.join('.') || '(value)'} ${r.variant}`); }
  }
}
console.log(`mutate: ${total} mutations over ${targets.length} PROVEN claims, ${survivors} survived`);
process.exitCode = survivors ? 1 : 0;
