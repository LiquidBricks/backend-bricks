import { RetentionPolicy } from "@nats-io/jetstream";
import { connection } from "../natsConnection.js";
import { streamName } from "./config.js";

export async function createStream() {
  const jetstreamManager = await connection.jetstreamManager()
  await jetstreamManager.streams.add({
    name: streamName,
    retention: RetentionPolicy.Workqueue,
    subjects: [
      "componentNode.*.command",  //componentNode.123.command {command:'runTask',taskName:'abc'}
      "componentService.command",
      "componentService.event",
      "sessionService.command",
      "sessionService.event",
    ],
  });
}
export async function deleteStream() {
  const jetstreamManager = await connection.jetstreamManager()
  await jetstreamManager.streams.delete(streamName);
}