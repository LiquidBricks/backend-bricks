---
id: diagnostics-consumer-impl
title: Diagnostics
sidebar_position: 3
---

Overview
- Ingests structured logs over NATS and prints them based on a level threshold.

Configuration
- Stream: `DIAGNOSTICS_STREAM`
- Durable name: `logsConsumer`
- Ack policy: Explicit
- Deliver policy: All
- Filters: `*.component-service.*.*.log.>` where `action` is the level

Code
- Entry: `consumer/diagnostics/index.js`
- Router: shared token router `@liquid-bricks/shared-providers/subject/router`
- Handler: `consumer/diagnostics/handlers/diagnostics/index.js`

Usage
```js
import { diagnosticsConsumer } from 'consumer/diagnostics/index.js'

await diagnosticsConsumer({
  streamName: 'DIAGNOSTICS_STREAM',
  natsContext,
  diagnostics,
})
```
