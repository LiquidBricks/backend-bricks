---
id: component-manager
title: Component Manager
sidebar_position: 1
---

The Component Manager orchestrates component registration and instance lifecycle.

- Code: `consumer/componentService/`
- Subjects: `component.command`, `component.event`, `componentInstance.command`, `componentInstance.event`

Responsibilities
- Register component specs: persists component, nodes, and dependency edges from `builder/component.js` descriptors.
- Manage instances: create, start, and accept computed results for specific component instances.
- Route by subject: a small router maps subjects to handlers.

Key handlers
- `component.command: register` — stores the component graph and emits `component.event: registered`.
- `componentInstance.command: create` — creates an instance vertex, initializes state edges for each node, emits `.cmd.create.componentInstance`.
- `componentInstance.command: start` — acknowledges a start request (hook for scheduling/execution).
- `componentInstance.event: result_computed` — marks a data state as provided.

Code entrypoints
- Manager: `consumer/componentService/index.js`
- Router: `consumer/componentService/router/index.js`
- Handlers: `consumer/componentService/handlers/...`

Usage examples
Register a component (normally published by the Component Provider):
```js
conn.publish('component.command', JSON.stringify({
  command: 'register',
  data: {/* name, hash, data[], tasks[] */}
}));
```

Create an instance:
```js
conn.publish('componentInstance.command', JSON.stringify({
  command: 'create',
  data: { componentHash: '<hash>', instanceId: 'inst-1' }
}));
```

Provide a computed result to a waiting state (either from the executor or manually):
```js
conn.publish('componentInstance.event', JSON.stringify({
  event: 'result_computed',
  data: { instanceId: 'inst-1', stateId: '<state-vertex-id>', payload: { /* any */ } }
}));
```
