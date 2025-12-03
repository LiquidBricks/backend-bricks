import { vertex, meta as vertexMeta } from './vertex/index.js';
import { edge, meta as edgeMeta } from './edge/index.js';

export function dataMapper({ g, diagnostics }) {
  return {
    vertex: vertex({ g, diagnostics }),
    edge: edge({ g, diagnostics }),
  };
}
export const domain = {
  vertex: vertexMeta,
  edge: edgeMeta,
}
