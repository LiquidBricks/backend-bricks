import test from 'node:test'
import assert from 'node:assert/strict'

import { Graph } from '@liquid-bricks/nats-graph/graph'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { ulid } from 'ulid'

import { createComponentServiceRouter } from '../../../../../consumer/componentService/router.js'
import { dataMapper as createDataMapper, domain } from '../../../../../domain/index.js'
import { findDependencyFreeStates } from '../../../../../consumer/componentService/componentInstance/cmd/start/findDependencyFreeStates.js'
import { publishEvents as publishStartInstanceEvents }
  from '../../../../../consumer/componentService/componentInstance/cmd/start/publishEvents/index.js'
import { doesInstanceExist } from '../../../../../consumer/componentService/componentInstance/cmd/start/doesInstanceExist.js'
import { getStateMachine } from '../../../../../consumer/componentService/componentInstance/cmd/start/getStateMachine.js'
import { loadUsesImportInstances } from '../../../../../consumer/componentService/componentInstance/cmd/start/loadUsesImportInstances.js'
import { loadComponentImports } from '../../../../../consumer/componentService/componentInstance/cmd/create/loadComponentImports.js'
import { serviceConfiguration } from '../../../../../provider/serviceConfiguration/dotenv/index.js'

const { NATS_IP_ADDRESS } = serviceConfiguration()
assert.ok(NATS_IP_ADDRESS, 'NATS_IP_ADDRESS missing; set in test/.env')

const noop = () => { }
function makeDiagnosticsInstance() {
  return makeDiagnostics({
    logger: { info: noop, warn: noop, error: noop, debug: noop },
    metrics: { timing: noop, count: noop },
    sample: () => true,
    rateLimit: () => true,
  })
}

function createGraphContext() {
  const diagnostics = makeDiagnosticsInstance()
  const graph = Graph({
    kv: 'nats',
    kvConfig: { servers: NATS_IP_ADDRESS, bucket: `component-instance-start-${ulid()}` },
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

const registerSpec = getRegisterSpec()
const createInstanceSpec = getCreateInstanceSpec()
const startInstanceSpec = getStartInstanceSpec()

function createHandlerDiagnostics(diagnostics, scope = {}, message) {
  return diagnostics.child
    ? diagnostics.child({ router: { stage: 'unit-test' }, scope, message })
    : diagnostics
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

function getCreateInstanceSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'cmd'
    && values.entity === 'componentInstance'
    && values.action === 'create'
  )
  assert.ok(route, 'create route not found')
  return route.config
}

function getStartInstanceSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'cmd'
    && values.entity === 'componentInstance'
    && values.action === 'start'
  )
  assert.ok(route, 'start route not found')
  return route.config
}

async function registerComponent(component, ctx) {
  const handlerDiagnostics = createHandlerDiagnostics(ctx.diagnostics, { component })
  await registerSpec.handler({ rootCtx: ctx, scope: { handlerDiagnostics, component } })
}

async function createInstance(ctx, scope) {
  const handlerDiagnostics = createHandlerDiagnostics(ctx.diagnostics, scope)
  return createInstanceSpec.handler({ rootCtx: ctx, scope: { ...scope, handlerDiagnostics } })
}

async function startInstance(ctx, scope) {
  const handlerDiagnostics = createHandlerDiagnostics(ctx.diagnostics, scope)
  return startInstanceSpec.handler({ rootCtx: ctx, scope: { ...scope, handlerDiagnostics } })
}

async function loadImports({ g, componentId }) {
  const { imports = [] } = await loadComponentImports({ rootCtx: { g }, scope: { componentId } })
  return imports
}

async function getComponentId({ g, diagnostics, componentHash }) {
  const [componentId] = await g
    .V()
    .has('label', domain.vertex.component.constants.LABEL)
    .has('hash', componentHash)
    .id()
  diagnostics.require(
    componentId,
    diagnostics.DiagnosticError,
    `component not found for componentHash ${componentHash}`,
  )
  return componentId
}

function pickFirst(values) {
  if (Array.isArray(values)) return values[0]
  return values ?? null
}

async function getStateMachineIdForInstance({ g, instanceId }) {
  const [instanceVertexId] = await g
    .V()
    .has('label', domain.vertex.componentInstance.constants.LABEL)
    .has('instanceId', instanceId)
    .id()
  assert.ok(instanceVertexId, `componentInstance ${instanceId} missing`)

  const [stateMachineId] = await g
    .V(instanceVertexId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id()
  return { stateMachineId, instanceVertexId }
}

async function namesForStateEdges(g, edgeIds) {
  const names = []
  for (const edgeId of edgeIds ?? []) {
    const [row] = await g.E(edgeId).inV().valueMap('name')
    names.push(pickFirst(row?.name ?? row))
  }
  return names
}

test('handler marks stateMachine running and updates timestamp', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-start-running',
      name: 'StartRunningComponent',
      tasks: [],
      data: [],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-start-running'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineIdForInstance({ g, instanceId })
    const [initialState] = await g.V(stateMachineId).valueMap('state', 'updatedAt')
    const initialUpdatedAt = pickFirst(initialState.updatedAt)
    assert.equal(pickFirst(initialState.state), domain.vertex.stateMachine.constants.STATES.CREATED)

    await startInstance({ diagnostics, g }, { stateMachineId })

    const [stateRow] = await g.V(stateMachineId).valueMap('state', 'updatedAt')
    assert.equal(pickFirst(stateRow.state), domain.vertex.stateMachine.constants.STATES.RUNNING)
    assert.notEqual(pickFirst(stateRow.updatedAt), initialUpdatedAt)
  })
})

test('findDependencyFreeStates returns only nodes without dependencies', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-dependency-free',
      name: 'DependencyFreeComponent',
      tasks: [
        { name: 'taskIndependent', fnc: 'fnA', codeRef: { file: 'tA.js', line: 1, column: 1 }, deps: [] },
        { name: 'taskWithDep', fnc: 'fnB', codeRef: { file: 'tB.js', line: 2, column: 2 }, deps: ['data.inputData'] },
      ],
      data: [
        { name: 'inputData', fnc: 'fnData', codeRef: { file: 'dA.js', line: 3, column: 3 }, deps: [] },
        { name: 'derivedData', fnc: 'fnDerived', codeRef: { file: 'dB.js', line: 4, column: 4 }, deps: ['task.taskWithDep'] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-dependency-free'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineIdForInstance({ g, instanceId })
    const { dataStateIds, taskStateIds } = await findDependencyFreeStates({ rootCtx: { g }, scope: { stateMachineId } })

    const dataNames = await namesForStateEdges(g, dataStateIds)
    const taskNames = await namesForStateEdges(g, taskStateIds)

    assert.deepEqual(dataNames.sort(), ['inputData'])
    assert.deepEqual(taskNames.sort(), ['taskIndependent'])
  })
})

test('doesInstanceExist validates presence and loadUsesImportInstances returns import ids', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const sharedComponent = { hash: 'hash-import-shared', name: 'ImportShared', tasks: [], data: [] }
    const component = {
      hash: 'hash-import-parent',
      name: 'ImportParent',
      tasks: [],
      data: [],
      imports: [{ name: 'shared', hash: sharedComponent.hash }],
    }

    await registerComponent(sharedComponent, { diagnostics, dataMapper, g })
    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-with-import'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const [instanceVertexId] = await g
      .V()
      .has('label', domain.vertex.componentInstance.constants.LABEL)
      .has('instanceId', instanceId)
      .id()
    assert.ok(instanceVertexId, 'componentInstance vertex missing')

    const handlerDiagnostics = createHandlerDiagnostics(diagnostics, { instanceId })
    const exists = await doesInstanceExist({ rootCtx: { diagnostics, g }, scope: { handlerDiagnostics, instanceId } })
    assert.equal(exists.instanceVertexId, instanceVertexId)

    const { stateMachineId } = await getStateMachine({ rootCtx: { g }, scope: { instanceVertexId } })
    assert.ok(stateMachineId, 'stateMachine missing')

    await assert.rejects(
      doesInstanceExist({
        rootCtx: { diagnostics, g },
        scope: { handlerDiagnostics: createHandlerDiagnostics(diagnostics, { instanceId: 'missing-instance' }), instanceId: 'missing-instance' }
      }),
      diagnostics.DiagnosticError,
    )

    const importsHook = await loadUsesImportInstances({ rootCtx: { g }, scope: { instanceVertexId } })
    assert.equal(importsHook.usesImportInstanceIds.length, 1)

    const [importedInstanceRow] = await g
      .V(instanceVertexId)
      .out(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .valueMap('instanceId')
    const importedInstanceId = pickFirst(importedInstanceRow.instanceId)

    assert.deepEqual(importsHook.usesImportInstanceIds, [importedInstanceId])
  })
})

test('publishEvents starts dependency-free states, imports, and emits started', async () => {
  const instanceId = 'publish-events-instance'
  const dataStateIds = ['data-state-1', 'data-state-2']
  const taskStateIds = ['task-state-1']
  const usesImportInstanceIds = ['import-1', 'import-1', 'import-2']
  const published = []
  const natsContext = { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) }

  await publishStartInstanceEvents({
    rootCtx: { natsContext },
    scope: { instanceId, dataStateIds, taskStateIds, usesImportInstanceIds },
  })

  const startDataSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('data')
    .channel('cmd')
    .action('start')
    .version('v1')
    .build()
  const startTaskSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('task')
    .channel('cmd')
    .action('start')
    .version('v1')
    .build()
  const startInstanceSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('cmd')
    .action('start')
    .version('v1')
    .build()
  const startedSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('started')
    .version('v1')
    .build()

  const startDataEvents = published.filter(({ subject }) => subject === startDataSubject)
  assert.equal(startDataEvents.length, dataStateIds.length)
  assert.deepEqual(
    startDataEvents.map(({ payload }) => payload.data.stateId).sort(),
    dataStateIds.sort(),
  )
  assert.ok(startDataEvents.every(({ payload }) => payload.data.instanceId === instanceId))

  const startTaskEvents = published.filter(({ subject }) => subject === startTaskSubject)
  assert.equal(startTaskEvents.length, taskStateIds.length)
  assert.deepEqual(startTaskEvents.map(({ payload }) => payload.data.stateId), taskStateIds)
  assert.ok(startTaskEvents.every(({ payload }) => payload.data.instanceId === instanceId))

  const startInstanceEvents = published.filter(({ subject }) => subject === startInstanceSubject)
  assert.equal(startInstanceEvents.length, 2)
  assert.deepEqual(
    startInstanceEvents.map(({ payload }) => payload.data.instanceId).sort(),
    ['import-1', 'import-2'],
  )

  const startedEvents = published.filter(({ subject }) => subject === startedSubject)
  assert.equal(startedEvents.length, 1)
  assert.deepEqual(startedEvents[0].payload.data, { instanceId })
})
