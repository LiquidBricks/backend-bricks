import { GraphQLObjectType, GraphQLSchema, } from 'graphql';
import { componentSpecCreateInstanceField, componentInstanceStartField, componentInstanceProvideDataField } from './mutation/component.js'
import { clientLogField } from './mutation/logging.js'
import { graphEdgeLabelsField, graphVertexLabelsField, graphVertexPropertyKeysField, graphEdgePropertyKeysField } from './query/general.js';
import { query as componentQuery } from './query/component/index.js';
import { query as componentInstanceQuery } from './query/componentInstance/index.js';

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      ...componentQuery,
      ...componentInstanceQuery,

      graphVertexLabels: graphVertexLabelsField,
      graphEdgeLabels: graphEdgeLabelsField,
      graphVertexPropertyKeys: graphVertexPropertyKeysField,
      graphEdgePropertyKeys: graphEdgePropertyKeysField,
    }),
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: () => ({
      componentSpecCreateInstance: componentSpecCreateInstanceField,
      componentInstanceStart: componentInstanceStartField,
      componentInstanceProvideData: componentInstanceProvideDataField,
      clientLog: clientLogField,
    }),
  }),
});
