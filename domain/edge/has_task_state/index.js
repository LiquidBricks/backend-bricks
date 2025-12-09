import { stateMachine_task, meta as stateMachineTaskMeta } from './stateMachine_task/index.js';

export function has_task_state({ g, diagnostics }) {
  return {
    stateMachine_task: stateMachine_task({ g, diagnostics }),
  };
}

export const meta = {
  stateMachine_task: stateMachineTaskMeta,
}
