---
id: streams
title: Streams
sidebar_position: 0
---

Streams provide the event and data backbone using NATS JetStream and Key/Value.

- Locations: `stream/`, `util/natsContext.js`
- Role: Define subjects, streams, and buckets; publish/subscribe; manage retention
- Consumers: Background workers in `consumer/` subscribe to these streams

Concepts
- Subjects: Namespaced topics (e.g., `components.*`, `diagnostics.*`)
- JetStream: Durable, replayable message streams for events and commands
- KV: Lightweight, eventually consistent key/value store for configuration and state

Tips
- Use clear subject naming conventions by domain
- Document stream configs (retention, acks, replicas) near code in `stream/`
- Emit metrics for publish/consume rates and handler latencies
