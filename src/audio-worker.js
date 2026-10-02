import { renderOpl, renderMidi } from './synthesis.js';
self.onmessage = ({ data: { id, kind, data, limit } }) => {
  try {
    const result = kind === 'mid' ? renderMidi(data, limit) : renderOpl(data, kind, limit);
    self.postMessage({ id, result }, [result.samples.buffer]);
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
