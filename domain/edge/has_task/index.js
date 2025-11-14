import { component_task, meta as componentTaskMeta } from './component_task/index.js';

export function has_task({ g, diagnostics }) {
  return {
    component_task: component_task({ g, diagnostics }),
  };
}

export const meta = {
  component_task: componentTaskMeta,
}
