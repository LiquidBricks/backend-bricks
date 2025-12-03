import test from 'node:test'
import assert from 'node:assert/strict'

import { Graph } from '@liquid-bricks/nats-graph/graph'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { ulid } from 'ulid'

import { createComponentServiceRouter } from '../../../../../consumer/componentService/router.js'
import { STATE_EDGE_LABEL_BY_TYPE, STATE_EDGE_STATUS_BY_TYPE } from '../../../../../consumer/componentService/componentInstance/evt/result_computed/constants.js'
import { validatePayload } from '../../../../../consumer/componentService/componentInstance/evt/result_computed/validatePayload.js'
import { loadComponentImports } from '../../../../../consumer/componentService/componentInstance/cmd/create/loadComponentImports.js'
import { dataMapper as createDataMapper, domain } from '../../../../../domain/index.js'
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
    kvConfig: { servers: NATS_IP_ADDRESS, bucket: `component-instance-result-${ulid()}` },
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
const resultComputedSpec = getResultComputedSpec()
const stateMachineCompletedSpec = getStateMachineCompletedSpec()
const startDependantsSpec = getStartDependantsSpec()

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

function getResultComputedSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'evt'
    && values.entity === 'componentInstance'
    && values.action === 'result_computed'
  )
  assert.ok(route, 'result_computed route not found')
  return route.config
}

function getStateMachineCompletedSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'evt'
    && values.entity === 'componentInstance'
    && values.action === 'state_machine_completed'
  )
  assert.ok(route, 'state_machine_completed route not found')
  return route.config
}

function getStartDependantsSpec() {
  const router = createComponentServiceRouter({
    natsContext: {},
    g: {},
    diagnostics: makeDiagnosticsInstance(),
    dataMapper: {},
  })
  const route = router.routes.find(({ values }) =>
    values.channel === 'cmd'
    && values.entity === 'componentInstance'
    && values.action === 'start_dependants'
  )
  assert.ok(route, 'start_dependants route not found')
  return route.config
}

function createHandlerDiagnostics(diagnostics, scope = {}, message) {
  return diagnostics.child
    ? diagnostics.child({ router: { stage: 'unit-test' }, scope, message })
    : diagnostics
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

async function getStateMachineId({ g, instanceId }) {
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

async function getStateEdgeId({ g, stateMachineId, type, name }) {
  const [stateEdgeId] = await g
    .V(stateMachineId)
    .outE(STATE_EDGE_LABEL_BY_TYPE[type])
    .filter(_ => _.inV().has('name', name))
    .id()
  return stateEdgeId
}

async function getImportedInstance({ g, rootInstanceVertexId, aliasPath }) {
  let current = rootInstanceVertexId
  for (const alias of aliasPath) {
    const [next] = await g
      .V(current)
      .outE(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .has('alias', alias)
      .inV()
      .id()
    current = next
  }
  return current
}

async function runSpec({ spec, rootCtx, message, initialScope = {} }) {
  const messagePayload = initialScope.handlerDiagnostics ? undefined : message?.json?.()
  const handlerDiagnostics = initialScope.handlerDiagnostics
    ?? createHandlerDiagnostics(rootCtx?.diagnostics, initialScope, messagePayload)
  let scope = { handlerDiagnostics, ...initialScope }

  const runStep = async (fn) => {
    const result = await fn({ message, rootCtx, scope })
    if (result && typeof result === 'object') {
      scope = { ...scope, ...result }
    }
  }

  for (const decode of spec.decode ?? []) {
    await runStep(decode)
  }
  for (const pre of spec.pre ?? []) {
    await runStep(pre)
  }
  await runStep(spec.handler)
  for (const post of spec.post ?? []) {
    await runStep(post)
  }

  return scope
}

test('result_computed stores state result, marks status provided, and publishes start_dependants', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-result-computed',
      name: 'ResultComputedComponent',
      tasks: [],
      data: [
        { name: 'dataInput', fnc: 'fnData', codeRef: { file: 'dA.js', line: 1, column: 1 }, deps: [] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-result-computed'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineId({ g, instanceId })
    const [stateEdgeId] = await g
      .V(stateMachineId)
      .outE(domain.edge.has_data_state.stateMachine_data.constants.LABEL)
      .filter(_ => _.inV().has('name', component.data[0].name))
      .id()
    assert.ok(stateEdgeId, 'data state edge missing')

    const [initialValues] = await g.E(stateEdgeId).valueMap('status', 'result', 'updatedAt')
    const initialUpdatedAt = pickFirst(initialValues?.updatedAt)
    assert.ok(initialUpdatedAt, 'initial updatedAt missing')

    const published = []
    let acked = false
    const message = {
      subject: createBasicSubject()
        .env('prod')
        .ns('component-service')
        .entity('componentInstance')
        .channel('evt')
        .action('result_computed')
        .version('v1')
        .build(),
      ack: () => { acked = true },
      json: () => ({
        data: {
          instanceId,
          type: 'data',
          name: component.data[0].name,
          result: { count: 2 },
        }
      }),
    }
    const rootCtx = {
      diagnostics,
      g,
      dataMapper,
      natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
    }

    const finalScope = await runSpec({ spec: resultComputedSpec, rootCtx, message })

    assert.equal(finalScope.stateEdgeId, stateEdgeId)
    assert.equal(acked, true)

    const [updatedValues] = await g.E(stateEdgeId).valueMap('status', 'result', 'updatedAt')
    assert.equal(pickFirst(updatedValues.status), STATE_EDGE_STATUS_BY_TYPE.data)
    assert.equal(pickFirst(updatedValues.result), JSON.stringify({ count: 2 }))
    assert.notEqual(pickFirst(updatedValues.updatedAt), initialUpdatedAt)

    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()
    const completionSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('state_machine_completed')
      .version('v1')
      .build()

    const startDependantsEvents = published.filter(p => p.subject === startDependantsSubject)
    assert.equal(startDependantsEvents.length, 1)
    assert.deepEqual(startDependantsEvents[0].payload.data, { instanceId, stateEdgeId, type: 'data' })

    const completionEvents = published.filter(p => p.subject === completionSubject)
    assert.equal(completionEvents.length, 1)
    assert.deepEqual(completionEvents[0].payload.data, { instanceId, stateMachineId })
  })
})

test('result_computed publishes injected result_computed events for injection targets', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-result-injection',
      name: 'ResultInjectionComponent',
      tasks: [
        { name: 'taskB', fnc: 'fnTaskB', codeRef: { file: 'tB.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [
        { name: 'dataSource', fnc: 'fnDataSrc', codeRef: { file: 'dSrc.js', line: 2, column: 2 }, deps: [], inject: ['data.dataTarget', 'task.taskB'] },
        { name: 'dataTarget', fnc: 'fnDataTarget', codeRef: { file: 'dTarget.js', line: 3, column: 3 }, deps: [] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-result-injection'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineId({ g, instanceId })
    const sourceEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'data', name: 'dataSource' })
    const dataTargetStateEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'data', name: 'dataTarget' })
    const taskTargetStateEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'task', name: 'taskB' })

    assert.ok(sourceEdgeId, 'source data state edge missing')
    assert.ok(dataTargetStateEdgeId, 'dataTarget state edge missing')
    assert.ok(taskTargetStateEdgeId, 'taskB state edge missing')

    const published = []
    let acked = false
    const resultPayload = { injected: true }
    const message = {
      subject: createBasicSubject()
        .env('prod')
        .ns('component-service')
        .entity('componentInstance')
        .channel('evt')
        .action('result_computed')
        .version('v1')
        .build(),
      ack: () => { acked = true },
      json: () => ({
        data: {
          instanceId,
          type: 'data',
          name: 'dataSource',
          result: resultPayload,
        }
      }),
    }
    const rootCtx = {
      diagnostics,
      g,
      dataMapper,
      natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
    }

    const finalScope = await runSpec({ spec: resultComputedSpec, rootCtx, message })

    assert.equal(finalScope.stateEdgeId, sourceEdgeId)
    assert.equal(acked, true)

    const [updatedValues] = await g.E(sourceEdgeId).valueMap('status', 'result')
    assert.equal(pickFirst(updatedValues.status), STATE_EDGE_STATUS_BY_TYPE.data)
    assert.equal(pickFirst(updatedValues.result), JSON.stringify(resultPayload))

    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()
    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()

    const injectedEvents = published.filter(p => p.subject === resultComputedSubject)
    const startDependantsEvents = published.filter(p => p.subject === startDependantsSubject)

    assert.equal(startDependantsEvents.length, 1)
    assert.deepEqual(startDependantsEvents[0].payload.data, { instanceId, stateEdgeId: sourceEdgeId, type: 'data' })

    const injectedPayloads = injectedEvents
      .map(evt => evt.payload.data)
      .sort((a, b) => a.name.localeCompare(b.name))

    assert.equal(injectedPayloads.length, 2)
    assert.deepEqual(injectedPayloads, [
      { instanceId, stateId: dataTargetStateEdgeId, name: 'dataTarget', type: 'data', result: resultPayload },
      { instanceId, stateId: taskTargetStateEdgeId, name: 'taskB', type: 'task', result: resultPayload },
    ])
  })
})

test('result_computed publishes injected result_computed to imported component instance targets', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const childComponent = {
      hash: 'hash-injected-child',
      name: 'InjectedChild',
      tasks: [],
      data: [
        { name: 'childData', fnc: 'fnChild', codeRef: { file: 'c.js', line: 1, column: 1 }, deps: [] },
      ],
    }
    const rootComponent = {
      hash: 'hash-injected-root',
      name: 'InjectedRoot',
      imports: [{ name: 'child', hash: childComponent.hash }],
      tasks: [],
      data: [
        { name: 'rootData', fnc: 'fnRoot', codeRef: { file: 'r.js', line: 1, column: 1 }, deps: [], inject: ['child.data.childData'] },
      ],
    }

    await registerComponent(childComponent, { diagnostics, dataMapper, g })
    await registerComponent(rootComponent, { diagnostics, dataMapper, g })

    const rootInstanceId = 'instance-injected-root'
    const rootComponentId = await getComponentId({ g, diagnostics, componentHash: rootComponent.hash })
    const imports = await loadImports({ g, rootComponentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: rootComponent.hash, componentId: rootComponentId, instanceId: rootInstanceId, imports })

    const { stateMachineId: rootStateMachineId, instanceVertexId: rootInstanceVertexId } = await getStateMachineId({ g, instanceId: rootInstanceId })
    const rootDataStateEdgeId = await getStateEdgeId({ g, stateMachineId: rootStateMachineId, type: 'data', name: 'rootData' })
    assert.ok(rootDataStateEdgeId, 'root data state edge missing')

    const childInstanceVertexId = await getImportedInstance({ g, rootInstanceVertexId, aliasPath: ['child'] })
    assert.ok(childInstanceVertexId, 'child instance missing')

    const [childInstanceIdValues] = await g.V(childInstanceVertexId).valueMap('instanceId')
    const childInstanceId = pickFirst(childInstanceIdValues?.instanceId ?? childInstanceIdValues)
    assert.ok(childInstanceId, 'child instanceId missing')

    const [childStateMachineId] = await g.V(childInstanceVertexId).out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL).id()
    const childDataStateEdgeId = await getStateEdgeId({ g, stateMachineId: childStateMachineId, type: 'data', name: 'childData' })

    const published = []
    let acked = false
    const resultPayload = { sentToImport: true }
    const message = {
      subject: createBasicSubject()
        .env('prod')
        .ns('component-service')
        .entity('componentInstance')
        .channel('evt')
        .action('result_computed')
        .version('v1')
        .build(),
      ack: () => { acked = true },
      json: () => ({
        data: {
          instanceId: rootInstanceId,
          type: 'data',
          name: 'rootData',
          result: resultPayload,
        }
      }),
    }
    const rootCtx = {
      diagnostics,
      g,
      dataMapper,
      natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
    }

    const finalScope = await runSpec({ spec: resultComputedSpec, rootCtx, message })
    assert.equal(finalScope.stateEdgeId, rootDataStateEdgeId)
    assert.equal(acked, true)

    const [updatedValues] = await g.E(rootDataStateEdgeId).valueMap('status', 'result')
    assert.equal(pickFirst(updatedValues.status), STATE_EDGE_STATUS_BY_TYPE.data)
    assert.equal(pickFirst(updatedValues.result), JSON.stringify(resultPayload))

    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()
    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()

    const injectedEvents = published.filter(p => p.subject === resultComputedSubject)
    const startDependantsEvents = published.filter(p => p.subject === startDependantsSubject)

    assert.equal(startDependantsEvents.length, 1)
    assert.deepEqual(startDependantsEvents[0].payload.data, { instanceId: rootInstanceId, stateEdgeId: rootDataStateEdgeId, type: 'data' })

    assert.equal(injectedEvents.length, 1)
    assert.deepEqual(injectedEvents[0].payload.data, {
      instanceId: childInstanceId,
      stateId: childDataStateEdgeId,
      name: 'childData',
      type: 'data',
      result: resultPayload,
    })
  })
})

test('injected result triggers dependant data and task start commands', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-injected-dependants',
      name: 'InjectedDependants',
      tasks: [
        { name: 'taskDependent', fnc: 'fnTaskDep', codeRef: { file: 'tDep.js', line: 1, column: 1 }, deps: ['data.dataTarget'] },
      ],
      data: [
        { name: 'dataSource', fnc: 'fnDataSrc', codeRef: { file: 'dSrc.js', line: 1, column: 1 }, deps: [], inject: ['data.dataTarget'] },
        { name: 'dataTarget', fnc: 'fnDataTarget', codeRef: { file: 'dTarget.js', line: 2, column: 2 }, deps: [] },
        { name: 'dataDependent', fnc: 'fnDataDep', codeRef: { file: 'dDep.js', line: 3, column: 3 }, deps: ['data.dataTarget'] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-injected-dependants'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineId({ g, instanceId })
    const dataTargetStateEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'data', name: 'dataTarget' })
    const dependantDataStateEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'data', name: 'dataDependent' })
    const dependantTaskStateEdgeId = await getStateEdgeId({ g, stateMachineId, type: 'task', name: 'taskDependent' })

    assert.ok(dataTargetStateEdgeId, 'dataTarget state edge missing')
    assert.ok(dependantDataStateEdgeId, 'dataDependent state edge missing')
    assert.ok(dependantTaskStateEdgeId, 'taskDependent state edge missing')

    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()
    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()
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

    // Step 1: handle source result_computed event that injects into dataTarget
    const initialPublishes = []
    const initialMessage = {
      subject: resultComputedSubject,
      ack: () => { },
      json: () => ({
        data: {
          instanceId,
          type: 'data',
          name: 'dataSource',
          result: { injected: true },
        }
      }),
    }
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => initialPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: initialMessage,
    })

    const injectedEvent = initialPublishes.find(p => p.subject === resultComputedSubject && p.payload?.data?.name === 'dataTarget')
    assert.ok(injectedEvent, 'injected result for dataTarget not published')

    // Step 2: process injected result for dataTarget and capture start_dependants command
    const injectedPublishes = []
    let injectedAcked = false
    const injectedMessage = {
      subject: resultComputedSubject,
      ack: () => { injectedAcked = true },
      json: () => injectedEvent.payload,
    }
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => injectedPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: injectedMessage,
    })
    assert.equal(injectedAcked, true)

    const targetStartDependants = injectedPublishes.filter(p => p.subject === startDependantsSubject)
    assert.equal(targetStartDependants.length, 1)
    assert.deepEqual(targetStartDependants[0].payload.data, { instanceId, stateEdgeId: dataTargetStateEdgeId, type: 'data' })

    // Step 3: run start_dependants to trigger dependant starts
    const dependantPublishes = []
    let startAcked = false
    const startDependantsMessage = {
      subject: startDependantsSubject,
      ack: () => { startAcked = true },
      json: () => targetStartDependants[0].payload,
    }
    await runSpec({
      spec: startDependantsSpec,
      rootCtx: {
        diagnostics,
        g,
        natsContext: { publish: async (subject, payload) => dependantPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: startDependantsMessage,
    })
    assert.equal(startAcked, true)

    const startDataEvents = dependantPublishes.filter(p => p.subject === startDataSubject)
    const startTaskEvents = dependantPublishes.filter(p => p.subject === startTaskSubject)

    assert.equal(startDataEvents.length, 1)
    assert.equal(startTaskEvents.length, 1)
    assert.deepEqual(startDataEvents[0].payload.data, { instanceId, stateId: dependantDataStateEdgeId })
    assert.deepEqual(startTaskEvents[0].payload.data, { instanceId, stateId: dependantTaskStateEdgeId })
  })
})

test('imported injection triggers dependant starts inside imported component', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const childComponent = {
      hash: 'hash-imported-dependants-child',
      name: 'ImportedDependantsChild',
      tasks: [
        { name: 'childTaskDep', fnc: 'fnChildTask', codeRef: { file: 'ct.js', line: 1, column: 1 }, deps: ['data.childTarget'] },
      ],
      data: [
        { name: 'childTarget', fnc: 'fnChildTarget', codeRef: { file: 'ctar.js', line: 1, column: 1 }, deps: [] },
        { name: 'childDataDep', fnc: 'fnChildDep', codeRef: { file: 'cd.js', line: 2, column: 2 }, deps: ['data.childTarget'] },
      ],
    }
    const rootComponent = {
      hash: 'hash-imported-dependants-root',
      name: 'ImportedDependantsRoot',
      imports: [{ name: 'child', hash: childComponent.hash }],
      tasks: [],
      data: [
        { name: 'rootData', fnc: 'fnRoot', codeRef: { file: 'r.js', line: 1, column: 1 }, deps: [], inject: ['child.data.childTarget'] },
      ],
    }

    await registerComponent(childComponent, { diagnostics, dataMapper, g })
    await registerComponent(rootComponent, { diagnostics, dataMapper, g })

    const rootInstanceId = 'instance-imported-dependants-root'
    const rootComponentId = await getComponentId({ g, diagnostics, componentHash: rootComponent.hash })
    const imports = await loadImports({ g, rootComponentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: rootComponent.hash, componentId: rootComponentId, instanceId: rootInstanceId, imports })

    const { instanceVertexId: rootInstanceVertexId, stateMachineId: rootStateMachineId } = await getStateMachineId({ g, instanceId: rootInstanceId })
    const rootDataStateEdgeId = await getStateEdgeId({ g, stateMachineId: rootStateMachineId, type: 'data', name: 'rootData' })

    const childInstanceVertexId = await getImportedInstance({ g, rootInstanceVertexId, aliasPath: ['child'] })
    assert.ok(childInstanceVertexId, 'child instance missing')
    const [childInstanceIdValues] = await g.V(childInstanceVertexId).valueMap('instanceId')
    const childInstanceId = pickFirst(childInstanceIdValues?.instanceId ?? childInstanceIdValues)
    const [childStateMachineId] = await g.V(childInstanceVertexId).out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL).id()

    const childTargetStateEdgeId = await getStateEdgeId({ g, stateMachineId: childStateMachineId, type: 'data', name: 'childTarget' })
    const childDepDataStateEdgeId = await getStateEdgeId({ g, stateMachineId: childStateMachineId, type: 'data', name: 'childDataDep' })
    const childDepTaskStateEdgeId = await getStateEdgeId({ g, stateMachineId: childStateMachineId, type: 'task', name: 'childTaskDep' })

    assert.ok(rootDataStateEdgeId, 'root data state edge missing')
    assert.ok(childTargetStateEdgeId, 'child target state edge missing')
    assert.ok(childDepDataStateEdgeId, 'child data dependant state edge missing')
    assert.ok(childDepTaskStateEdgeId, 'child task dependant state edge missing')

    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()
    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()
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

    // Step 1: process root data result, expecting injected event for childTarget
    const initialPublishes = []
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => initialPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: resultComputedSubject,
        ack: () => { },
        json: () => ({
          data: {
            instanceId: rootInstanceId,
            type: 'data',
            name: 'rootData',
            result: { injected: 'child' },
          }
        }),
      },
    })

    const injectedEvent = initialPublishes.find(p =>
      p.subject === resultComputedSubject
      && p.payload?.data?.instanceId === childInstanceId
      && p.payload?.data?.name === 'childTarget'
    )
    assert.ok(injectedEvent, 'injected result for childTarget not published')

    // Step 2: process injected child result and capture its start_dependants
    const injectedPublishes = []
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => injectedPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: resultComputedSubject,
        ack: () => { },
        json: () => injectedEvent.payload,
      },
    })

    const childStartDependants = injectedPublishes.filter(p => p.subject === startDependantsSubject)
    assert.equal(childStartDependants.length, 1)
    assert.deepEqual(childStartDependants[0].payload.data, { instanceId: childInstanceId, stateEdgeId: childTargetStateEdgeId, type: 'data' })

    // Step 3: run start_dependants for child target and ensure dependants start
    const dependantPublishes = []
    await runSpec({
      spec: startDependantsSpec,
      rootCtx: {
        diagnostics,
        g,
        natsContext: { publish: async (subject, payload) => dependantPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: startDependantsSubject,
        ack: () => { },
        json: () => childStartDependants[0].payload,
      },
    })

    const startDataEvents = dependantPublishes.filter(p => p.subject === startDataSubject)
    const startTaskEvents = dependantPublishes.filter(p => p.subject === startTaskSubject)
    assert.equal(startDataEvents.length, 1)
    assert.equal(startTaskEvents.length, 1)
    assert.deepEqual(startDataEvents[0].payload.data, { instanceId: childInstanceId, stateId: childDepDataStateEdgeId })
    assert.deepEqual(startTaskEvents[0].payload.data, { instanceId: childInstanceId, stateId: childDepTaskStateEdgeId })
  })
})

test('result_computed triggers parent dependant starts across imports', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const childComponent = {
      hash: 'hash-parent-dependant-child',
      name: 'ParentDependantsChild',
      tasks: [],
      data: [
        { name: 'childTarget', fnc: 'fnChildTarget', codeRef: { file: 'child-target.js', line: 1, column: 1 }, deps: [] },
      ],
    }
    const parentComponent = {
      hash: 'hash-parent-dependant-root',
      name: 'ParentDependantsRoot',
      imports: [{ name: 'child', hash: childComponent.hash }],
      tasks: [
        { name: 'parentTask', fnc: 'fnParentTask', codeRef: { file: 'parent-task.js', line: 1, column: 1 }, deps: ['child.data.childTarget'] },
      ],
      data: [
        { name: 'parentData', fnc: 'fnParentData', codeRef: { file: 'parent-data.js', line: 2, column: 2 }, deps: ['child.data.childTarget'] },
      ],
    }

    await registerComponent(childComponent, { diagnostics, dataMapper, g })
    await registerComponent(parentComponent, { diagnostics, dataMapper, g })

    const parentInstanceId = 'instance-parent-dependants'
    const parentComponentId = await getComponentId({ g, diagnostics, componentHash: parentComponent.hash })
    const imports = await loadImports({ g, parentComponentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: parentComponent.hash, componentId: parentComponentId, instanceId: parentInstanceId, imports })

    const { stateMachineId: parentStateMachineId, instanceVertexId: parentInstanceVertexId } = await getStateMachineId({ g, instanceId: parentInstanceId })
    const parentDataStateEdgeId = await getStateEdgeId({ g, stateMachineId: parentStateMachineId, type: 'data', name: 'parentData' })
    const parentTaskStateEdgeId = await getStateEdgeId({ g, stateMachineId: parentStateMachineId, type: 'task', name: 'parentTask' })

    const childInstanceVertexId = await getImportedInstance({ g, rootInstanceVertexId: parentInstanceVertexId, aliasPath: ['child'] })
    assert.ok(childInstanceVertexId, 'child instance missing')
    const [childInstanceIdValues] = await g.V(childInstanceVertexId).valueMap('instanceId')
    const childInstanceId = pickFirst(childInstanceIdValues?.instanceId ?? childInstanceIdValues)

    const published = []
    let resultAcked = false
    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()

    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: resultComputedSubject,
        ack: () => { resultAcked = true },
        json: () => ({
          data: {
            instanceId: childInstanceId,
            type: 'data',
            name: 'childTarget',
            result: { triggered: 'parent' },
          }
        }),
      },
    })
    assert.equal(resultAcked, true)

    const startDependantsSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action('start_dependants')
      .version('v1')
      .build()

    const startDependantsEvents = published.filter(p => p.subject === startDependantsSubject)
    assert.equal(startDependantsEvents.length, 1)

    const dependantPublishes = []
    let startAcked = false
    const startDependantsMessage = {
      subject: startDependantsSubject,
      ack: () => { startAcked = true },
      json: () => startDependantsEvents[0].payload,
    }
    await runSpec({
      spec: startDependantsSpec,
      rootCtx: {
        diagnostics,
        g,
        natsContext: { publish: async (subject, payload) => dependantPublishes.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: startDependantsMessage,
    })
    assert.equal(startAcked, true)

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

    const startDataEvents = dependantPublishes.filter(p => p.subject === startDataSubject)
    const startTaskEvents = dependantPublishes.filter(p => p.subject === startTaskSubject)

    assert.equal(startDataEvents.length, 1)
    assert.equal(startTaskEvents.length, 1)
    assert.deepEqual(startDataEvents[0].payload.data, { instanceId: parentInstanceId, stateId: parentDataStateEdgeId })
    assert.deepEqual(startTaskEvents[0].payload.data, { instanceId: parentInstanceId, stateId: parentTaskStateEdgeId })
  })
})

test('stateMachine state switches to complete once all states are provided', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-state-complete',
      name: 'StateCompleteComponent',
      tasks: [
        { name: 'finalTask', fnc: 'fnTask', codeRef: { file: 'tComplete.js', line: 1, column: 1 }, deps: ['data.inputData'] },
      ],
      data: [
        { name: 'inputData', fnc: 'fnInput', codeRef: { file: 'dComplete.js', line: 1, column: 1 }, deps: [] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'instance-state-complete'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const { stateMachineId } = await getStateMachineId({ g, instanceId })
    await startInstance({ diagnostics, g }, { stateMachineId })

    const published = []
    const resultComputedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('result_computed')
      .version('v1')
      .build()

    let dataAcked = false
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: resultComputedSubject,
        ack: () => { dataAcked = true },
        json: () => ({
          data: {
            instanceId,
            type: 'data',
            name: 'inputData',
            result: { provided: 'data' },
          }
        }),
      },
    })
    assert.equal(dataAcked, true)

    const [runningState] = await g.V(stateMachineId).valueMap('state')
    assert.equal(pickFirst(runningState.state), domain.vertex.stateMachine.constants.STATES.RUNNING)

    let taskAcked = false
    await runSpec({
      spec: resultComputedSpec,
      rootCtx: {
        diagnostics,
        g,
        dataMapper,
        natsContext: { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) },
      },
      message: {
        subject: resultComputedSubject,
        ack: () => { taskAcked = true },
        json: () => ({
          data: {
            instanceId,
            type: 'task',
            name: 'finalTask',
            result: { provided: 'task' },
          }
        }),
      },
    })
    assert.equal(taskAcked, true)

    const stateMachineCompletedSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('state_machine_completed')
      .version('v1')
      .build()
    const completionEvent = published.find(p => p.subject === stateMachineCompletedSubject)
    assert.ok(completionEvent, 'state_machine_completed event not published')

    let completionAcked = false
    await runSpec({
      spec: stateMachineCompletedSpec,
      rootCtx: { diagnostics, g, dataMapper },
      message: {
        subject: stateMachineCompletedSubject,
        ack: () => { completionAcked = true },
        json: () => completionEvent.payload,
      },
    })
    assert.equal(completionAcked, true)

    const [completedState] = await g.V(stateMachineId).valueMap('state')
    assert.equal(pickFirst(completedState.state), domain.vertex.stateMachine.constants.STATES.COMPLETE)
  })
})

test('validatePayload rejects unknown result type', () => {
  const diagnostics = makeDiagnosticsInstance()
  const handlerDiagnostics = createHandlerDiagnostics(diagnostics, { instanceId: 'i-1', type: 'unknown', name: 'x' })
  assert.throws(
    () => validatePayload({ scope: { handlerDiagnostics, instanceId: 'i-1', type: 'unknown', name: 'x' }, rootCtx: { diagnostics } }),
    diagnostics.DiagnosticError,
  )
})
