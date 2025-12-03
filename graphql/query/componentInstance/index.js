import { GraphQLInt, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import assert from 'node:assert'
import { componentSpecType } from '../component/index.js'
import { componentSpecDataNodeType } from '../component/data.js'
import { fetchVertexProp, resolveNodeId } from '../component/nodeHelpers.js'
import { domain } from '../../../domain/index.js'



const { connectionType: ComponentSpecInstanceNodeConnection } = createConnectionType(
  'ComponentSpecInstanceNode',
  componentSpecDataNodeType,
)

export const componentSpecInstanceImportType = new GraphQLObjectType({
  name: 'ComponentSpecInstanceImport',
  fields: () => ({
    alias: {
      type: GraphQLString,
      resolve: (source) => source?.alias ?? null,
    },
    instanceId: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'instanceId', g),
    },
    createdAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'createdAt', g),
    },
    updatedAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'updatedAt', g),
    },
    componentSpec: {
      type: componentSpecType,
      resolve: async (source, _args, { g }) => {
        const nodeId = resolveNodeId(source);
        if (!nodeId) return null;
        return (await g.V(nodeId).out(domain.edge.instance_of.componentInstance_component.constants.LABEL).id()).shift();
      },
    },
    state: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchInstanceState(resolveNodeId(source), g),
    },
  }),
});

const { connectionType: ComponentSpecInstanceImportConnection } = createConnectionType(
  'ComponentSpecInstanceImport',
  componentSpecInstanceImportType,
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
      resolve: async (id, _args, { g }) => (await g.V(id).out(domain.edge.instance_of.componentInstance_component.constants.LABEL).id()).shift()
    },
    state: {
      type: GraphQLString,
      resolve: async (id, _args, { g }) => fetchInstanceState(id, g),
    },
    data: {
      type: new GraphQLNonNull(ComponentSpecInstanceNodeConnection),
      resolve: async (id, _args, { g }) => {
        const nodes = await loadInstanceStateNodes({
          g,
          instanceId: id,
          edgeLabel: domain.edge.has_data_state.stateMachine_data.constants.LABEL,
        });
        return toConnection(nodes);
      },
    },
    tasks: {
      type: new GraphQLNonNull(ComponentSpecInstanceNodeConnection),
      resolve: async (id, _args, { g }) => {
        const nodes = await loadInstanceStateNodes({
          g,
          instanceId: id,
          edgeLabel: domain.edge.has_task_state.stateMachine_task.constants.LABEL,
        });
        return toConnection(nodes);
      },
    },
    imports: {
      type: new GraphQLNonNull(ComponentSpecInstanceImportConnection),
      resolve: async (id, _args, { g }) => {
        const nodes = await loadInstanceImports({ g, instanceId: id });
        return toConnection(nodes);
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
    return g.V().has('label', domain.vertex.componentInstance.constants.LABEL).has('instanceId', instanceId).id()
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
    let ids = await g.V().has('label', domain.vertex.componentInstance.constants.LABEL).id()

    return toConnection(ids, paginationArgs)
  },
}

export const query = {
  componentSpecInstances: componentSpecInstancesField,
  componentSpecInstance: componentSpecInstanceField,
}

function unwrapValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value[0] ?? null : null;
  }
  return value ?? null;
}

async function loadInstanceStateNodes({ g, instanceId, edgeLabel }) {
  const [stateMachineId] = await g
    .V(instanceId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id();

  const edgeIds = await g.V(stateMachineId).outE(edgeLabel).id();
  const nodes = await Promise.all(
    edgeIds.map(async (edgeId) => {
      const propsSnapshot = await g.E(edgeId).valueMap('status', 'result', 'createdAt', 'updatedAt');
      const props = Array.isArray(propsSnapshot) ? propsSnapshot[0] : null;
      const [nodeId] = await g.E(edgeId).inV().id();
      if (!nodeId) return null;
      return {
        id: nodeId,
        nodeId,
        stateId: nodeId,
        status: unwrapValue(props?.status),
        result: unwrapValue(props?.result),
        stateEdgeId: edgeId,
        stateCreatedAt: unwrapValue(props?.createdAt),
        stateUpdatedAt: unwrapValue(props?.updatedAt),
      };
    }),
  );

  return nodes.filter(Boolean);
}

async function loadInstanceImports({ g, instanceId }) {
  if (!g || !instanceId) return [];
  const edgeIds = await g
    .V(instanceId)
    .outE(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
    .id();

  const nodes = await Promise.all(
    edgeIds.map(async (edgeId) => {
      const [edgePropsSnapshot] = await g.E(edgeId).valueMap('alias');
      const edgeProps = Array.isArray(edgePropsSnapshot) ? edgePropsSnapshot[0] : null;
      const [importedInstanceId] = await g.E(edgeId).inV().id();
      if (!importedInstanceId) return null;
      return {
        nodeId: importedInstanceId,
        alias: unwrapValue(edgeProps?.alias ?? edgeProps),
      };
    }),
  );

  return nodes.filter(Boolean);
}

async function fetchInstanceState(instanceId, g) {
  if (!instanceId || !g) return null;
  const [stateMachineId] = await g
    .V(instanceId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id();
  if (!stateMachineId) return null;
  const rows = await g.V(stateMachineId).valueMap('state');
  const first = Array.isArray(rows) ? rows[0] : null;
  return unwrapValue(first?.state);
}
