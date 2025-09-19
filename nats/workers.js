import { Worker } from "node:worker_threads"
import path from 'node:path';

export async function createWorkers(opts = {}) {
  const {
    workerFile = new URL("../executor/component.worker.js", import.meta.url),
    workersCount = 1,
    componentIds = [],
    directory = path.join(import.meta.dirname, `../flows`),
    NATS_IP,
    consumerGroup,
  } = opts

  let workers = Array.from({ length: workersCount }).map((_, workerIndex) =>
    new Worker(workerFile, {
      workerData: {
        workerIndex,
        NATS_IP,
        componentIds,
        directory,
        consumerGroup,
      }
    }))
}
