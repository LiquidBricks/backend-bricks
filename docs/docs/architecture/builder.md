---
id: builder
title: Component Builder
sidebar_position: 1
---

The builder defines a Component — a small, declarative graph of nodes you can register and observe across the system. It’s a lightweight DSL to describe:

- data nodes — derived values inside a component
- task nodes — units of work that depend on data or other tasks

Components are authored in plain JS using the `component()` builder and exported from `.comp.js` files.

Where it lives
- Module: `builder/component.js` (re-exported by `builder/index.js`)
- Discovery: files ending in `.comp.js` under your configured directories (see `consumer/componentProvider/`)

Quick start
1) Create a component file: `flows/hello/hello.comp.js`

```js
import { component } from '../../builder/index.js';

export default component('hello')
  .data('input', {
    fnc: () => ({ message: 'Hello, world!' })
  })
  .data('shout', {
    deps: ['data.input'],
    fnc: () => 'HELLO, WORLD!'
  })
  .task('announce', {
    deps: ['data.shout'],
    fnc: () => {/* side‑effects, emit events, etc. */}
  });
```

2) Register it by running the Component Provider consumer with your `flows/` directory configured. It will auto-discover `.comp.js` files, compute a hash, and publish a `component.command` register message so the graph is stored and visible to other services.

Authoring components
- `component(name)` creates a new component and returns a chainable builder.
- `.data(name, { deps?, fnc })` adds a data node.
- `.task(name, { deps?, fnc })` adds a task node.
- `.explain()` logs the names of data and task nodes (debug helper).

Definitions
- `name` must be a non-empty string unique within the component.
- `deps` is an array of strings referencing previously declared nodes using the format:
  - `data.<name>` to depend on a data node
  - `task.<name>` to depend on a task node
  - `deferred.deferred` is reserved and automatically added by the system as a universal terminal node you may target when modeling “end of graph”.
- `fnc` is your function implementation. Today, it is stored (as source) with a code reference for introspection and tooling. Execution is orchestrated by downstream services and is not handled by the builder itself.

Validation and safety
- Duplicate names for data/task nodes are rejected.
- Definitions require an object with a `fnc` function; `deps` defaults to an empty array.
- A deterministic SHA‑256 `hash` is computed from the component structure (names, deps, and function sources). Any change creates a new version.
- Source locations (file, line, column) are captured at definition time to improve traceability in UIs and logs.

File discovery and registration
- The consumer at `consumer/componentProvider/` loads all `.comp.js` files in configured directories, validates they export a default component (or array of components), and publishes a `register` command with the component’s `name`, `hash`, and node descriptors.
- The service at `consumer/componentService/` persists the component, nodes, and dependency edges. It also verifies that all declared `deps` actually reference known nodes and are of type `data`, `task`, or `deferred`.

Conventions and tips
- Keep node names short and intention‑revealing (e.g., `input`, `validated`, `persist`).
- Prefer many small components over one giant one — compose via messaging between components rather than enormous internal graphs.
- Make `fnc` bodies pure and side‑effect free for data nodes; reserve side effects for task nodes.
- Changing node names, deps, or function bodies will change the component’s hash and register a new version on the next publish.

Minimal example
```js
// flows/example/example.comp.js
import { component } from '../../builder/index.js';

export default component('example')
  .data('input', { fnc: () => ({ id: 1 }) })
  .task('run', { deps: ['data.input'], fnc: () => {} });
```

Troubleshooting
- “Duplicate component name detected”: ensure only one component with a given `name` across discovered files.
- “Dependency not found … dep[...]”: verify each entry in `deps` matches a declared node and uses `data.` or `task.` prefix.
- “Flow file … must have a default export”: export your component as the default from the `.comp.js` module.
