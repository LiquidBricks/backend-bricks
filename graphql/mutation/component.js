import { GraphQLBoolean, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { ulid } from 'ulid'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'

const componentSpecCreateInstancePayloadType = new GraphQLObjectType({
  name: 'ComponentSpecCreateInstancePayload',
  fields: () => ({
    instanceId: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

export const componentSpecCreateInstanceField = {
  type: new GraphQLNonNull(componentSpecCreateInstancePayloadType),
  args: {
    componentHash: { type: new GraphQLNonNull(GraphQLString) },
  },
  resolve: async (_parent, { componentHash }, { natsContext }) => {
    const instanceId = ulid();
    const subject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('create_instance')
      .version('v1')

    await natsContext.publish(
      subject.build(),
      JSON.stringify({ data: { componentHash, instanceId } })
    )
    return { instanceId };
  },
}

const componentInstanceStartPayloadType = new GraphQLObjectType({
  name: 'ComponentInstanceStartPayload',
  fields: () => ({
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
  }),
});

export const componentInstanceStartField = {
  type: new GraphQLNonNull(componentInstanceStartPayloadType),
  args: {
    instanceId: { type: new GraphQLNonNull(GraphQLString) },
  },
  resolve: async (_parent, { instanceId }, { natsContext }) => {
    const subject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_instance')
      .version('v1')

    await natsContext.publish(
      subject.build(),
      JSON.stringify({ data: { instanceId } })
    )
    return { ok: true };
  },
};

export const componentInstanceProvideDataField = {
  type: new GraphQLNonNull(componentInstanceStartPayloadType),
  args: {
    instanceId: { type: new GraphQLNonNull(GraphQLString) },
    stateId: { type: new GraphQLNonNull(GraphQLString) },
    payload: { type: new GraphQLNonNull(GraphQLString) },
  },
  resolve: async (_parent, { instanceId, stateId, payload }, { natsContext }) => {
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      throw new Error(`Invalid JSON payload: ${err.message}`);
    }

    const subject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('provide_data')
      .version('v1')

    await natsContext.publish(
      subject.build(),
      JSON.stringify({ data: { instanceId, stateId, payload: parsed } })
    )
    return { ok: true };
  },
};
