// npm run check:identity: what the Enhanced presentation and the reference renderer draw now must be what an earlier commit drew, frame for
// frame (docs/enhancements.md, Stage 4 as built). Makes a temporary git worktree of the ref (default 3f8af9d, the commit before Stage 4),
// runs scripts/hash-enhance.js against that source root and against this tree (in parallel, on this repository's own WACKY.DAT), compares
// the hashes and removes the worktree. The hashes stay in a temporary directory, which is removed when everything is identical and kept (its
// path printed) when something differs. A regression gate, not evidence about the game.
// usage: node scripts/compare-enhance.mjs [ref] [--head <source root>] [--ticks N] [--mode all|enhanced|reference]
//   --head hashes another source root instead of this tree (a copy with a deliberate change, to see the gate bite).
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, access } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..'), BASE_REF = '3f8af9d';
const args = process.argv.slice(2), valued = ['--head', '--ticks', '--mode'], opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const ref = args.find((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1])) ?? BASE_REF, head = resolve(opt('--head') ?? REPO);
const pass = valued.slice(1).flatMap(k => (opt(k) === null ? [] : [k, opt(k)]));
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const exists = p => access(p).then(() => true, () => false);

const dir = await mkdtemp(join(tmpdir(), 'wackywheels-identity-')), worktree = join(dir, 'base');
let added = false;
// Removes the worktree (synchronous: the signal handlers call it too). A remove that fails (another git command holding the repository's lock,
// say) is tried once more after a moment and then reported; the checkout is deleted either way (its node_modules link is unlinked, not
// followed) and the registration pruned after that, so neither stays behind, also when the hashes are kept.
function removeWorktree() {
  if (!added) return;
  added = false;
  let failed = null;
  for (let attempt = 0; attempt < 2; attempt++) { // @math one retry
    try { git('worktree', 'remove', '--force', worktree); failed = null; break; } catch (e) { failed = e; if (!attempt) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); } // @math half a second for a lock to go
  }
  if (failed) console.log(`check:identity: git worktree remove failed (${String(failed.stderr ?? failed.message).trim()}); deleting the checkout and pruning instead`);
  try { rmSync(worktree, { recursive: true, force: true }); } catch (e) { console.log(`check:identity: could not delete ${worktree}: ${e.message}`); }
  try { git('worktree', 'prune'); } catch (e) { console.log(`check:identity: git worktree prune failed: ${String(e.stderr ?? e.message).trim()}`); }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { removeWorktree(); process.exit(130); }); // @math the shell's code for an interrupted command

// Runs the hash script against a source root; its lines are shown with a label.
function hashes(label, root, out) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [join(HERE, 'hash-enhance.js'), '--root', root, '--out', out, ...pass], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stdout.on('data', d => { for (const line of String(d).split('\n').filter(Boolean)) console.log(`${label}: ${line}`); });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => (code === 0 ? done(out) : fail(new Error(`${label}: hash-enhance exited with ${code}\n${err}`))));
  });
}

// The first difference of two lists of per-picture hashes: null when equal.
function firstDifference(a, b) {
  if (!a || !b) return a === b ? null : 'missing on one side';
  if (a.length !== b.length) return `${a.length} pictures against ${b.length}`;
  const i = a.findIndex((h, k) => h !== b[k]);
  return i < 0 ? null : `picture ${i}`;
}

let differences = 0, compared = 0;
const differ = msg => { differences++; console.log(`DIFF ${msg}`); };
try {
  try { git('worktree', 'prune'); } catch { /* nothing to prune */ } // a worktree left behind by an interrupted run
  const commit = git('rev-parse', '--short', `${ref}^{commit}`);
  git('worktree', 'add', '--detach', worktree, commit); added = true;
  if (!(await exists(join(worktree, 'node_modules'))) && (await exists(join(REPO, 'node_modules')))) await symlink(join(REPO, 'node_modules'), join(worktree, 'node_modules'), 'dir');
  console.log(`check:identity: ${commit} (${worktree}) against ${head === REPO ? 'this tree' : head}`);
  const [before, after] = (await Promise.all([hashes(commit, worktree, join(dir, 'base.json')), hashes('now', head, join(dir, 'head.json'))].map(p => p.then(async f => JSON.parse(await readFile(f, 'utf8'))))));
  for (const key of new Set([...Object.keys(before.enhanced), ...Object.keys(after.enhanced)])) {
    const A = before.enhanced[key] ?? {}, B = after.enhanced[key] ?? {}, same = [];
    for (const name of new Set([...Object.keys(A), ...Object.keys(B)])) {
      compared++;
      const buffers = new Set([...Object.keys(A[name] ?? {}), ...Object.keys(B[name] ?? {})]), found = [...buffers].map(k => [k, firstDifference(A[name]?.[k], B[name]?.[k])]).filter(([, d]) => d);
      if (found.length) differ(`configuration ${key}, ${name}: ${found.map(([k, d]) => `${k} at ${d}`).join(', ')}`); else same.push(name);
    }
    if (same.length) console.log(`same configuration ${key}: ${same.length} scenarios identical (${same.join(', ')})`);
  }
  const tracks = new Set([...Object.keys(before.reference), ...Object.keys(after.reference)]);
  let sameTracks = 0;
  for (const track of tracks) {
    compared++;
    const found = ['race', 'split'].map(k => [k, firstDifference(before.reference[track]?.[k], after.reference[track]?.[k])]).filter(([, d]) => d);
    if (found.length) differ(`reference track ${track}: ${found.map(([k, d]) => `${k} at ${d}`).join(', ')}`); else sameTracks++;
  }
  if (tracks.size) console.log(`same reference: ${sameTracks} of ${tracks.size} tracks identical (race and fly-in, split screen, detail levels 1 and 3)`);
} catch (e) { differences++; console.log(`FAIL ${e.message}`); }
finally { removeWorktree(); }
if (differences) console.log(`hashes kept in ${dir}`); else await rm(dir, { recursive: true, force: true });
console.log(`check:identity ${ref}: ${compared} comparisons, ${differences ? `${differences} differences` : 'identical'}`);
process.exitCode = differences ? 1 : 0;
