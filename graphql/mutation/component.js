import { GraphQLObjectType, GraphQLString } from 'graphql'
import { ulid } from 'ulid'

export const componentMutationField = {
  type: new GraphQLObjectType({
    name: 'ComponentMutation',
    fields: () => ({
      create: {
        type: GraphQLString,
        resolve: async ({ id }, _args, { natsConnection }) => {
          const runID = ulid()
          await natsConnection.client().then(c => c.publish(
            `componentService.command`,
            JSON.stringify({
              command: 'create',
              data: { id, runID }
            })
          ));
          return runID;
        }
      }
    })
  }),
  args: { id: { type: GraphQLString } },
  resolve: (_parent, { id }) => ({ id })
}

