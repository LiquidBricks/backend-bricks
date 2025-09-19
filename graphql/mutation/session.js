import { GraphQLObjectType, GraphQLString, GraphQLScalarType } from 'graphql'
import { ulid } from 'ulid'
import * as SessionService from '../../types/session/index.js'

const TypelessData = new GraphQLScalarType({
  name: 'TypelessData',
  description: 'Arbitrary JSON-like data',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => ast.value,
});

export const sessionCreateField = {
  type: GraphQLString, // returns sessionID
  resolve: async (_parent, _args, { natsConnection }) => {
    const id = ulid();
    await natsConnection.client().then(c => c.publish(
      `sessionService.command`,
      JSON.stringify({
        command: 'create',
        data: { id }
      })
    ));
    return id;
  }
}

export const sessionAddComponentField = {
  type: GraphQLString, // returns 'ok'
  args: {
    sessionId: { type: GraphQLString },
    componentId: { type: GraphQLString }
  },
  resolve: async (_parent, { sessionId, componentId }, { natsConnection }) => {
    await natsConnection.client().then(c => c.publish(
      `sessionService.command`,
      JSON.stringify({
        command: 'addComponent',
        data: { sessionID: sessionId, componentID: componentId }
      })
    ));
    return 'ok';
  }
}

export const sessionDeleteField = {
  type: GraphQLString, // returns 'ok'
  args: {
    sessionId: { type: GraphQLString },
  },
  resolve: async (_parent, { sessionId }) => {
    await SessionService.session.delete(sessionId);
    return 'ok';
  }
}
