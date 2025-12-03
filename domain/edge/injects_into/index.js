import { task_task, meta as taskTaskMeta } from './task_task/index.js';
import { task_data, meta as taskDataMeta } from './task_data/index.js';
import { data_task, meta as dataTaskMeta } from './data_task/index.js';
import { data_data, meta as dataDataMeta } from './data_data/index.js';

export function injects_into({ g, diagnostics }) {
  return {
    task_task: task_task({ g, diagnostics }),
    task_data: task_data({ g, diagnostics }),
    data_task: data_task({ g, diagnostics }),
    data_data: data_data({ g, diagnostics }),
  };
}

export const meta = {
  task_task: taskTaskMeta,
  task_data: taskDataMeta,
  data_task: dataTaskMeta,
  data_data: dataDataMeta,
}
