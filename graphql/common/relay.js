import { GraphQLBoolean, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'

export const PageInfoType = new GraphQLObjectType({
  name: 'PageInfo',
  fields: () => ({
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
    hasPreviousPage: { type: new GraphQLNonNull(GraphQLBoolean) },
    startCursor: { type: GraphQLString },
    endCursor: { type: GraphQLString },
  }),
});

export function createEdgeType(name, nodeType, edgeFields = {}) {
  return new GraphQLObjectType({
    name: `${name}Edge`,
    fields: () => ({
      node: { type: new GraphQLNonNull(nodeType) },
      cursor: { type: new GraphQLNonNull(GraphQLString) },
      ...edgeFields,
    }),
  });
}

export function createConnectionType(name, nodeType, edgeFields = {}) {
  const edgeType = createEdgeType(name, nodeType, edgeFields);
  const connectionType = new GraphQLObjectType({
    name: `${name}Connection`,
    fields: () => ({
      edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(edgeType))) },
      pageInfo: { type: new GraphQLNonNull(PageInfoType) },
      totalCount: { type: new GraphQLNonNull(GraphQLInt) },
    }),
  });
  return { edgeType, connectionType };
}

// Basic in-memory array pagination using opaque base64 index cursors
export function toConnection(items, args = {}) {
  const encode = (i) => Buffer.from(String(i), 'utf8').toString('base64');
  const decode = (c) => (c ? parseInt(Buffer.from(c, 'base64').toString('utf8'), 10) : NaN);

  const totalCount = Array.isArray(items) ? items.length : 0;
  if (totalCount === 0) {
    return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }, totalCount };
  }

  const { first, after } = args;
  const afterIndex = Number.isFinite(decode(after)) ? decode(after) : -1;

  const start = Math.max(afterIndex + 1, 0);
  const endExclusive = Number.isInteger(first) && first > 0 ? Math.min(start + first, totalCount) : totalCount;

  const slice = items.slice(start, endExclusive);
  const edges = slice.map((node, i) => ({ node, cursor: encode(start + i) }));

  const startCursor = edges.length ? edges[0].cursor : null;
  const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

  const hasNextPage = endExclusive < totalCount;
  const hasPreviousPage = start > 0;

  return { edges, pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor }, totalCount };
}

