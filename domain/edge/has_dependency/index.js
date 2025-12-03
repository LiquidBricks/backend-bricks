import { task_task, meta as taskTaskMeta } from './task_task/index.js';
import { task_data, meta as taskDataMeta } from './task_data/index.js';
import { task_deferred, meta as taskDeferredMeta } from './task_deferred/index.js';
import { data_task, meta as dataTaskMeta } from './data_task/index.js';
import { data_data, meta as dataDataMeta } from './data_data/index.js';
import { data_deferred, meta as dataDeferredMeta } from './data_deferred/index.js';

export function has_dependency({ g, diagnostics }) {
  return {
    task_task: task_task({ g, diagnostics }),
    task_data: task_data({ g, diagnostics }),
    task_deferred: task_deferred({ g, diagnostics }),
    data_task: data_task({ g, diagnostics }),
    data_data: data_data({ g, diagnostics }),
    data_deferred: data_deferred({ g, diagnostics }),
  };
}

export const meta = {
  task_task: taskTaskMeta,
  task_data: taskDataMeta,
  task_deferred: taskDeferredMeta,
  data_task: dataTaskMeta,
  data_data: dataDataMeta,
  data_deferred: dataDeferredMeta,
}
