import { componentInstance_stateMachine, meta as componentInstanceStateMachineMeta } from './componentInstance_stateMachine/index.js';

export function has_stateMachine({ g, diagnostics }) {
  return {
    componentInstance_stateMachine: componentInstance_stateMachine({ g, diagnostics }),
  };
}

export const meta = {
  componentInstance_stateMachine: componentInstanceStateMachineMeta,
}
