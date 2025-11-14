import { component_data, meta as componentDataMeta } from './component_data/index.js';

export function has_data({ g, diagnostics }) {
  return {
    component_data: component_data({ g, diagnostics }),
  };
}

export const meta = {
  component_data: componentDataMeta,
}
