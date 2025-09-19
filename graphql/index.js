import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { componentField, componentsField } from './query/component/index.js'
import { sessionField } from './query/session/index.js'
import { componentMutationField } from './mutation/component.js'
import { sessionCreateField, sessionAddComponentField, sessionDeleteField } from './mutation/session.js'
import { sessionsField } from './query/session/index.js'

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      components: componentsField,
      component: componentField,
      session: sessionField,
      sessions: sessionsField,
    }),
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: () => ({
      component: componentMutationField,
      sessionCreate: sessionCreateField,
      sessionAddComponent: sessionAddComponentField,
      sessionDelete: sessionDeleteField,
    }),
  }),
});
