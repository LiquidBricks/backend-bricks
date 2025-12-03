---
id: introduction
title: Introduction
sidebar_position: 1
---

Backend Bricks is a minimal, modular toolkit for building backend services with simple, composable building blocks.

What it is
- A Node.js service scaffold that exposes a GraphQL API and wires in background workers/consumers.
- A small set of utilities for messaging, metrics, and service configuration.
- A pragmatic starting point you can extend, not a heavy framework.

What it does
- GraphQL API: Runs an Express server with `graphql-http` at `/graphql` (and a `/ruru` playground) powered by your schema in `graphql/`.
- Event and data backbone: Integrates with NATS (JetStream + KV) via a simple `natsContext` helper for publish/subscribe, streams, and key/value buckets.
- Workers/consumers: Includes sample consumers (e.g., component and diagnostics) to process subjects from JetStream and route them to handlers.
- Diagnostics & metrics: Structured logs, counters, and timings with pluggable sinks (including NATS-backed metrics) to help trace and tune your services.
- Configuration: Uses environment variables (via dotenv) to configure connections and behavior.

When to use it
- You want to bootstrap an event-driven or service-oriented backend quickly.
- You prefer small, understandable modules you can swap out over generated boilerplate.

High-level architecture
- API layer: Express + GraphQL (see `graphql/`).
- Messaging: NATS JetStream and KV (see `util/natsContext.js`).
- Domain workers: Consumers that subscribe to subjects and handle commands/events (see `consumer/`).
- Observability: Diagnostics and metrics providers (see `provider/diagnostics/`).

Next steps
- Explore the code in `index.js` to see how the server, NATS context, and consumers are initialized.
- Add your own subjects, streams, and handlers to `consumer/` and your schema/types/resolvers to `graphql/`.
- Configure NATS and environment defaults in `.env` and the service configuration provider.

