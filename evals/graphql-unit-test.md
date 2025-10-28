You are writing unit tests for our GraphQL API in Node.js (ESM). 
Use the built-in node test runner (`node:test`) and `assert/strict` only (no Jest/Vitest).
Use `graphql` from `graphql` to execute operations.

NEW ADDITION: *** if this is not filled in, quit and tell me ***

GIVEN:
- The schema is created by `makeExecutableSchema` in `src/schema/index.js`.
- Resolvers read data ONLY via `context.services.*` (dependency-injected).
- We already have a helper `tests/util/runGql.js` that exports:
    import { graphql } from 'graphql'
    export async function runGql({ schema, source, variableValues, contextValue }) { 
      return graphql({ schema, source, variableValues, contextValue }) 
    }
- Cursor encoding is opaque but stable for a given edge id.

TASK:
Write tests for the NEW GRAPHQL ADDITION described below. 
Write a single test file. Do NOT change app code. Do NOT re-test unrelated behavior.


REQUIREMENTS:
1) **Shape & nullability**
   - Query returns required wrapper types (non-null connection, non-null edges, etc.).
   - Edge includes the relationship fields (id, label, since, role) and `node { id }`.

2) **Pagination semantics**
   - `first: 2` returns 2 edges max.
   - `after` respects cursor (request the next page and assert non-overlap).
   - `pageInfo.hasNextPage` is correct; `totalCount` is the full count.

3) **Ordering**
   - Default order is {{state your expected order: e.g., createdAt ASC or id ASC}}.
   - Cursors remain stable for the same underlying edges.

4) **Edge cases**
   - Empty list returns `edges: []`, `totalCount: 0`, `hasNextPage: false`.
   - Request beyond end: still empty page, with consistent `pageInfo`.
   - If resolver raises a known domain error (e.g., permission), assert GraphQL error path.

5) **Minimal stubs**
   - Provide `contextValue = { services: { tasksRepo: <fake>, dataRepo: <fake>, ... } }` just enough for this field.
   - Count calls to the fake repo to guard against N+1 where relevant.

OUTPUT:
- A single ESM test file in `backend-bricks/test/graphql/{{slug}}.test.js`.
- Use `test()` from `node:test` and `assert` for assertions.
- Use inline fixtures inside the test file (no external files).

EXAMPLE SCAFFOLD (adapt for the new addition, do not copy blindly):

import test from 'node:test'
import assert from 'node:assert/strict'
import { makeExecutableSchema } from '@graphql-tools/schema'
import typeDefs from '../../src/schema/typeDefs.js'
import resolvers from '../../src/schema/resolvers/index.js'
import { runGql } from '../util/runGql.js'

function makeCtx(fixtures = {}) {
  // replace with only the services this field touches
  let calls = 0
  const tasksRepo = {
    async getTaskDependencies({ taskId, first, after }) {
      calls++
      return fixtures.pages[after ?? 'START'] // return { edges: [...], pageInfo, totalCount }
    }
  }
  return { services: { tasksRepo }, _meta: { calls } }
}

test('Task.taskDependencies basic shape', async () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const ctx = makeCtx({
    pages: {
      START: { edges: [
        { id: 'e1', label: 'HAS_TASK_DEPENDENCY', since: '2025-09-01T00:00:00Z', role: 'hard', node: { id: 'T2' }, cursor: 'c1' },
        { id: 'e2', label: 'HAS_TASK_DEPENDENCY', since: null, role: null, node: { id: 'T3' }, cursor: 'c2' },
      ], totalCount: 3, pageInfo: { hasNextPage: true, endCursor: 'c2' } },
      c2: { edges: [
        { id: 'e3', label: 'HAS_TASK_DEPENDENCY', since: null, role: 'soft', node: { id: 'T4' }, cursor: 'c3' },
      ], totalCount: 3, pageInfo: { hasNextPage: false, endCursor: 'c3' } },
    }
  })

  const q1 = `
    query($id: ID!, $first: Int!) {
      task(id: $id) {
        taskDependencies(first: $first) {
          totalCount
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            id label since role
            node { id }
          }
        }
      }
    }`
  const r1 = await runGql({
    schema,
    contextValue: ctx,
    source: q1,
    variableValues: { id: "T1", first: 2 }
  })

  assert.equal(r1.errors, undefined)
  const c1 = r1.data.task.taskDependencies
  assert.equal(c1.totalCount, 3)
  assert.equal(c1.edges.length, 2)
  assert.equal(c1.pageInfo.hasNextPage, true)
  assert.equal(c1.edges[0].id, 'e1')
  assert.equal(c1.edges[1].id, 'e2')

  // next page
  const r2 = await runGql({
    schema,
    contextValue: ctx,
    source: q1,
    variableValues: { id: "T1", first: 2, after: c1.pageInfo.endCursor }
  })
  const c2 = r2.data.task.taskDependencies
  assert.equal(c2.edges.length, 1)
  assert.equal(c2.pageInfo.hasNextPage, false)
  assert.deepEqual(
    new Set([...c1.edges.map(e => e.id), ...c2.edges.map(e => e.id)]),
    new Set(['e1','e2','e3'])
  )
})
