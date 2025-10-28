import { AckPolicy, DeliverPolicy } from "@nats-io/jetstream";
import router from "@liquid-bricks/shared-providers/subject/router";
import { Errors } from "../errors.js";
import * as component from './component/index.js'
import * as componentInstance from './componentInstance/index.js'

const consumerName = 'componentServiceConsumer'
export async function componentServiceConsumer({ streamName, natsContext, g, diagnostics: d }) {
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
      '*.component-service.*.*.cmd.>',
      '*.component-service.*.*.evt.>',
    ],
  });

  const c = await jetstream.consumers.get(streamName, consumerName);
  const iter = await c.consume();

  const r = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { natsContext, g, diagnostics }
  })
    .route(component.cmd.register.path, component.cmd.register.spec)
    .route(component.evt.registered.path, component.evt.registered.spec)
    .route(componentInstance.cmd.create_instance.path, componentInstance.cmd.create_instance.spec)
    .route(componentInstance.cmd.start_instance.path, componentInstance.cmd.start_instance.spec)
    .route(componentInstance.cmd.provide_data.path, componentInstance.cmd.provide_data.spec)
    .route(componentInstance.evt.created.path, componentInstance.evt.created.spec)
    .route(componentInstance.evt.data_provided.path, componentInstance.evt.data_provided.spec)
    .default({
      handler: async ({ message }) => {
        diagnostics.invariant(
          message?.term?.(`No handler for subject: ${message.subject}`) ?? false,
          Errors.ROUTER_UNKNOWN_SUBJECT,
          `No handler for subject: ${message.subject}`,
          { subject: message.subject, message: message?.json?.() }
        )
      }
    })
    .error((...err) => {
      console.log('shit hit the fan!', { err })
    })
    .abort(({ reason, stage, message, rootCtx: { diagnostics } }) => {
      try { message?.ack?.() } catch (_) { /* ignore */ }
      diagnostics?.debug?.('component service router aborted', { stage, reason })
      return { status: 'aborted' }
    })

  new Promise(async () => {
    for await (const m of iter) {
      diagnostics.debug('recieved a message for component service', { subject: m.subject })
      await r.request({
        subject: m.subject,
        message: m
      })
    }
  })
}





// const [err, good] = await waitOnFunction({
//   fnc: async () => handler({ natsContext, m, g, diagnostics }),
//   interval: 5_000,
//   timeout: 1000 * 60 * 60, // 1 hour default timeout to avoid runaway
//   onInterval: async () => {
//     m.working()
//   }
// })
// diagnostics.invariant(good, Errors.ROUTER_HANDLER_ERROR, 'uh oh', { err, message: m.json(), subject: m.subject })


async function waitOnFunction(_) {
  const {
    fnc, interval, timeout, onInterval,
  } = deepMerge({
    fnc: async () => { },
    interval: 1000,
    timeout: 60000,
    onInterval: () => { },
  }, _);

  const start = performance.now();
  const elapsed = () => performance.now() - start;
  const fncPromise = fnc(); // Call fnc once
  let timeoutId, intervalId;
  const timeoutPromise = new Promise(r => {
    timeoutId = setTimeout(r, timeout);
  });

  return new Promise((resolve, reject) => {
    const checkit = async () => {
      const intervalPromise = new Promise(r => {
        intervalId = setTimeout(r, interval);
      });

      const result = await Promise.race([
        fncPromise
          .then(res => ({ type: 'completed', value: res }))
          .catch(err => ({
            type: 'failed',
            value: {
              stack: err.stack,
              errMessage: err.message,
              errCode: err.code,
            }
          })),
        timeoutPromise.then(() => ({ type: 'timeout' })),
        intervalPromise.then(() => ({ type: 'interval' })),
      ]);

      clearTimeout(timeoutId);
      clearTimeout(intervalId);

      let onResults = {
        'timeout'() {
          resolve([result]);
        },
        'failed'() {
          resolve([result]);
        },
        'interval'() {
          onInterval({ elapsed: elapsed() });
          checkit();
        },
        'completed'() {
          resolve([null, result]);
        },
      };

      if (onResults[result.type]) {
        return onResults[result.type]();
      } else {
        resolve([new Error('Unknown result type')]);
      }
    };

    checkit();
  });
}


function deepMerge(target, source) {
  if (typeof target !== "object" || typeof source !== "object") return source;

  for (const key in source) {
    if (source[key] && typeof source[key] === "object") {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
