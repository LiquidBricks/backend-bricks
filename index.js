import { createHandler } from 'graphql-http/lib/use/express';
import { ruruHTML } from 'ruru/server';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { schema } from './graphql/index.js';
import { componentServiceConsumer } from './consumer/componentService/index.js';
import { diagnosticsConsumer } from './consumer/diagnostics/index.js';
import { Graph } from '@liquid-bricks/nats-graph/graph';
import { createNatsContext } from '@liquid-bricks/shared-providers/nats-context';
import { diagnostics as createDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { createNatsMetrics } from '@liquid-bricks/shared-providers/diagnostics/metrics/nats'
import { createNatsLogger } from '@liquid-bricks/shared-providers/diagnostics/loggers/nats'
import { create as createTelemetrySubject } from '@liquid-bricks/shared-providers/subject/create/telemetry'
import { serviceConfiguration } from './provider/serviceConfiguration/dotenv/index.js'
import { RetentionPolicy } from '@nats-io/jetstream'
import { createStream as createGenericStream } from './stream/index.js'
import { resetNatsFactoryDefaults } from './stream/helper.js';
import { domain } from './domain/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mermaidPagePath = path.join(__dirname, 'docs', 'mermaid.html')

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  // Perform cleanup actions like closing database connections, etc.
  // ...
  process.exit(0); // Exit with success code after cleanup
});


cron.schedule('*/1 * * * *', () =>
  console.info('look alive!', { date: new Date() })
)


const { NATS_IP_ADDRESS } = serviceConfiguration()
const natsContext = createNatsContext({ servers: NATS_IP_ADDRESS })
const diagnostics = createDiagnostics({
  context: () => ({ env: 'prod', service: 'backend-bricks' }),
  logger: createNatsLogger({
    natsContext,
    subject: () => 'tele.log.v1',
  }),
  metrics: createNatsMetrics({
    natsContext,
    subject: (kind) => {
      const natsMetricSubjectMapping = {
        timing: 'histogram',
        count: 'counter',
      }
      return createTelemetrySubject()
        .metric()
        .entity(natsMetricSubjectMapping[kind])
        .version("v1")
        .build()
    }
  }),
})
const graph = Graph({
  kv: 'nats',
  kvConfig: { servers: NATS_IP_ADDRESS, bucket: 'graph' },
  diagnostics,
})

Promise.resolve()
  // Recreate streams defined in migrations to ensure desired config
  .then(async () => {
    const jsm = await natsContext.jetstreamManager();

    //   // DIAGNOSTICS_STREAM
    //   try { await jsm.streams.delete('DIAGNOSTICS_STREAM'); } catch (_) { /* ignore if not found */ }
    //   await createGenericStream({
    //     name: 'DIAGNOSTICS_STREAM',
    //     natsContext,
    //     diagnostics,
    //     configuration: {
    //       retention: RetentionPolicy.Workqueue,
    //       subjects: [
    //         'tele.>',
    //         'metrics.>',
    //       ],
    //     },
    //   });
    //   try { await jsm.streams.delete('COMPONENT_EXECUTION_STREAM'); } catch (_) { /* ignore if not found */ }
    //   await createGenericStream({
    //     name: 'COMPONENT_EXECUTION_STREAM',
    //     natsContext,
    //     diagnostics,
    //     configuration: {
    //       retention: RetentionPolicy.Workqueue,
    //       subjects: [
    //         'prod.component-service.*.*.exec.>',
    //       ],
    //     },
    //   })

    // COMPONENT_MANAGER_STREAM
    try { await jsm.streams.delete('COMPONENT_MANAGER_STREAM'); } catch (_) { /* ignore if not found */ }
    await createGenericStream({
      name: 'COMPONENT_MANAGER_STREAM',
      natsContext,
      diagnostics,
      configuration: {
        retention: RetentionPolicy.Workqueue,
        subjects: [
          'prod.component-service.*.*.evt.>',
          'prod.component-service.*.*.cmd.>',
        ],
      },
    });
    // try {
    //   await jsm.streams.purge('COMPONENT_MANAGER_STREAM');
    // } catch (err) {
    //   console.warn('Failed to purge COMPONENT_MANAGER_STREAM', err);
    // }
  })
  .then(() => componentServiceConsumer({
    streamName: "COMPONENT_MANAGER_STREAM",
    natsContext,
    g: graph.g,
    diagnostics,
  }))
  .then(() => diagnosticsConsumer({
    streamName: "DIAGNOSTICS_STREAM",
    natsContext,
    diagnostics,
  }))


  .then(() => {
    const app = express();
    const corsConfig = {
      origin: true,
      credentials: true,
    };

    const corsMiddleware = cors(corsConfig);

    app.use(corsMiddleware);
    app.options('/graphql', corsMiddleware);

    app.all(
      '/graphql',
      corsMiddleware,
      createHandler({
        schema,
        context: async (req) => {
          const rawCorrelation = req?.headers?.['x-correlation-id']
          const toCorrelationId = (value) => {
            if (typeof value === 'string') {
              const trimmed = value.trim()
              return trimmed.length ? trimmed : undefined
            }
            if (Array.isArray(value)) {
              for (const candidate of value) {
                const match = toCorrelationId(candidate)
                if (match) return match
              }
            }
            return undefined
          }

          return {
            natsContext,
            g: graph.g,
            diagnostics: diagnostics.child({ system: 'graphql', correlationId: toCorrelationId(rawCorrelation) }),
          }
        },
      }),
    );

    // Expose domain meta from domain/index.js
    app.get('/domain', (_req, res) => {
      try {
        res.json(domain);
      } catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
      }
    });

    app.get('/ruru', (_req, res) => {
      res.type('html');
      res.end(ruruHTML({ endpoint: '/graphql' }));
    });

    app.get('/mermaid', (_req, res) => {
      res.sendFile(mermaidPagePath);
    });

    return app.listen(4000);
  })
  .then(() => console.log('Running a GraphQL API server at http://localhost:4000/graphql'))
