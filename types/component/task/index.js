import assert from 'node:assert'
import { getBucket } from "../../shared.js";
import { component } from "../index.js";
import { ulid } from 'ulid';

const TYPE = 'task';
const bucket = () => getBucket(TYPE);

const keyFor = {
  task: (id) => `node.${TYPE}.${id}`,
};

export const task = (() => {
  const api = {
    async create({ componentID, name, deps = [], fnc }) {
      assert(typeof componentID === 'string' && componentID.length, 'componentID required');
      assert(typeof name === 'string' && name.length, 'name required');

      const id = ulid();
      const k = keyFor.task(id);
      const v = JSON.stringify({ id, name, componentID, deps, fnc });
      await bucket()
        .then(bkt => bkt.create(k, v))
        .catch(err => {
          assert(false, `Failed to create ${TYPE} ${id}`);
        })
        .then(() => component.V(componentID).addE('has_task', id, {}))
      return { id, name, componentID };
    },
    async list(componentID) {
      const ids = await component.V(componentID).out('has_task').list();
      const b = await bucket();
      const rows = await Promise.all(ids.map(async (id) => {
        try { const e = await b.get(keyFor.task(id)); return await e.json() } catch { return null }
      }));
      return rows.filter(Boolean);
    },
    V(id) {
      return {
        async get() {
          return bucket()
            .then(bkt => bkt.get(keyFor.task(id)))
            .then(task => task.json())
        },
      };
    },
  };
  return api;
})();
