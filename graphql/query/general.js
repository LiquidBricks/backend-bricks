import { GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";

export const graphVertexLabelsField = {
  type: new GraphQLList(GraphQLString),
  resolve: async (_src, _args, { g }) => {
    try {
      const res = await g.V().valueMap('label');
      const labels = (res || []).map(r => Array.isArray(r?.label) ? r.label[0] : r?.label).filter(Boolean);
      return Array.from(new Set(labels));
    } catch (e) {
      return [];
    }
  }
}
export const graphEdgeLabelsField = {
  type: new GraphQLList(GraphQLString),
  resolve: async (_src, _args, { g }) => {
    try {
      const res = await g.E().valueMap('label');
      const labels = (res || []).map(r => Array.isArray(r?.label) ? r.label[0] : r?.label).filter(Boolean);
      return Array.from(new Set(labels));
    } catch (e) {
      return [];
    }
  }
}

// Return unique property keys present on vertices with a given label
export const graphVertexPropertyKeysField = {
  type: new GraphQLList(GraphQLString),
  args: {
    label: { type: new GraphQLNonNull(GraphQLString) },
  },
  resolve: async (_src, { label }, { g }) => {
    try {
      // Query vertices by label, then pull their property maps
      const rows = await g.V().has('label', label).valueMap();
      const keys = new Set();
      for (const row of rows || []) {
        for (const k of Object.keys(row || {})) {
          if (k === 'label' || k === 'id') continue;
          keys.add(k);
        }
      }
      return Array.from(keys).sort();
    } catch (e) {
      return [];
    }
  }
}

// Return unique property keys present on edges with a given label
export const graphEdgePropertyKeysField = {
  type: new GraphQLList(GraphQLString),
  args: {
    label: { type: new GraphQLNonNull(GraphQLString) },
  },
  resolve: async (_src, { label }, { g }) => {
    try {
      const rows = await g.E().has('label', label).valueMap();
      const keys = new Set();
      for (const row of rows || []) {
        for (const k of Object.keys(row || {})) {
          if (k === 'label' || k === 'id' || k === 'inV' || k === 'outV') continue;
          keys.add(k);
        }
      }
      return Array.from(keys).sort();
    } catch (e) {
      return [];
    }
  }
}
