import { GraphQLInt, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { domain } from '../../../domain/index.js'
import { field as data } from './data.js';
import { field as tasks } from './tasks.js';
import { field as deferred } from './deferred.js';
import { field as imports } from './imports.js';

export const componentSpecType = new GraphQLObjectType({
  name: 'ComponentSpec',
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
      }
    },
    hash: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('hash');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.hash ?? null;
      }
    },
    data,
    tasks,
    deferred,
    imports,
  }),
});

export const componentSpecField = {
  type: componentSpecType,
  args: {
    hash: { type: GraphQLString },
  },
  resolve: async (_src, { hash }, { g }) => {
    return (await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', hash).id()).shift()
  },
}


const { connectionType: ComponentSpecsConnection } = createConnectionType('ComponentSpec', componentSpecType)

export const componentSpecsField = {
  type: new GraphQLNonNull(ComponentSpecsConnection),
  args: {
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
  resolve: async (_src, args, { g }) => toConnection(
    await g.V().has('label', domain.vertex.component.constants.LABEL).id(),
    args,
  )
}

export const query = {
  componentSpecs: componentSpecsField,
  componentSpec: componentSpecField
}
