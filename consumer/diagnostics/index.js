import { AckPolicy, DeliverPolicy } from "@nats-io/jetstream";
import { router, s } from "@liquid-bricks/shared-providers/subject/router";
import { Errors } from "../errors.js";
import * as log from './log/index.js'
import * as metric from './metric/index.js'
import * as trace from './trace/index.js'

const consumerName = 'logsConsumer'
// Log level thresholds moved from handler to pre hook logic
const levelPriority = { error: 40, warn: 30, info: 20, debug: 10, trace: 5 }
const currentLogLevel = 'info'
export async function diagnosticsConsumer({ streamName, natsContext, diagnostics: d }) {
  const diagnostics = d.child({ consumerName })

  const jetstream = await natsContext.jetstream();
  const jetstreamManager = await natsContext.jetstreamManager()

  // Ensure a clean slate: delete existing consumer if present
  try {
    await jetstreamManager.consumers.delete(streamName, consumerName)
  } catch (_) { /* ignore if not found or unsupported */ }

  await jetstreamManager.consumers.add(streamName, {
    durable_name: consumerName,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    filter_subjects: [
      // Structured log channel (env.ns.tenant.context.log.entity.action.version.id)
      'tele.>',
      'metrics.>',
    ],
  });

  const c = await jetstream.consumers.get(streamName, consumerName);
  const iter = await c.consume();

  const r = router({
    tokens: ['telemetryNS', 'channel'],
    context: { natsContext, diagnostics }
  })
    .abort(({ reason, stage, message, rootCtx: { diagnostics } }) => {
      try { message?.ack?.() } catch (_) { /* ignore */ }
      diagnostics?.debug?.('diagnostics router aborted', { stage, reason })
      return { status: 'aborted' }
    })
    // log events: entity=diagnostics, action is the level (debug|info|warn|error|fatal)
    .route(log.path, log.spec)
    .route(metric.path, metric.spec)
    .route(trace.path, trace.spec)
    .default({
      handler: async ({ message, rootCtx: { diagnostics } }) => {
        diagnostics.invariant(
          message?.term?.(`No handler for subject: ${message.subject}`) ?? false,
          Errors.ROUTER_UNKNOWN_SUBJECT,
          `No handler for subject: ${message.subject}`,
          { subject: message.subject, message: message?.json?.() }
        )
      }
    })
    .error(({ error, message }) => {
      message.term()
      // eslint-disable-next-line no-console
      console.log('diagnostics consumer error', error, message.json())
    })

  new Promise(async () => {
    for await (const m of iter) {
      await r.request({ subject: m.subject, message: m })
    }
  })
}
