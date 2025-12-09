import { has_data_state, meta as hasDataStateMeta } from './has_data_state/index.js';
import { has_task_state, meta as hasTaskStateMeta } from './has_task_state/index.js';
import { has_task, meta as hasTaskMeta } from './has_task/index.js';
import { has_data, meta as hasDataMeta } from './has_data/index.js';
import { has_deferred, meta as hasDeferredMeta } from './has_deferred/index.js';
import { instance_of, meta as instanceOfMeta } from './instance_of/index.js';
import { has_dependency, meta as hasDependencyMeta } from './has_dependency/index.js';
import { has_stateMachine, meta as hasStateMachineMeta } from './has_stateMachine/index.js';
import { has_import, meta as hasImportMeta } from './has_import/index.js';
import { uses_import, meta as usesImportMeta } from './uses_import/index.js';
import { injects_into, meta as injectsIntoMeta } from './injects_into/index.js';

export function edge({ g, diagnostics }) {
  return {
    has_data_state: has_data_state({ g, diagnostics }),
    has_task_state: has_task_state({ g, diagnostics }),
    has_task: has_task({ g, diagnostics }),
    has_data: has_data({ g, diagnostics }),
    has_deferred: has_deferred({ g, diagnostics }),
    instance_of: instance_of({ g, diagnostics }),
    has_dependency: has_dependency({ g, diagnostics }),
    has_stateMachine: has_stateMachine({ g, diagnostics }),
    has_import: has_import({ g, diagnostics }),
    uses_import: uses_import({ g, diagnostics }),
    injects_into: injects_into({ g, diagnostics }),
  };
}

export const meta = {
  has_data_state: hasDataStateMeta,
  has_task_state: hasTaskStateMeta,
  has_task: hasTaskMeta,
  has_data: hasDataMeta,
  has_deferred: hasDeferredMeta,
  instance_of: instanceOfMeta,
  has_dependency: hasDependencyMeta,
  has_stateMachine: hasStateMachineMeta,
  has_import: hasImportMeta,
  uses_import: usesImportMeta,
  injects_into: injectsIntoMeta,
}
