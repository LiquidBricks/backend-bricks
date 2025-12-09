import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { field as codeRef } from './codeRef.js'
import { domain } from '../../../domain/index.js'
import { fetchVertexProp, getStateField, resolveNodeId } from './nodeHelpers.js'



export const componentSpecTaskNodeType = new GraphQLObjectType({
  name: 'ComponentSpecTaskNode',
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
  }),
});



const { connectionType: ComponentSpecTaskConnection } = createConnectionType('ComponentSpecTask', componentSpecTaskNodeType)

export const field = {
  type: new GraphQLNonNull(ComponentSpecTaskConnection),
  resolve: async (id, _args, { g }) => toConnection(
    await g.V(id).out(domain.edge.has_task.component_task.constants.LABEL).id(),
  ),
}
