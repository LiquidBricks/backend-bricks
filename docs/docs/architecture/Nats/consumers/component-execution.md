---
id: component-execution-consumer
title: Component Execution
sidebar_position: 2
---

Overview
- Drives node-level work for registered component instances. Listens for node commands per component and executes tasks/evaluations.

Configuration
- Stream: provided via `streamName` (use the stream that carries node commands)
- Durable name: `componentProviderConsumer`
- Ack policy: Explicit
- Deliver policy: All
- Filters: `componentNode.<componentHash>.command` (one subject per registered component)

Code
- Entry + executor: `consumer/componentProvider/index.js`
- Component loading: `consumer/componentProvider/componentOperations.js`

Usage
```js
import { componentProviderConsumer } from 'consumer/componentProvider/index.js'

await componentProviderConsumer({
  streamName,       // stream carrying `componentNode.<id>.command`
  natsContext,
  directories: ["./builder"], // where `.comp.js` live
  diagnostics,
})
```

