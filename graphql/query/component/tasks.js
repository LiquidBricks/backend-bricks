import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { field as codeRef } from './codeRef.js'



export const componentSpecTaskNodeType = new GraphQLObjectType({
  name: 'ComponentSpecTaskNode',
  fields: () => ({
    createdAt: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('createdAt');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.createdAt ?? null;
      },
    },
    updatedAt: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('updatedAt');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.updatedAt ?? null;
      },
    },
    name: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('name');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.name ?? null;
      },
    },
    fnc: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('fnc');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.fnc ?? null;
      },
    },
    codeRef,
  }),
});



const { connectionType: ComponentSpecTaskConnection } = createConnectionType('ComponentSpecTask', componentSpecTaskNodeType)

export const field = {
  type: new GraphQLNonNull(ComponentSpecTaskConnection),
  resolve: async (id, _args, { g }) => toConnection(
    await g.V(id).out('has_task').id(),
  ),
}
