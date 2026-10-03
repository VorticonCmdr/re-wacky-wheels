// Client for the dosbox-automation REST API plus the logic that finds where DOS/4G put WW.EXE's
// objects in guest memory. Everything here is tooling: what it records becomes evidence only
// through src/evidence/obs/ records and the checks that cross-validate them (docs/evidence.md).
import { createHash } from 'node:crypto';
import { maskedCrc } from '../../src/evidence/crc32.js';
import { siteMasks } from '../../src/formats/le.js';

export { maskedCrc, siteMasks };

export const API = process.env.DOSBOX_API ?? 'http://127.0.0.1:8386';
export const PAGE = 4096; // LE page size, proven by le-pages

export async function status() {
  const [st, hello] = await Promise.all([fetch(`${API}/api/v1/status`), fetch(`${API}/api/v1/hello`)]);
  if (!st.ok || !hello.ok) throw new Error(`DOSBox is not reachable at ${API}`);
  return { ...(await st.json()), ...(await hello.json()) };
}
export async function readMemory(address, length) {
  const r = await fetch(`${API}/api/v1/memory/${address}/${length}`);
  if (!r.ok) throw new Error(`Reading ${length} bytes at ${address} failed: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
export const sha1 = bytes => createHash('sha1').update(bytes).digest('hex');

function pageSpan(obj, p) { return [p * PAGE, Math.min((p + 1) * PAGE, obj.data.length)]; }

// Find the live base of every object inside [windowStart, windowStart + window.length).
// Candidate bases come from pages whose masked bytes match the file; obj1 candidates are then
// told apart by whether their fixup sites hold base + target (the relocated image) or the raw
// target offset (a staging copy).
export function locateObjects(le, exe, window, windowStart) {
  window = Buffer.from(window.buffer, window.byteOffset, window.length); // Buffer.indexOf searches for byte sequences
  const { sites, masks } = siteMasks(le, exe), votes = le.objects.map(() => new Map());
  le.objects.forEach((obj, oi) => {
    for (let p = 0; p * PAGE < obj.data.length; p++) {
      const [a, b] = pageSpan(obj, p), seg = obj.data.subarray(a, b), mk = masks[oi].subarray(a, b);
      let s = -1;
      for (let i = 0; i + 32 <= seg.length; i++) { // @math anchor of 32 consecutive unmasked bytes
        if (!mk.subarray(i, i + 32).some(Boolean) && new Set(seg.subarray(i, i + 32)).size > 10) { s = i; break; } // @math entropy floor for a usable anchor
      }
      if (s < 0) continue;
      const anchor = Buffer.from(seg.subarray(s, s + 32)); // @math anchor length
      for (let pos = window.indexOf(anchor); pos >= 0; pos = window.indexOf(anchor, pos + 1)) {
        const start = pos - s;
        if (start < 0 || start + seg.length > window.length) continue;
        let ok = true;
        for (let i = 0; i < seg.length && ok; i++) if (!mk[i] && window[start + i] !== seg[i]) ok = false;
        if (ok) { const base = windowStart + start - a; votes[oi].set(base, (votes[oi].get(base) ?? 0) + 1); }
      }
    }
  });
  const candidates = votes.map(v => [...v].filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1])); // @math at least two agreeing pages; the relocation probe decides between candidates
  const read32 = addr => { const o = addr - windowStart; return o >= 0 && o + 4 <= window.length ? Buffer.from(window.buffer, window.byteOffset + o, 4).readUInt32LE(0) : null; };
  const probe = sites.filter(s => s.type === 7 && s.object === 1).filter((_, i) => i % 64 === 0); // @math sample every 64th site
  let best = null;
  const tryBases = (i, chosen) => {
    if (i === le.objects.length) {
      const base = n => chosen[n - 1];
      const hits = probe.filter(s => read32(base(1) + s.offset) === base(s.targetObject) + s.target).length;
      if (!best || hits > best.hits) best = { hits, chosen: [...chosen] };
      return;
    }
    for (const [b] of candidates[i]) tryBases(i + 1, [...chosen, b]);
  };
  tryBases(0, []);
  if (!best) throw new Error('No candidate base found for every object');
  const rate = best.hits / probe.length;
  if (rate < 0.95) throw new Error(`Best candidate relocates only ${best.hits}/${probe.length} sampled fixup sites`); // @math required agreement
  return { bases: best.chosen, relocated: best.hits, sampled: probe.length, sites, masks };
}
