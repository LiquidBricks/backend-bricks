import { GraphQLList, GraphQLString } from "graphql";

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
