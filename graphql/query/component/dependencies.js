import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { resolveNodeId } from './nodeHelpers.js'


const { connectionType: ComponentSpecDepsConnection } = createConnectionType('ComponentSpecDeps', GraphQLString)

export const componentSpecDependencyType = new GraphQLObjectType({
  name: 'ComponentSpecDependencyType',
  fields: () => ({
    task: {
      type: GraphQLString,
      resolve: async (_id) => {
        // Placeholder: no direct scalar value; avoid throwing
        return null;
      },
    },
    data: {
      type: GraphQLString,
      resolve: async (_id) => {
        // Placeholder: no direct scalar value; avoid throwing
        return null;
      },
    },
    deferred: {
      type: GraphQLString,
      resolve: async (_id) => {
        // Placeholder: no direct scalar value; avoid throwing
        return null;
      },
    },
  }),
});

export const field = {
  type: new GraphQLNonNull(componentSpecDependencyType),
  resolve: async (source) => resolveNodeId(source),
}
