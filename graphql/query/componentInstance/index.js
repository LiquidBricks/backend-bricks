import { GraphQLInt, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import assert from 'node:assert'
import { componentSpecType } from '../component/index.js'
import { componentSpecDataNodeType } from '../component/data.js'



const { connectionType: ComponentSpecInstanceNodeConnection } = createConnectionType(
  'ComponentSpecInstanceNode',
  componentSpecDataNodeType,
)

export const componentSpecInstanceType = new GraphQLObjectType({
  name: 'ComponentSpecInstance',
  fields: () => ({
    instanceId: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => {
        const rows = await g.V(id).valueMap('instanceId');
        const first = Array.isArray(rows) ? rows[0] : null;
        return first?.instanceId ?? null;
      },
    },
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
    componentSpec: {
      type: componentSpecType,
      resolve: async (id, _args, { g }) => (await g.V(id).out('instance_of').id()).shift()
    },
    data: {
      type: new GraphQLNonNull(ComponentSpecInstanceNodeConnection),
      resolve: async (id, _args, { g }) => {
        // Return the target data nodes for this instance's data state edges
        const nodeIds = await g.V(id).out('has_data_state').id();
        return toConnection(nodeIds);
      },
    },
    tasks: {
      type: new GraphQLNonNull(ComponentSpecInstanceNodeConnection),
      resolve: async (id, _args, { g }) => {
        // Return the target task nodes for this instance's task state edges
        const nodeIds = await g.V(id).out('has_task_state').id();
        return toConnection(nodeIds);
      },
    },
  }),
})

export const componentSpecInstanceField = {
  type: componentSpecInstanceType,
  args: {
    instanceId: { type: GraphQLString },
  },
  resolve: async (_src, { instanceId }, { g }) => {
    assert(instanceId, 'Must provide instanceId')
    return g.V().has('label', 'componentInstance').has('instanceId', instanceId).id()
  },
}

const { connectionType: ComponentSpecInstanceConnection } = createConnectionType(
  'ComponentSpecInstance',
  componentSpecInstanceType,
)
export const componentSpecInstancesField = {
  type: new GraphQLNonNull(ComponentSpecInstanceConnection),
  args: {
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
  resolve: async (_src, { ...paginationArgs } = {}, { g }) => {
    let ids = await g.V().has('label', 'componentInstance').id()

    return toConnection(ids, paginationArgs)
  },
}

export const query = {
  componentSpecInstances: componentSpecInstancesField,
  componentSpecInstance: componentSpecInstanceField,
}
