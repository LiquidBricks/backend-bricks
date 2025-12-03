---
id: diagnostics-consumer
title: Diagnostics
sidebar_position: 3
---

The Diagnostics consumer ingests structured logs over NATS and prints them according to a configured level threshold.

- Code: `consumer/diagnostics/`
- Subject filter: `*.component-service.*.*.log.>` where `action` is the level (`debug`, `info`, `warn`, `error`, `fatal`)

Behavior
- Validates log entries contain `level`, `message`, `info`, and timestamp `ts`.
- Applies a simple level threshold to decide whether to print.
- Emits ACKs to JetStream when processed.

Code entrypoints
- Consumer: `consumer/diagnostics/index.js`
- Router: shared token router `@liquid-bricks/shared-providers/subject/router`
- Handler: `consumer/diagnostics/handlers/diagnostics/index.js`

Publishing logs
```js
// Example subject shape: env.ns.tenant.context.log.diagnostics.<level>.v1.id
// Payload may be top-level or wrapped in { data }
conn.publish('prod.component-service.t1.web.log.diagnostics.info.v1.123', JSON.stringify({
  data: {
    message: 'component started',
    info: { component: 'api' },
    ts: Date.now(),
    correlationID: 'corr-123'
  }
}));
```
