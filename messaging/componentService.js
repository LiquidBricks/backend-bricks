import { streamName } from "../nats/config.js";
import { AckPolicy, DeliverPolicy } from "@nats-io/jetstream";
import { connection } from "../natsConnection.js";
import { route } from './router/index.js'


export async function runServiceConsumer() {
  const client = await connection.client()
  const jetstream = await connection.jetstream();
  const jetstreamManager = await connection.jetstreamManager()

  await jetstreamManager.consumers.add(streamName, {
    durable_name: 'componentServiceConsumer',
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    filter_subjects: [
      `componentService.command`,
      `componentService.event`,
      `sessionService.command`,
      `sessionService.event`,
    ],
  });

  const c = await jetstream.consumers.get(streamName, 'componentServiceConsumer');
  const iter = await c.consume();

  new Promise(async (res) => {
    for await (const m of iter) {
      const subject = m.subject
      await route({ subject, client, m })
    }
  })
}