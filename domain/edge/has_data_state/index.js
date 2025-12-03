import { stateMachine_data, meta as stateMachineDataMeta } from './stateMachine_data/index.js';

export function has_data_state({ g, diagnostics }) {
  return {
    stateMachine_data: stateMachine_data({ g, diagnostics }),
  };
}

export const meta = {
  stateMachine_data: stateMachineDataMeta,
}
