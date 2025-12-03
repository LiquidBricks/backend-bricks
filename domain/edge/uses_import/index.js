import { componentInstance_componentInstance, meta as componentInstanceMeta } from './componentInstance_componentInstance/index.js';

export function uses_import({ g, diagnostics }) {
  return {
    componentInstance_componentInstance: componentInstance_componentInstance({ g, diagnostics }),
  };
}

export const meta = {
  componentInstance_componentInstance: componentInstanceMeta,
}
