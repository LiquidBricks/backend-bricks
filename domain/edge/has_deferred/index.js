import { component_deferred, meta as componentDeferredMeta } from './component_deferred/index.js';

export function has_deferred({ g, diagnostics }) {
  return {
    component_deferred: component_deferred({ g, diagnostics }),
  };
}

export const meta = {
  component_deferred: componentDeferredMeta,
}
