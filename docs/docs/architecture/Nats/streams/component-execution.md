---
id: component-execution
title: Component Execution
sidebar_position: 2
---

The Component Execution consumer is responsible for driving node-level work of a registered component instance. It listens for node commands and performs the actual execution of `task` and evaluation of `data` where appropriate.

- Code: `consumer/componentProvider/`
- Subjects: `componentNode.<componentHash>.command` (one subject per registered component)

Current status
- The provider loads and registers components, and subscribes a JetStream consumer to each `componentNode.<id>.command` subject.
- Execution logic is stubbed; it identifies the correct component by id and is the place to add scheduling and execution of nodes.

How it works
- Discovery: Scans configured directories for `.comp.js` files and imports their default export(s) as Components.
- Registration: Publishes a `component.command: register` message with the component’s `name`, `hash`, `data[]`, and `tasks[]`.
- Subscription: Creates a durable consumer filtered to `componentNode.<id>.command` for each component, to receive node-execution commands.

Code entrypoints
- Provider + executor: `consumer/componentProvider/index.js`
- Component loading: `consumer/componentProvider/componentOperations.js`

Extending execution
- Add handling for node-level commands (e.g., `run_task`, `eval_data`) on `componentNode.<id>.command`.
- Use the graph in the Component Manager to determine readiness (all `deps` satisfied) and update state/emit events as nodes complete.
