import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'

export const componentSpecDeferredNodeType = new GraphQLObjectType({
  name: 'ComponentSpecDeferredNodeType',
  fields: () => ({
    createdAt: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => (await g.V(id).valueMap('createdAt')).shift().createdAt,
    },
    updatedAt: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => (await g.V(id).valueMap('updatedAt')).shift().updatedAt,
    },
    name: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => (await g.V(id).valueMap('name')).shift().name,
    },
  }),
});

const { connectionType: ComponentSpecDeferredConnection } = createConnectionType('ComponentSpecDeferred', componentSpecDeferredNodeType)

export const field = {
  type: new GraphQLNonNull(ComponentSpecDeferredConnection),
  resolve: async (id, _args, { g }) => toConnection(
    await g.V(id).out('has_deferred').id(),
  ),
}
