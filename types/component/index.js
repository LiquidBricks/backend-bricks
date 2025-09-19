import assert from 'node:assert'
import { getBucket } from "../shared.js";
import { task } from './task/index.js'
import { data as dataNode } from './data/index.js'

const TYPE = 'component';

const bucket = () => getBucket(TYPE);

const outEdges = ['has_task', 'has_data'];

const keyFor = {
  component: (cid) => `node.${TYPE}.${cid}`,
  hasTask: (cid, tid) => `edge.${TYPE}.${cid}.has_task.task.${tid}`,
  hasData: (cid, did) => `edge.${TYPE}.${cid}.has_data.data.${did}`,
}


export const component = (() => {
  const api = {
    async deRegister(hash) {
      return bucket()
        .then(bkt => Promise.all([
          bkt.delete(keyFor.component(hash)),
        ]))
    },
    async register(comp) {
      await api.deRegister(comp.hash)

      const k = comp.hash;
      const v = JSON.stringify(comp);
      await bucket()
        .then(bkt => bkt.update(keyFor.component(k), v))
        .catch(err => {
          assert(false, 'Failed to save component registration');
        });

      await materializeNodesAndEdges(comp)
      return comp.hash
    },
    async list() {
      const b = await bucket();
      const keys = await b.keys(`node.${TYPE}.*`).then(Array.fromAsync);
      const rows = await Promise.all(
        keys.map(k => b.get(k).then(e => e.json()).catch(() => null))
      );
      return rows.filter(Boolean);
    },
    V(componentID) {
      return {
        async get() {
          return bucket()
            .then(bkt => bkt.get(keyFor.component(componentID)))
            .then(comp => comp.json())
        },
        out(edgeName) {
          assert(outEdges.includes(edgeName), `Edge ${edgeName} not supported`)
          return {
            async list() {
              const b = await bucket();
              if (edgeName === 'has_task') {
                const pattern = `edge.${TYPE}.${componentID}.has_task.task.*`;
                const keys = await b.keys(pattern).then(Array.fromAsync).catch(() => []);
                return keys.map(k => k.split('.').pop());
              }
              if (edgeName === 'has_data') {
                const pattern = `edge.${TYPE}.${componentID}.has_data.data.*`;
                const keys = await b.keys(pattern).then(Array.fromAsync).catch(() => []);
                return keys.map(k => k.split('.').pop());
              }
            }
          }
        },
        async addE(edgeName, toVertexID, data = {}) {
          assert(outEdges.includes(edgeName), `Edge ${edgeName} not supported`);
          const b = await bucket();
          if (edgeName === 'has_task') {
            const k = keyFor.hasTask(componentID, toVertexID);
            const v = JSON.stringify({ componentID, taskID: toVertexID, data });
            await b
              .create(k, v)
              .catch(err => {
                assert(err.code === 10071, `Failed to add task:${toVertexID} to component:${componentID}`);// 10071 = key exists;
              });
          }
          if (edgeName === 'has_data') {
            const k = keyFor.hasData(componentID, toVertexID);
            const v = JSON.stringify({ componentID, dataID: toVertexID, data });
            await b
              .create(k, v)
              .catch(err => {
                assert(err.code === 10071, `Failed to add data:${toVertexID} to component:${componentID}`);// 10071 = key exists;
              });
          }
        },
      }
    },
  }
  return api
})()


async function materializeNodesAndEdges(comp) {
  const cid = comp.hash;
  const tasks = Array.isArray(comp.tasks) ? comp.tasks : [];
  const dataNodes = Array.isArray(comp.data) ? comp.data : [];

  // Optional: best-effort cleanup of prior edges for idempotency
  try {
    const b = await bucket();
    const patterns = [
      `edge.${TYPE}.${cid}.has_task.task.*`,
      `edge.${TYPE}.${cid}.has_data.data.*`,
    ];
    for (const pattern of patterns) {
      const keys = await b.keys(pattern).then(Array.fromAsync).catch(() => []);
      for (const k of keys) {
        try { await b.delete(k) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  // Create nodes and edges based on current registration payload
  for (const t of tasks) {
    const name = t?.name;
    if (!name) continue;
    await task.create({ componentID: cid, name, deps: t.deps || [], fnc: t.fnc });
  }
  for (const d of dataNodes) {
    const name = d?.name;
    if (!name) continue;
    await dataNode.create({ componentID: cid, name, deps: d.deps || [], fnc: d.fnc });
  }
}
