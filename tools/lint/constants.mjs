// npm run lint: enforces THE RULE (docs/evidence.md) on the evidence-governed directories.
//  - numeric literals other than 0/1 only inside K(...), or on a line tagged
//    `// @math <reason>` (bit mechanics) or `// @spec <claimId>` (claim with leads and a check);
//  - K/UNKNOWN take a string-literal claim id that exists (and K's claim has a value);
//  - src/game/** uses only PROVEN/STATIC claims and never imports formats/hypotheses/;
//  - nothing under src/ refers to analysis/;
//  - every module in src/formats/hypotheses/ calls noteStep('<claim>') inside a function, naming a
//    WF or UNKNOWN claim, so any decode that runs it badges no stronger than that claim;
//  - src/enhance/ (the Enhanced presentation, docs/enhancements.md) is outside THE RULE but has its own: its design numbers live
//    in src/enhance/config.js only (other modules: 0, 1 and `// @math <reason>` lines), it cites no claims (K/UNKNOWN), it never
//    assigns to the race `state`, never imports formats/hypotheses/, and only src/enhance/ itself, the playtest page (src/play.js), the asset garage's previews (src/viewer.js, src/viewer-preview.js) and the track editor's Atmosphere tab (src/track-atmosphere.js) import it.
// Usage: node tools/lint/constants.mjs [files or dirs...]   (default: the governed directories)
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, sep, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// expected(id) lets checks read a claim's value through K(); it is the only dynamic-id caller.
const DYNAMIC_ID = ['src/verify/expect.js'];
export const GOVERNED = ['src/formats', 'src/render', 'src/audio', 'src/game', 'src/verify/checks'];
export const ENHANCE = 'src/enhance', ENHANCE_CONFIG = 'src/enhance/config.js', ENHANCE_USERS = ['src/play.js', 'src/viewer-preview.js', 'src/viewer.js', 'src/track-atmosphere.js'];

async function files(path) {
  const s = await stat(path).catch(() => null);
  if (!s) return [];
  if (s.isFile()) return /\.m?js$/.test(path) ? [path] : [];
  const out = [];
  for (const e of await readdir(path)) out.push(...await files(resolve(path, e)));
  return out;
}

export async function lintSource(source, file, claims) {
  const rel = relative(process.cwd(), file).split(sep).join('/');
  const governed = GOVERNED.some(d => rel === d || rel.startsWith(d + '/'));
  const inGame = rel.startsWith('src/game/'), inEnhance = rel.startsWith(`${ENHANCE}/`), problems = [], lines = source.split('\n');
  const report = (node, msg) => problems.push(`${rel}:${node.loc.start.line}:${node.loc.start.column + 1} ${msg}`);
  const comments = [];
  let ast;
  try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: comments }); }
  catch (e) { return [`${rel}: parse error ${e.message}`]; }
  const tags = new Map();
  for (const c of comments) {
    const m = c.value.match(/@(math|spec)\b\s*(.*)$/);
    if (!m) continue;
    const line = c.loc.start.line, reason = m[2].trim();
    if (m[1] === 'math' && !reason) problems.push(`${rel}:${line} @math needs a reason`);
    if (m[1] === 'spec') {
      const id = reason.split(/\s/)[0], cl = claims.get(id);
      if (!cl) problems.push(`${rel}:${line} @spec ${id || '(none)'} is not a claim`);
      else if (!cl.leads?.length || !cl.evidence.checks?.length) problems.push(`${rel}:${line} @spec ${id} must name a claim with leads and a validating check`);
    }
    tags.set(line, m[1]);
  }
  // Collect K() value arguments first: acorn-walk visits children before their parents.
  const inHypotheses = rel.startsWith('src/formats/hypotheses/');
  let marked = false;
  const insideK = new Set();
  walk.simple(ast, { CallExpression(node) { if (node.callee.type === 'Identifier' && node.callee.name === 'K' && node.arguments[0]) insideK.add(node.arguments[0]); } });
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && (node.callee.name === 'K' || node.callee.name === 'UNKNOWN')) {
      const name = node.callee.name, idArg = node.arguments[name === 'K' ? 1 : 0];
      if (inEnhance) return report(node, `src/enhance cites no claims (${name}): it reads reconstructed values through the modules that own them`);
      if (idArg?.type !== 'Literal' || typeof idArg.value !== 'string') {
        if (!DYNAMIC_ID.includes(rel)) report(node, `${name}() needs a string-literal claim id`);
        return;
      }
      const cl = claims.get(idArg.value);
      if (!cl) return report(node, `${name}(): no claim ${idArg.value}`);
      if (name === 'K' && !('value' in cl)) report(node, `K(): claim ${idArg.value} records no value`);
      if (inGame && !['PROVEN', 'STATIC'].includes(cl.tag)) report(node, `src/game may use only PROVEN/STATIC claims; ${idArg.value} is ${cl.tag}`);
    }
    if (inHypotheses && node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'noteStep') {
      const id = node.arguments[0], cl = id?.type === 'Literal' ? claims.get(id.value) : null;
      if (!cl) report(node, 'noteStep() needs a string-literal id of an existing claim');
      else if (!['WF', 'UNKNOWN'].includes(cl.tag)) report(node, `a hypotheses module must note a WF or UNKNOWN claim; ${cl.id} is ${cl.tag}`);
      else if (!ancestors.some(a => /Function/.test(a.type))) report(node, 'noteStep() at module level never reaches a decode\'s withSteps; call it inside the parser');
      else marked = true;
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && /(^|\/)analysis\//.test(node.value) && rel.startsWith('src/')) report(node, 'src/ never reads analysis/');
    if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source?.type === 'Literal' && typeof node.source.value === 'string') {
      const target = relative(process.cwd(), resolve(dirname(file), node.source.value)).split(sep).join('/');
      if ((inGame || inEnhance) && target.startsWith('src/formats/hypotheses/')) report(node, `${inGame ? 'src/game' : 'src/enhance'} may not import formats/hypotheses/`);
      if (target.startsWith(`${ENHANCE}/`) && !inEnhance && !ENHANCE_USERS.includes(rel)) report(node, 'only the pages import src/enhance: the reconstructed renderer and the game never depend on the enhanced presentation');
    }
    if (inEnhance && (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression' || (node.type === 'UnaryExpression' && node.operator === 'delete'))) {
      let target = node.type === 'AssignmentExpression' ? node.left : node.argument;
      while (target?.type === 'MemberExpression') target = target.object;
      if (target?.type === 'Identifier' && target.name === 'state') report(node, 'src/enhance never writes the race state: rendering consumes it');
    }
    if (inEnhance && rel !== ENHANCE_CONFIG && node.type === 'Literal' && typeof node.value === 'number' && node.value !== 0 && node.value !== 1 && !tags.has(node.loc.start.line)) {
      report(node, `numeric literal ${node.raw} in src/enhance outside config.js without @math (the design numbers live in ${ENHANCE_CONFIG})`);
    }
    if (!governed || !(node.type === 'Literal' && (typeof node.value === 'number' || typeof node.value === 'bigint'))) return;
    if (node.value === 0 || node.value === 1) return; // @math the two literals THE RULE allows
    if (ancestors.some(a => insideK.has(a))) return;
    if (tags.has(node.loc.start.line)) return;
    report(node, `numeric literal ${node.raw} outside K(...) without @math/@spec (line: ${lines[node.loc.start.line - 1].trim().slice(0, 80)})`); // @math excerpt length
  });
  if (inHypotheses && !marked && !problems.some(p => p.includes('noteStep'))) problems.push(`${rel}: hypotheses modules must call noteStep('<WF or UNKNOWN claim>') inside their parser`);
  return problems;
}

export async function lint(paths) {
  const { claims } = await import(pathToFileURL(resolve('src/evidence/registry.js')));
  const all = [];
  for (const p of paths) all.push(...await files(resolve(p)));
  const problems = [];
  for (const file of all) problems.push(...await lintSource(await readFile(file, 'utf8'), file, claims));
  return { files: all.length, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const { files: n, problems } = await lint(args.length ? args : ['src']);
  for (const p of problems) console.error(p);
  console.log(`lint: ${n} files, ${problems.length} problems`);
  process.exitCode = problems.length ? 1 : 0;
}
