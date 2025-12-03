import { component_component, meta as componentComponentMeta } from './component_component/index.js';

export function has_import({ g, diagnostics }) {
  return {
    component_component: component_component({ g, diagnostics }),
  };
}

export const meta = {
  component_component: componentComponentMeta,
}
