import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { field as codeRef } from './codeRef.js'
import { field as dependencies } from './dependencies.js'
import { domain } from '../../../domain/index.js'
import { fetchVertexProp, getStateField, resolveNodeId } from './nodeHelpers.js'



export const componentSpecDataNodeType = new GraphQLObjectType({
  name: 'ComponentSpecDataNodeType',
  fields: () => ({
    createdAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'createdAt', g),
    },
    updatedAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'updatedAt', g),
    },
    name: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'name', g),
    },
    fnc: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'fnc', g),
    },
    stateId: {
      type: GraphQLString,
      resolve: (source) => getStateField(source, 'stateId') ?? resolveNodeId(source),
    },
    status: {
      type: GraphQLString,
      resolve: (source) => getStateField(source, 'status'),
    },
    result: {
      type: GraphQLString,
      resolve: (source) => getStateField(source, 'result'),
    },
    codeRef,
    dependencies,
  }),
});

const { connectionType: ComponentSpecDataConnection } = createConnectionType('ComponentSpecData', componentSpecDataNodeType)

export const field = {
  type: new GraphQLNonNull(ComponentSpecDataConnection),
  resolve: async (id, _args, { g }) => toConnection(
    await g.V(id).out(domain.edge.has_data.component_data.constants.LABEL).id(),
  ),
}
