import { createHandler } from 'graphql-http/lib/use/express';
import { ruruHTML } from 'ruru/server';
import express from 'express';
import cron from 'node-cron'
import { schema } from './graphql/index.js';
import { createStream, deleteStream } from './nats/stream.js';
import { connection } from './natsConnection.js';
import { NATS_IP } from './nats/config.js';
import { createWorkers } from './nats/workers.js';
import { runServiceConsumer } from './messaging/componentService.js';

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  // Perform cleanup actions like closing database connections, etc.
  // ...
  process.exit(0); // Exit with success code after cleanup
});


cron.schedule('*/1 * * * *', () =>
  console.info('look alive!', { date: new Date() })
)


connection.client(NATS_IP)
  // .then(deleteStream)
  .then(createStream)
  .then(() => createWorkers({
    componentIds: ['123'],
    NATS_IP,
    workersCount: 1,//os.cpus().length,
    consumerGroup: "flowServiceInternalFlows",
  }))
  .then(runServiceConsumer)
  .then(() => express()
    .all(
      '/graphql',
      createHandler({
        schema,
        context: async (req, res) => {
          return {
            natsConnection: connection,
          };
        },
      }),
    )
    .get('/ruru', (_req, res) => {
      res.type('html');
      res.end(ruruHTML({ endpoint: '/graphql' }));
    })
    .listen(4000)
  )
  .then(() => console.log('Running a GraphQL API server at http://localhost:4000/graphql'))
