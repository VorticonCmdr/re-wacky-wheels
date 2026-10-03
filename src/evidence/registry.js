// Claim registry. Every constant in src/{formats,render,audio,game} resolves to one of these
// records through K() or UNKNOWN(). See docs/evidence.md for the tags and promotion procedure.
import all from './claims/index.js';

export const TAGS = ['UNKNOWN', 'WF', 'STATIC', 'PROVEN']; // weakest first
export const CITATION = /^([A-Z0-9_]+\.EXE):obj([1-9][0-9]*)\+0x([0-9a-f]+) fp=([0-9a-f]{8})$/;
const ID = /^(UNKNOWN_[A-Z0-9_]+|[a-z0-9]+(?:[.-][a-z0-9]+)*)$/;
const KEYS = new Set(['id', 'tag', 'statement', 'value', 'evidence', 'leads', 'todo']);
const EVIDENCE = ['checks', 'at', 'obs', 'wf'];

export function validateClaim(c) {
  const where = `Claim ${c?.id ?? '(no id)'}`;
  if (!c || typeof c !== 'object') throw new Error('Claim must be an object');
  for (const key of Object.keys(c)) if (!KEYS.has(key)) throw new Error(`${where}: unknown field ${key}`);
  if (typeof c.id !== 'string' || !ID.test(c.id)) throw new Error(`${where}: invalid id`);
  if (!TAGS.includes(c.tag)) throw new Error(`${where}: invalid tag ${c.tag}`);
  if (typeof c.statement !== 'string' || !c.statement.trim()) throw new Error(`${where}: missing statement`);
  if (c.id.startsWith('UNKNOWN_') !== (c.tag === 'UNKNOWN')) throw new Error(`${where}: UNKNOWN_ ids and the UNKNOWN tag go together`);
  if (c.tag === 'UNKNOWN' && 'value' in c) throw new Error(`${where}: an UNKNOWN claim has no value; record candidates in leads`);
  if (!c.evidence || typeof c.evidence !== 'object') throw new Error(`${where}: missing evidence`);
  for (const key of Object.keys(c.evidence)) if (!EVIDENCE.includes(key)) throw new Error(`${where}: unknown evidence field ${key}`);
  for (const key of EVIDENCE) {
    const list = c.evidence[key] ?? [];
    if (!Array.isArray(list) || list.some(s => typeof s !== 'string' || !s)) throw new Error(`${where}: evidence.${key} must be a list of strings`);
  }
  for (const at of c.evidence.at ?? []) if (!CITATION.test(at)) throw new Error(`${where}: citation "${at}" is not BIN.EXE:obj<N>+0x<off> fp=<crc32>`);
  if (c.tag === 'PROVEN' && !c.evidence.checks?.length) throw new Error(`${where}: PROVEN needs a check`);
  if (c.tag === 'STATIC' && !c.evidence.at?.length && !c.evidence.obs?.length) throw new Error(`${where}: STATIC needs a citation or an observation`);
  if (c.tag === 'WF' && !c.evidence.wf?.length) throw new Error(`${where}: WF needs the workflow run it came from`);
  if (c.leads !== undefined && (!Array.isArray(c.leads) || c.leads.some(s => typeof s !== 'string'))) throw new Error(`${where}: leads must be a list of strings`);
  if (c.todo !== undefined && typeof c.todo !== 'string') throw new Error(`${where}: todo must be a string`);
  return c;
}

export function buildRegistry(list) {
  const map = new Map();
  for (const c of list) {
    validateClaim(c);
    if (map.has(c.id)) throw new Error(`Duplicate claim ${c.id}`);
    map.set(c.id, Object.freeze(c));
  }
  return map;
}

export const claims = buildRegistry(all);

export function claim(id) {
  const c = claims.get(id);
  if (!c) throw new Error(`No claim ${id} in src/evidence/claims`);
  return c;
}

// The weakest tag among a decode's steps. A decode that touched no claim proves nothing.
export function weakest(tags) {
  if (!tags.length) return 'UNKNOWN';
  let rank = TAGS.length - 1;
  for (const t of tags) rank = Math.min(rank, TAGS.indexOf(t));
  return TAGS[rank];
}
