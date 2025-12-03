import test from 'node:test'
import assert from 'node:assert/strict'

import { Graph } from '@liquid-bricks/nats-graph/graph'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { ulid } from 'ulid'

import { createComponentServiceRouter } from '../../../../../consumer/componentService/router.js'
import { dataMapper as createDataMapper, domain } from '../../../../../domain/index.js'
import { publishEvents as publishCreateInstanceEvents } from '../../../../../consumer/componentService/componentInstance/cmd/create/publishEvents/index.js'
import { publishEvents as publishStartInstanceEvents } from '../../../../../consumer/componentService/componentInstance/cmd/start/publishEvents/index.js'
import { loadUsesImportInstances } from '../../../../../consumer/componentService/componentInstance/cmd/start/loadUsesImportInstances.js'
import { loadComponentImports } from '../../../../../consumer/componentService/componentInstance/cmd/create/loadComponentImports.js'
import { serviceConfiguration } from '../../../../../provider/serviceConfiguration/dotenv/index.js'

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
    kvConfig: { servers: NATS_IP_ADDRESS, bucket: `component-instance-create-${ulid()}` },
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

async function registerComponent(component, ctx) {
  const handlerDiagnostics = createHandlerDiagnostics(ctx.diagnostics, { component })
  await registerSpec.handler({ rootCtx: ctx, scope: { handlerDiagnostics, component } })
}

async function createInstance(ctx, scope) {
  const handlerDiagnostics = createHandlerDiagnostics(ctx.diagnostics, scope)
  return createInstanceSpec.handler({ rootCtx: ctx, scope: { ...scope, handlerDiagnostics } })
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

test('handler creates componentInstance stateMachine and links data/task states', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-state-machine',
      name: 'ComponentStateMachine',
      tasks: [
        { name: 'taskA', fnc: 'fnA', codeRef: { file: 'tA.js', line: 1, column: 1 }, deps: [] },
        { name: 'taskB', fnc: 'fnB', codeRef: { file: 'tB.js', line: 2, column: 2 }, deps: [] },
      ],
      data: [
        { name: 'dataA', fnc: 'fnData', codeRef: { file: 'dA.js', line: 3, column: 3 }, deps: [] },
      ],
    }

    await registerComponent(component, { diagnostics, dataMapper, g })


    const [componentId] = await g
      .V()
      .has('label', domain.vertex.component.constants.LABEL)
      .has('hash', component.hash)
      .id()
    const instanceId = 'instance-state-machine'
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const [instanceVertexId] = await g
      .V()
      .has('label', domain.vertex.componentInstance.constants.LABEL)
      .has('instanceId', instanceId)
      .id()
    assert.ok(instanceVertexId, 'componentInstance vertex missing')

    const instanceOfIds = await g
      .V(instanceVertexId)
      .out(domain.edge.instance_of.componentInstance_component.constants.LABEL)
      .id()
    assert.deepEqual(instanceOfIds, [componentId])

    const [stateMachineId] = await g
      .V(instanceVertexId)
      .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
      .id()
    assert.ok(stateMachineId, 'stateMachine vertex missing')

    const componentDataIds = await g
      .V(componentId)
      .out(domain.edge.has_data.component_data.constants.LABEL)
      .id()
    const componentTaskIds = await g
      .V(componentId)
      .out(domain.edge.has_task.component_task.constants.LABEL)
      .id()

    const stateMachineDataIds = await g
      .V(stateMachineId)
      .out(domain.edge.has_data_state.stateMachine_data.constants.LABEL)
      .id()
    assert.deepEqual(stateMachineDataIds.sort(), componentDataIds.sort())

    const stateMachineTaskIds = await g
      .V(stateMachineId)
      .out(domain.edge.has_task_state.stateMachine_task.constants.LABEL)
      .id()
    assert.deepEqual(stateMachineTaskIds.sort(), componentTaskIds.sort())
  })
})

test('create builds componentInstances for imports and links with uses_import', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const sharedComponent = { hash: 'shared-hash', name: 'SharedComponent', tasks: [], data: [] }
    const component = {
      hash: 'parent-hash',
      name: 'ParentComponent',
      tasks: [],
      data: [],
      imports: [{ name: 'shared', hash: sharedComponent.hash }],
    }

    await registerComponent(sharedComponent, { diagnostics, dataMapper, g })
    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'parent-instance'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const [parentInstanceVertexId] = await g
      .V()
      .has('label', domain.vertex.componentInstance.constants.LABEL)
      .has('instanceId', instanceId)
      .id()
    assert.ok(parentInstanceVertexId, 'parent componentInstance missing')

    const importedInstanceVertexIds = await g
      .V(parentInstanceVertexId)
      .out(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .id()
    assert.equal(importedInstanceVertexIds.length, 1, 'uses_import edge not created')

    const [importedInstanceVertexId] = importedInstanceVertexIds
    const [importEdgeValues] = await g
      .V(parentInstanceVertexId)
      .outE(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .valueMap('alias')
    const aliasValue = Array.isArray(importEdgeValues.alias) ? importEdgeValues.alias[0] : importEdgeValues.alias
    assert.equal(aliasValue, component.imports[0].name)

    const [importedInstanceRow] = await g.V(importedInstanceVertexId).valueMap('instanceId')
    const importedInstanceId = Array.isArray(importedInstanceRow.instanceId)
      ? importedInstanceRow.instanceId[0]
      : importedInstanceRow.instanceId
    assert.ok(importedInstanceId, 'imported componentInstance missing instanceId')

    const [sharedComponentId] = await g
      .V()
      .has('label', domain.vertex.component.constants.LABEL)
      .has('hash', sharedComponent.hash)
      .id()
    const importedComponentIds = await g
      .V(importedInstanceVertexId)
      .out(domain.edge.instance_of.componentInstance_component.constants.LABEL)
      .id()
    assert.deepEqual(importedComponentIds, [sharedComponentId])

    const [stateMachineId] = await g
      .V(importedInstanceVertexId)
      .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
      .id()
    assert.ok(stateMachineId, 'imported componentInstance missing stateMachine')
  })
})

test('handler rejects when componentHash is not registered', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    await assert.rejects((async () => {
      const componentHash = 'missing-component'
      const componentId = await getComponentId({ g, diagnostics, componentHash })
      await createInstance({ diagnostics, dataMapper, g }, { componentHash, componentId, instanceId: 'missing-instance' })
    })(), diagnostics.DiagnosticError)
  })
})

test('create handles multiple imports of the same component hash with unique aliases', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const sharedComponent = { hash: 'shared-hash-multi', name: 'SharedComponentMulti', tasks: [], data: [] }
    const component = {
      hash: 'parent-hash-multi',
      name: 'ParentComponentMulti',
      tasks: [],
      data: [],
      imports: [
        { name: 'shared-a', hash: sharedComponent.hash },
        { name: 'shared-b', hash: sharedComponent.hash },
      ],
    }

    await registerComponent(sharedComponent, { diagnostics, dataMapper, g })
    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'parent-instance-multi'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    const { importedInstances } = await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const [parentInstanceVertexId] = await g
      .V()
      .has('label', domain.vertex.componentInstance.constants.LABEL)
      .has('instanceId', instanceId)
      .id()
    assert.ok(parentInstanceVertexId, 'parent componentInstance missing')

    const importEdgeValues = await g
      .V(parentInstanceVertexId)
      .outE(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .valueMap('alias')

    const importAliases = importEdgeValues
      .map((values) => Array.isArray(values.alias) ? values.alias[0] : values.alias)
      .sort()
    const expectedAliases = component.imports.map(({ name }) => name).sort()

    assert.deepEqual(importAliases, expectedAliases, 'uses_import edges missing expected aliases')
    assert.equal(importAliases.length, component.imports.length, 'missing uses_import edges')
    assert.deepEqual(
      importedInstances.map(({ alias }) => alias).sort(),
      expectedAliases,
      'handler returned incorrect imports',
    )
  })
})

test('publishEvents does not start imported componentInstances after creation', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const sharedComponent = { hash: 'shared-hash-two', name: 'SharedComponentTwo', tasks: [], data: [] }
    const component = {
      hash: 'parent-hash-two',
      name: 'ParentComponentTwo',
      tasks: [],
      data: [],
      imports: [{ name: 'shared', hash: sharedComponent.hash }],
    }

    await registerComponent(sharedComponent, { diagnostics, dataMapper, g })
    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'parent-instance-two'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    const handlerResult = await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })
    const scope = { componentHash: component.hash, instanceId, ...handlerResult }

    const published = []
    const natsContext = { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) }

    await publishCreateInstanceEvents({ rootCtx: { natsContext }, scope })

    const createSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('evt')
      .action('created')
      .version('v1')
      .build()

    const createEvents = published.filter(({ subject }) => subject === createSubject)
    assert.equal(createEvents.length, 1)
    assert.deepEqual(createEvents[0].payload.data, { instanceId, componentHash: component.hash })
    assert.equal(handlerResult.importedInstances.length, component.imports.length)

    const startCommands = published.filter(({ subject }) => subject.includes('.cmd.componentInstance.start.'))
    assert.equal(startCommands.length, 0, 'start commands should not be published during creation')
  })
})

test('start publishes start commands for uses_import componentInstances', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const sharedComponent = { hash: 'shared-hash-three', name: 'SharedComponentThree', tasks: [], data: [] }
    const component = {
      hash: 'parent-hash-three',
      name: 'ParentComponentThree',
      tasks: [],
      data: [],
      imports: [{ name: 'shared', hash: sharedComponent.hash }],
    }

    await registerComponent(sharedComponent, { diagnostics, dataMapper, g })
    await registerComponent(component, { diagnostics, dataMapper, g })

    const instanceId = 'parent-instance-three'
    const componentId = await getComponentId({ g, diagnostics, componentHash: component.hash })
    const imports = await loadImports({ g, componentId })
    const handlerResult = await createInstance({ diagnostics, dataMapper, g }, { componentHash: component.hash, componentId, instanceId, imports })

    const [parentInstanceVertexId] = await g
      .V()
      .has('label', domain.vertex.componentInstance.constants.LABEL)
      .has('instanceId', instanceId)
      .id()
    assert.ok(parentInstanceVertexId, 'parent componentInstance missing')

    const { usesImportInstanceIds } = await loadUsesImportInstances({
      rootCtx: { g },
      scope: { instanceVertexId: parentInstanceVertexId },
    })
    assert.equal(usesImportInstanceIds.length, handlerResult.importedInstances.length)

    const published = []
    const natsContext = { publish: async (subject, payload) => published.push({ subject, payload: JSON.parse(payload) }) }

    await publishStartInstanceEvents({
      rootCtx: { natsContext },
      scope: {
        instanceId,
        dataStateIds: [],
        taskStateIds: [],
        usesImportInstanceIds,
      },
    })

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

    const startCommands = published.filter(({ subject }) => subject === startInstanceSubject)
    assert.equal(startCommands.length, usesImportInstanceIds.length)
    assert.deepEqual(
      startCommands.map(({ payload }) => payload.data.instanceId).sort(),
      [...usesImportInstanceIds].sort(),
    )

    const startedEvents = published.filter(({ subject }) => subject === startedSubject)
    assert.equal(startedEvents.length, 1)
    assert.deepEqual(startedEvents[0].payload.data, { instanceId })
  })
})
