// Browser adapter for user-supplied files: <input type=file> (files or a folder) and drag-and-drop.
// Files are read locally by the browser; nothing is uploaded. Dotfiles are ignored.
import { createVfs } from './core.js';

export function openPicked(fileList, { maxBytes = 64 * 1024 * 1024 } = {}) { // @math per-file limit the viewer already applies
  const files = [...fileList].map(file => ({ path: file.webkitRelativePath || file.name, size: file.size, read: () => file.arrayBuffer() }))
    .filter(f => !f.path.split('/').some(part => part.startsWith('.')));
  return createVfs(files, { label: 'the selected files', maxBytes });
}
