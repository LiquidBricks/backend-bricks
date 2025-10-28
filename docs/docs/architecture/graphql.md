---
id: graphql
title: GraphQL API
sidebar_position: 3
---

GraphQL handles mutations by publishing corresponding commands/events to NATS for the Component Manager to process. Queries can read state, but all writes flow through NATS.

- Mutations → NATS: publishes to subjects like `componentInstance.command` with commands such as `create_instance`, `start_instance`, and `provide_data`.
- Component Manager picks these up, persists/updates graph state, and emits follow-up events.
