import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import router from '@liquid-bricks/shared-providers/subject/router'
import { spec as registerSpec, path as registerPath } from '../../../../../consumer/componentService/component/cmd/register.js'
import { Graph } from '@liquid-bricks/nats-graph/graph'
import { createNatsContext } from '@liquid-bricks/shared-providers/nats-context'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { serviceConfiguration } from '../../../../../provider/serviceConfiguration/dotenv/index.js'

const { NATS_IP_ADDRESS } = serviceConfiguration()

let natsContext
let diagnostics
let graph

before(async () => {
  natsContext = createNatsContext({ servers: NATS_IP_ADDRESS })
  diagnostics = makeDiagnostics()
  const nc = await natsContext.connection()
  graph = Graph({ kv: 'nats', kvConfig: { nc, servers: NATS_IP_ADDRESS, bucket: `graph_unit_${Date.now()}` } })
})

after(async () => {
  try { if (typeof graph?.close === 'function') await graph.close() } catch { }
  try { if (typeof graph?.destroy === 'function') await graph.destroy() } catch { }
  try { if (typeof graph?.shutdown === 'function') await graph.shutdown() } catch { }
  try { const nc = await natsContext?.connection(); await nc?.close() } catch { }
})

test('component/cmd/register: registers component and persists graph', async () => {
  const hash = `unit_${Date.now()}`
  const component = {
    hash,
    name: 'UnitComponent',
    tasks: [
      { name: 'build', deps: ['data:config'], fnc: 'buildFn', codeRef: { file: 't.js', line: 1, column: 1 } },
      { name: 'deploy', deps: ['task:build', 'deferred:deferred'], fnc: 'deployFn', codeRef: { file: 't.js', line: 2, column: 1 } },
    ],
    data: [
      { name: 'config', deps: [], fnc: 'configFn', codeRef: { file: 'd.js', line: 1, column: 1 } },
    ],
  }

  let acked = false
  const message = {
    subject: 'prod.component-service.tenant.ctx.cmd.component.register.v1',
    json: () => ({ data: component }),
    ack: () => { acked = true },
  }

  const r = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { natsContext, g: graph.g, diagnostics },
  }).route(registerPath, registerSpec)

  await r.request({ subject: message.subject, message })

  assert.equal(acked, true, 'message should be acked')

  const g = graph.g
  const componentIds = await g.V().has('label', 'component').has('hash', hash).id()
  assert.equal(componentIds.length, 1, 'component vertex should exist')
  const componentId = componentIds[0]

  const taskMaps = await g.V(componentId).out('has_task').valueMap('name', 'fnc')
  assert.equal(taskMaps.length, component.tasks.length, 'all tasks should be created')
  const taskNames = taskMaps.map(m => m.name)
  assert.ok(taskNames.includes('build'))
  assert.ok(taskNames.includes('deploy'))

  const dataMaps = await g.V(componentId).out('has_data').valueMap('name', 'fnc')
  assert.equal(dataMaps.length, component.data.length, 'all data should be created')
  const dataNames = dataMaps.map(m => m.name)
  assert.ok(dataNames.includes('config'))

  const deferredMaps = await g.V(componentId).out('has_deferred').valueMap('name')
  assert.equal(deferredMaps.length, 1, 'deferred node should exist')
  assert.equal(deferredMaps[0].name, 'deferred')

  const [buildId] = await g.V(componentId).out('has_task').has('name', 'build').id()
  const [deployId] = await g.V(componentId).out('has_task').has('name', 'deploy').id()
  const buildDeps = await g.V(buildId).out('has_dependency').valueMap('name')
  assert.deepEqual(buildDeps.map(m => m.name).sort(), ['config'])

  const deployDeps = await g.V(deployId).out('has_dependency').valueMap('name')
  assert.deepEqual(deployDeps.map(m => m.name).sort(), ['build', 'deferred'])
})

test('component/cmd/register: duplicate hash is not re-registered', async () => {
  const hash = `dup_${Date.now()}`
  const component = {
    hash,
    name: 'DupComponent',
    tasks: [ { name: 't1', deps: [], fnc: 'fn1', codeRef: { file: 'a.js', line: 1, column: 1 } } ],
    data: [ { name: 'd1', deps: [], fnc: 'dfn1', codeRef: { file: 'b.js', line: 1, column: 1 } } ],
  }

  const subject = 'prod.component-service.tenant.ctx.cmd.component.register.v1'

  let ack1 = false
  const message1 = { subject, json: () => ({ data: component }), ack: () => { ack1 = true } }
  const r1 = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { natsContext, g: graph.g, diagnostics },
  }).route(registerPath, registerSpec)
  await r1.request({ subject, message: message1 })

  assert.equal(ack1, true, 'initial register should ack')

  const g = graph.g
  const componentIdsBefore = await g.V().has('label', 'component').has('hash', hash).id()
  assert.equal(componentIdsBefore.length, 1)
  const componentId = componentIdsBefore[0]
  const tasksBefore = await g.V(componentId).out('has_task').id()
  const dataBefore = await g.V(componentId).out('has_data').id()

  let ack2 = false
  const message2 = { subject, json: () => ({ data: component }), ack: () => { ack2 = true } }
  const r2 = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { natsContext, g: graph.g, diagnostics },
  }).route(registerPath, registerSpec)

  await r2.request({ subject, message: message2 })

  const componentIdsAfter = await g.V().has('label', 'component').has('hash', hash).id()
  assert.equal(componentIdsAfter.length, 1, 'no duplicate component created')

  const tasksAfter = await g.V(componentId).out('has_task').id()
  const dataAfter = await g.V(componentId).out('has_data').id()
  assert.equal(tasksAfter.length, tasksBefore.length, 'no duplicate tasks added')
  assert.equal(dataAfter.length, dataBefore.length, 'no duplicate data added')
})

