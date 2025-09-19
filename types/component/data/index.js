import assert from 'node:assert'
import { getBucket } from "../../shared.js";
import { component } from "../index.js";
import { ulid } from 'ulid';

const TYPE = 'data';
const bucket = () => getBucket(TYPE);

const keyFor = { data: (id) => `node.${TYPE}.${id}` };

export const data = (() => {
  const api = {
    async create({ componentID, name, deps = [], fnc }) {
      assert(typeof componentID === 'string' && componentID.length, 'componentID required');
      assert(typeof name === 'string' && name.length, 'name required');

      const id = ulid();
      const k = keyFor.data(id);
      const v = JSON.stringify({ id, name, componentID, deps, fnc });
      await bucket()
        .then(bkt => bkt.create(k, v))
        .catch(err => {
          assert(false, `Failed to create ${TYPE} ${id}`);
        })
        .then(() => component.V(componentID).addE('has_data', id, {}))
      return { id, name, componentID };
    },
    async list(componentID) {
      const ids = await component.V(componentID).out('has_data').list();
      const b = await bucket();
      const rows = await Promise.all(ids.map(async (id) => {
        try { const e = await b.get(keyFor.data(id)); return await e.json() } catch { return null }
      }));
      return rows.filter(Boolean);
    },
    V(id) {
      return {
        async get() {
          return bucket()
            .then(bkt => bkt.get(keyFor.data(id)))
            .then(data => data.json())
        },
      };
    },
  };
  return api;
})();
