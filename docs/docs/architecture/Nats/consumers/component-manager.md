---
id: component-manager-consumer
title: Component Manager
sidebar_position: 1
---

Overview
- Subscribes to Component Manager stream messages and routes commands/events for components and instances.

Configuration
- Stream: `COMPONENT_MANAGER_STREAM`
- Durable name: `componentServiceConsumer`
- Ack policy: Explicit
- Deliver policy: All
- Filters:
  - `component.command`
  - `component.event`
  - `componentInstance.command`

Code
- Entry: `consumer/componentService/index.js`
- Router: `consumer/componentService/router/index.js`
- Handlers: `consumer/componentService/handlers/...`

Usage
```js
import { componentServiceConsumer } from 'consumer/componentService/index.js'

await componentServiceConsumer({
  streamName: 'COMPONENT_MANAGER_STREAM',
  natsContext,
  g,                // graph context
  diagnostics,
})
```

