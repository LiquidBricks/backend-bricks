import { GraphQLInt, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { resolveNodeId } from './nodeHelpers.js'




const componentSpecCodeRefType = new GraphQLObjectType({
  name: 'ComponentSpecCodeRef',
  fields: () => ({
    file: { type: GraphQLString },
    line: { type: GraphQLInt },
    column: { type: GraphQLInt },
    functionName: { type: GraphQLString },
    vscodeUrl: {
      type: GraphQLString,
      resolve: ({ file, line, column }) => {
        if (!file) return null;
        const normalized = String(file).replace(/\\/g, '/');
        const safePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
        const parsedLine = line != null ? Number(line) : null;
        const parsedColumn = column != null ? Number(column) : null;
        const lineNumber = Number.isFinite(parsedLine) ? parsedLine : 1;
        const columnNumber = Number.isFinite(parsedColumn) ? parsedColumn : 1;
        return `vscode://file${safePath}:${lineNumber}:${columnNumber}`;
      },
    },
  }),
});


export const field = {
  type: componentSpecCodeRefType,
  resolve: async (source, _args, { g }) => {
    const nodeId = resolveNodeId(source);
    if (!nodeId) return null;
    const snapshot = await g.V(nodeId).valueMap('codeRef');
    const raw = Array.isArray(snapshot) ? snapshot[0]?.codeRef : null;
    if (!raw || typeof raw !== 'object') return null;
    const { file = null, line = null, column = null, functionName = null } = raw;
    const parsedLine = line != null ? Number(line) : null;
    const parsedColumn = column != null ? Number(column) : null;
    return {
      file: typeof file === 'string' ? file : null,
      line: Number.isFinite(parsedLine) ? parsedLine : null,
      column: Number.isFinite(parsedColumn) ? parsedColumn : null,
      functionName: typeof functionName === 'string' ? functionName : null,
    };
  },
}
