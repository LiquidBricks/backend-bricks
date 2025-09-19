import { GraphQLInt, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { component } from '../../../types/component/index.js'
import { data as dataType } from '../../../types/component/data/index.js'
import { task as taskType } from '../../../types/component/task/index.js'
import { createConnectionType, toConnection } from '../../common/relay.js'



const componentDataNodeType = new GraphQLObjectType({
  name: 'ComponentDataNode',
  fields: () => ({
    name: { type: GraphQLString },
    deps: { type: new GraphQLNonNull(ComponentDepsConnection) },
    fnc: { type: GraphQLString },
  }),
});

const componentTaskNodeType = new GraphQLObjectType({
  name: 'ComponentTaskNode',
  fields: () => ({
    name: { type: GraphQLString },
    deps: { type: new GraphQLNonNull(ComponentDepsConnection) },
    fnc: { type: GraphQLString },
  }),
});

const componentInternalType = new GraphQLObjectType({
  name: 'ComponentInternal',
  fields: () => ({
    name: { type: GraphQLString },
    hash: { type: GraphQLString },
    data: { type: new GraphQLNonNull(ComponentDataConnection) },
    tasks: { type: new GraphQLNonNull(ComponentTaskConnection) },
  }),
});

function normalizeNodeEntry({ name, fnc, deps }) {
  const depsArr = Array.isArray(deps) ? deps : Array.from(deps || []);
  return { name, deps: toConnection(depsArr), fnc };
}

export const componentField = {
  type: componentInternalType,
  args: {
    id: { type: GraphQLString },
  },
  resolve: async (_, { id }) => {
    const comp = await component.V(id).get();
    // Fetch nodes via task/data types; no adjacency
    const tNodes = await taskType.list(id).catch(() => []);
    const dNodes = await dataType.list(id).catch(() => []);
    return {
      ...comp,
      data: toConnection(dNodes.map(normalizeNodeEntry).filter(Boolean)),
      tasks: toConnection(tNodes.map(normalizeNodeEntry).filter(Boolean)),
    };
  },
}

const { connectionType: ComponentsConnection } = createConnectionType('Component', componentInternalType);
const { connectionType: ComponentDataConnection } = createConnectionType('ComponentData', componentDataNodeType);
const { connectionType: ComponentTaskConnection } = createConnectionType('ComponentTask', componentTaskNodeType);
const { connectionType: ComponentDepsConnection } = createConnectionType('ComponentDeps', GraphQLString);

export const componentsField = {
  type: new GraphQLNonNull(ComponentsConnection),
  args: {
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
  resolve: async (_, args) => {
    const rows = await component.list();
    const normalized = rows
      .filter(Boolean)
      .map(raw => ({
        ...raw,
        data: toConnection(Array.isArray(raw.data) ? raw.data.map(normalizeNodeEntry).filter(Boolean) : []),
        tasks: toConnection(Array.isArray(raw.tasks) ? raw.tasks.map(normalizeNodeEntry).filter(Boolean) : []),
      }));
    return toConnection(normalized, args);
  }
}
