import { componentInstance_component, meta as componentInstanceComponentMeta } from './componentInstance_component/index.js';

export function instance_of({ g, diagnostics }) {
  return {
    componentInstance_component: componentInstance_component({ g, diagnostics }),
  };
}

export const meta = {
  componentInstance_component: componentInstanceComponentMeta,
}
