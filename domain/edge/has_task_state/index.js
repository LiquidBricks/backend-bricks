import { componentInstance_task, meta as componentInstanceTaskMeta } from './componentInstance_task/index.js';

export function has_task_state({ g, diagnostics }) {
  return {
    componentInstance_task: componentInstance_task({ g, diagnostics }),
  };
}

export const meta = {
  componentInstance_task: componentInstanceTaskMeta,
}
