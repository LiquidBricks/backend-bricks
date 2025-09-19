import { streamName } from "../nats/config.js";
import { parentPort, workerData } from "node:worker_threads"
import { AckPolicy, DeliverPolicy } from "@nats-io/jetstream";
import { connection } from "../natsConnection.js";
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { s } from '../builder/help.js';
import assert from 'node:assert';


const {
  workerIndex,
  NATS_IP,
  componentIds,
  directory,
  consumerGroup,
} = workerData;

async function discoverFlowFiles(rootDir) {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.comp.js')) continue;

      files.push(full);
    }
  }

  await walk(rootDir);
  return files;
}

async function loadRequestedFlows(rootDir, ids) {
  const files = await discoverFlowFiles(rootDir);
  const byName = new Map();
  const byHash = new Map();
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    assert(('default' in mod), `Flow file ${file} must have a default export (component or array of components)`);
    const def = mod.default;
    const list = Array.isArray(def) ? def : [def];
    for (const comp of list) {
      assert(comp?.[s.IDENTITY.COMPONENT], `Flow file ${file} default export contains a non-component item`);
      const name = comp[s.INTERNALS].name;
      assert(!byName.has(name), `Duplicate component name detected: "${name}"`);
      byName.set(name, comp);
      const h = comp.hash();
      assert(!byHash.has(h), `Duplicate component hash detected: "${h}"`);
      byHash.set(h, comp);
    }
  }
  console.log(`Discovered ${byName.size} components under ${rootDir}`, byHash.keys(), byName.keys());

  const result = {};
  for (const id of ids) {
    const key = String(id);
    const comp = byHash.get(key) || byName.get(key);
    assert(comp, `Flow id "${id}" not found among discovered components under ${rootDir}`);
    result[id] = comp;
  }
  return result;
}

const components = await loadRequestedFlows(directory, componentIds);

parentPort.on('message', async (message) => {
  console.log(`worker(${workerIndex}).js: got message, `, { message })
  // parentPort.postMessage({ taskID, result });
});


const client = await connection.client(NATS_IP);
const jetstream = await connection.jetstream();
const jetstreamManager = await connection.jetstreamManager()

// publish registration for each loaded component over NATS
for (const comp of Object.values(components)) {
  try {
    const name = comp[s.INTERNALS].name;
    const hash = comp.hash();
    const dataNodes = Array.from(comp[s.INTERNALS].nodes.data.entries())
      .map(([n, { deps = [], fnc }]) => ({ name: n, deps: Array.from(deps), fnc: String(fnc) }));
    const taskNodes = Array.from(comp[s.INTERNALS].nodes.tasks.entries())
      .map(([n, { deps = [], fnc }]) => ({ name: n, deps: Array.from(deps), fnc: String(fnc) }));
    const payload = {
      command: 'register',
      data: {
        name,
        hash,
        data: dataNodes,
        tasks: taskNodes,
      }
    };

    client.publish(`componentService.command`, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to publish component registration:', e);
  }
}

await jetstreamManager.consumers.add(streamName, {
  durable_name: consumerGroup,
  ack_policy: AckPolicy.Explicit,
  deliver_policy: DeliverPolicy.All,
  filter_subjects: componentIds.map(id => `componentNode.${id}.command`),
});
const c = await jetstream.consumers.get(streamName, consumerGroup);
const iter = await c.consume();


new Promise(async (res) => {
  for await (const m of iter) {
    const flowID = m.subject.split(".")[1]
    console.log({ workerIndex, flowID })
    components[flowID];
  }
})
