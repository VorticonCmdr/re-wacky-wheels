// The one file-access interface every page, tool and check uses:
//   list() -> relative paths, has(name) -> bool, open(name) -> Promise<Uint8Array>,
//   openPath(path) -> Promise<Uint8Array>
// open() matches by case-insensitive basename; a name that matches two files is an error rather than
// a guess. openPath() matches the whole relative path (case-insensitively, either slash) and is the
// way to reach one of several files with the same name. Adapters (node.js, dev.js, picker.js) only say how to enumerate and read bytes.
export function createVfs(files, { label = 'the game folder', maxBytes = Infinity } = {}) {
  const base = p => p.split(/[\\/]/).at(-1).toLowerCase(), cache = new Map();
  const find = name => {
    const hits = files.filter(f => base(f.path) === name.toLowerCase());
    if (hits.length > 1) throw new Error(`${name} is ambiguous in ${label}: ${hits.map(h => h.path).join(', ')}`);
    return hits[0];
  };
  const norm = p => p.replace(/\\/g, '/').toLowerCase();
  const read = (file, name) => {
    if (!file) throw new Error(`${name} not found in ${label}`);
    if (file.size > maxBytes) throw new Error(`${name} exceeds the ${maxBytes} byte limit`);
    if (!cache.has(file.path)) cache.set(file.path, file.read().then(b => new Uint8Array(b)));
    return cache.get(file.path);
  };
  return {
    list: () => files.map(f => f.path),
    has: name => Boolean(find(name)),
    open: async name => read(find(name), name),
    openPath: async path => read(files.find(f => norm(f.path) === norm(path)), path),
  };
}
