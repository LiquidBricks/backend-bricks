import { component, meta as componentMeta } from './component/index.js';
import { task, meta as taskMeta } from './task/index.js';
import { data as dataVertex, meta as dataMeta } from './data/index.js';
import { deferred, meta as deferredMeta } from './deferred/index.js';
import { componentInstance, meta as componentInstanceMeta } from './componentInstance/index.js';
import { stateMachine, meta as stateMachineMeta } from './stateMachine/index.js';

export function vertex({ g, diagnostics }) {
  return {
    component: component({ g, diagnostics }),
    task: task({ g, diagnostics }),
    data: dataVertex({ g, diagnostics }),
    deferred: deferred({ g, diagnostics }),
    componentInstance: componentInstance({ g, diagnostics }),
    stateMachine: stateMachine({ g, diagnostics }),
  };
}
export const meta = {
  component: componentMeta,
  task: taskMeta,
  data: dataMeta,
  deferred: deferredMeta,
  componentInstance: componentInstanceMeta,
  stateMachine: stateMachineMeta,
}
