---
id: graphql
title: GraphQL API
sidebar_position: 3
---

GraphQL handles mutations by publishing corresponding commands/events to NATS for the Component Manager to process. Queries can read state, but all writes flow through NATS.

- Mutations → NATS: publishes to subjects like `componentInstance.command` for actions such as `create`/`start` and now to `componentInstance.event` for `result_computed` when manually stubbing executor results.
- Component Manager picks these up, persists/updates graph state, and emits follow-up events.
