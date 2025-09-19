// import { graph } from "../../nats/graph/graph.js";
import { getBucket } from "../shared.js";
import assert from 'node:assert'

const TYPE = 'session';

const bucket = () => getBucket(TYPE);

const outEdges = ['has_component'];

const keyFor = {
  session: (sid) => `node.${TYPE}.${sid}`,
  hasComponent: (sid, cid) => `edge.${TYPE}.${sid}.has_component.component.${cid}`,
}

export const session = (() => {
  let api = {
    async create({ id }) {
      // await graph()
      //   .addV(TYPE)
      //   .property('sessionID', id)

      return bucket()
        .then(bkt => bkt.create(keyFor.session(id), JSON.stringify({ id })))
        .catch(err => {
          assert(err.code === 10071, `Failed to create ${TYPE} ${id}`);// 10071 = key exists
        })
        .then(() => ({ id }))
    },
    async delete(id) {
      const b = await bucket();
      // Remove session node entry
      try { await b.delete(keyFor.session(id)) } catch { /* ignore if missing */ }
      // Remove all has_component edges for this session
      try {
        const pattern = `edge.${TYPE}.${id}.has_component.component.*`;
        const keys = await b.keys(pattern).then(Array.fromAsync).catch(() => []);
        for (const k of keys) {
          try { await b.delete(k) } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      return 'ok'
    },
    async list() {
      try {
        const bkt = await getBucket('graph')
        // await bkt.purgeBucket()
        // const abc = await graph()
        //   .V()
        //   .property('sessionID', 'asdf')
        //   .id()

        console.log({ abc })
      } catch (err) { console.log({ err }) }
















      const b = await bucket();
      const keys = await b.keys(`node.${TYPE}.*`).then(Array.fromAsync);
      const rows = await Promise.all(keys.map(k => b.get(k).then(e => e.json()).catch(() => null)));

      return rows.filter(Boolean);
    },
    V(sessionID) {
      return {
        async addE(edgeName, toVertexID, edgeData) {
          assert(outEdges.includes(edgeName), `Edge ${edgeName} not supported`)
          if (edgeName === 'has_component') {
            const componentID = toVertexID
            await bucket()
              .then(bkt => bkt.create(keyFor.hasComponent(sessionID, componentID), JSON.stringify({ sessionID, componentID })))
              .catch(err => {
                assert(err.code === 10071, `Failed to add component ${componentID} to session ${sessionID}`);// 10071 = key exists
              });
          }
        },
        out(edgeName) {
          assert(outEdges.includes(edgeName), `Edge ${edgeName} not supported`)
          if (edgeName === 'has_component') {
            return {
              async list() {
                const b = await bucket();
                const pattern = `edge.${TYPE}.${sessionID}.has_component.component.*`;
                const compKeys = await b.keys(pattern).then(Array.fromAsync).catch(() => []);
                return compKeys.map(k => k.split('.').pop());
              }
            }
          }
        }
      }
    },
  }
  return api
})()
