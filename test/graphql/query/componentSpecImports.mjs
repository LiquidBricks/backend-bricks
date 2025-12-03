import test from 'node:test'
import assert from 'node:assert/strict'
import { Graph } from '@liquid-bricks/nats-graph/graph'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { ulid } from 'ulid'

import { schema } from '../../../graphql/index.js'
import { createComponentServiceRouter } from '../../../consumer/componentService/router.js'
import { dataMapper as createDataMapper } from '../../../domain/index.js'
import { serviceConfiguration } from '../../../provider/serviceConfiguration/dotenv/index.js'
import { runGql } from '../../util/runGql.js'

const { NATS_IP_ADDRESS } = serviceConfiguration()
assert.ok(NATS_IP_ADDRESS, 'NATS_IP_ADDRESS missing; set in test/.env')

function makeDiagnosticsInstance() {
  return makeDiagnostics({
    logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } },
    metrics: { timing: () => { }, count: () => { } },
    sample: () => true,
    rateLimit: () => true,
  })
}

function createGraphContext() {
  const diagnostics = makeDiagnosticsInstance()
  const graph = Graph({
    kv: 'nats',
    kvConfig: { servers: NATS_IP_ADDRESS, bucket: `component-imports-${ulid()}` },
    diagnostics,
  })
  const g = graph.g
  const dataMapper = createDataMapper({ g, diagnostics })
  return { graph, diagnostics, g, dataMapper }
}

async function withGraphContext(run) {
  const ctx = createGraphContext()
  try {
    await run(ctx)
  } finally {
    try { await ctx.graph?.close?.() } catch { }
  }
}

function getRegisterSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'cmd'
    && values.entity === 'component'
    && values.action === 'register'
  )
  assert.ok(route, 'register route not found')
  return route.config
}

const registerSpec = getRegisterSpec()

function createHandlerDiagnostics(diagnostics, scope = {}, message) {
  return diagnostics.child
    ? diagnostics.child({ router: { stage: 'unit-test' }, scope, message })
    : diagnostics
}

async function registerComponent(context, component) {
  const { diagnostics, dataMapper, g } = context
  const handlerDiagnostics = createHandlerDiagnostics(diagnostics, { component })
  await registerSpec.handler({ rootCtx: { diagnostics, dataMapper, g }, scope: { handlerDiagnostics, component } })
}

test('componentSpec returns imports with distinct aliases for duplicate hash', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const shared = { hash: 'import-shared-hash', name: 'SharedImport', tasks: [], data: [] }
    const importer = {
      hash: 'importing-parent-hash',
      name: 'ImportingComponent',
      tasks: [],
      data: [],
      imports: [
        { name: 'alpha', hash: shared.hash },
        { name: 'beta', hash: shared.hash },
      ],
    }

    await registerComponent({ diagnostics, dataMapper, g }, shared)
    await registerComponent({ diagnostics, dataMapper, g }, importer)

    const result = await runGql({
      schema,
      source: `query ComponentSpecImports($hash: String!) {
        componentSpec(hash: $hash) {
          imports {
            totalCount
            edges {
              cursor
              node {
                alias
                hash
                name
              }
            }
          }
        }
      }`,
      variableValues: { hash: importer.hash },
      contextValue: { g },
    })

    assert.ok(!result.errors?.length, `Unexpected errors: ${result.errors?.map((err) => err.message).join(', ')}`)

    const imports = result.data?.componentSpec?.imports
    assert.ok(imports, 'imports missing from response')
    assert.equal(imports.totalCount, importer.imports.length)
    assert.equal(imports.edges.length, importer.imports.length)

    const aliases = imports.edges.map(({ node }) => node.alias).sort()
    assert.deepEqual(aliases, importer.imports.map(({ name }) => name).sort())
    assert.ok(imports.edges.every(({ node }) => node.hash === shared.hash))
  })
})
