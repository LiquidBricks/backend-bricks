import { GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import * as SessionService from '../../../types/session/index.js'
import { createConnectionType, toConnection } from '../../common/relay.js'

export const sessionType = new GraphQLObjectType({
  name: 'Session',
  fields: () => ({
    id: { type: GraphQLString },
    components: {
      type: new GraphQLNonNull(SessionComponentsConnection),
      args: {
        first: { type: GraphQLInt },
        after: { type: GraphQLString },
      },
      resolve: async (parent, args) => {
        const ids = await SessionService.session.V(parent.id).out('has_component').list();
        return toConnection(ids, args);
      }
    },
  })
});

export const sessionField = {
  type: sessionType,
  args: { id: { type: GraphQLString } },
  resolve: async (_, { id }) => {
    return { id }
  }
}

const { connectionType: SessionsConnection } = createConnectionType('Session', sessionType);
const { connectionType: SessionComponentsConnection } = createConnectionType('SessionComponents', GraphQLString);

export const sessionsField = {
  type: new GraphQLNonNull(SessionsConnection),
  args: {
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
  resolve: async (_, args) => {
    const rows = await SessionService.session.list();
    return toConnection(rows, args);
  }
}
