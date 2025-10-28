## GraphQL Conventions (MANDATORY)

* Each type resides in its own file `graphql/{mutation|query}/**/*.js`.

## Code Requirements (MANDATORY)

* Edge/Connection:
  * Relationship properties live on the `*Edge` type.
  * Connection must expose `edges`, `pageInfo`, `totalCount`.
* Use **one-shot** `graph()`; never assign it to a variable.
  * ✅ `await graph().V()...`, `await graph().addV()...`
  * ❌ `const g = graph(); g.V()...; g.addV()...`
  
## Code Style

* Prefer compact, inlined resolvers. Tiny helpers only for pagination cursors, error mapping, or IO-reducing batching.

## Tests (FOR EACH NEW ADDITION)

* For connections: assert `first/after`, `pageInfo.hasNextPage`, `totalCount`, and non-overlapping pages.
* Include one failure test (validation or side-effect error).
* Use in-process `graphql({ schema, source, variables, contextValue })` with fakes; no HTTP server and no real NATS.
