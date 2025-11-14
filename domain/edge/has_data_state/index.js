import { componentInstance_data, meta as componentInstanceDataMeta } from './componentInstance_data/index.js';

export function has_data_state({ g, diagnostics }) {
  return {
    componentInstance_data: componentInstance_data({ g, diagnostics }),
  };
}

export const meta = {
  componentInstance_data: componentInstanceDataMeta,
}
