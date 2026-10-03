// Node adapter for the user's game folder. Reads files in-process; nothing is extracted or
// cached on disk.
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createVfs } from './core.js';

async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []), files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await scan(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function openGameFolder(root = resolve('game')) {
  const files = (await scan(root)).map(path => ({ path: relative(root, path).split(sep).join('/'), read: () => readFile(path) }));
  return { root, ...createVfs(files, { label: root }) };
}
