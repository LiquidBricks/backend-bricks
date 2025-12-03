import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { createConnectionType, toConnection } from '../../common/relay.js'
import { domain } from '../../../domain/index.js'
import { fetchVertexProp } from './nodeHelpers.js'

function unwrap(value) {
  if (Array.isArray(value)) {
    return value.length ? value[0] ?? null : null
  }
  return value ?? null
}


export const componentSpecImportNodeType = new GraphQLObjectType({
  name: 'ComponentSpecImportNode',
  fields: () => ({
    createdAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'createdAt', g),
    },
    updatedAt: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'updatedAt', g),
    },
    alias: {
      type: GraphQLString,
      resolve: (source) => unwrap(source?.alias),
    },
    name: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'name', g),
    },
    hash: {
      type: GraphQLString,
      resolve: async (source, _args, { g }) => fetchVertexProp(source, 'hash', g),
    },
  }),
});



const { connectionType: ComponentSpecImportsConnection } = createConnectionType('ComponentSpecImports', componentSpecImportNodeType)

export const field = {
  type: new GraphQLNonNull(ComponentSpecImportsConnection),
  resolve: async (id, _args, { g }) => {
    const edgeIds = await g.V(id).outE(domain.edge.has_import.component_component.constants.LABEL).id()
    const imports = await Promise.all(
      edgeIds.map(async (edgeId) => {
        const propsSnapshot = await g.E(edgeId).valueMap('alias')
        const props = Array.isArray(propsSnapshot) ? propsSnapshot[0] : null
        const [componentId] = await g.E(edgeId).inV().id()
        if (!componentId) return null
        return {
          id: componentId,
          alias: unwrap(props?.alias),
        }
      }),
    )
    return toConnection(imports.filter(Boolean))
  },
}
