import test from 'node:test'
import assert from 'node:assert/strict'

import { Graph } from '@liquid-bricks/nats-graph/graph'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { s } from '@liquid-bricks/shared-providers/subject/router'
import { ulid } from 'ulid'

import { createComponentServiceRouter } from '../../../../../consumer/componentService/router.js'
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
    kvConfig: { servers: NATS_IP_ADDRESS, bucket: `component-register-${ulid()}` },
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
const skipIfExists = registerSpec.pre.find(fn => fn.name === 'skipIfExists')

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

async function registerComponent(context, component) {
  const { diagnostics, dataMapper, g } = context
  const handlerDiagnostics = createHandlerDiagnostics(diagnostics, { component })
  await registerSpec.handler({ rootCtx: { diagnostics, dataMapper, g }, scope: { handlerDiagnostics, component } })
}

test('handler builds component graph and dependency edges', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-123',
      name: 'TestComponent',
      tasks: [
        { name: 'task1', fnc: 'fn1', codeRef: { file: 't1.js', line: 1, column: 1 }, deps: ['data.data1', 'deferred.deferred'] },
        { name: 'task2', fnc: 'fn2', codeRef: { file: 't2.js', line: 2, column: 2 }, deps: [] },
      ],
      data: [
        { name: 'data1', fnc: 'dfn', codeRef: { file: 'd1.js', line: 3, column: 3 }, deps: ['task.task2'] },
      ],
    }

    await registerComponent({ diagnostics, dataMapper, g }, component)

    const [componentId] = await g
      .V()
      .has('label', domain.vertex.component.constants.LABEL)
      .has('hash', component.hash)
      .id()
    assert.ok(componentId, 'component vertex missing')

    const [task1Id] = await g.V().has('label', domain.vertex.task.constants.LABEL).has('name', 'task1').id()
    const [task2Id] = await g.V().has('label', domain.vertex.task.constants.LABEL).has('name', 'task2').id()
    const [data1Id] = await g.V().has('label', domain.vertex.data.constants.LABEL).has('name', 'data1').id()
    const [deferredId] = await g.V().has('label', domain.vertex.deferred.constants.LABEL).has('name', 'deferred').id()

    assert.ok(task1Id, 'task1 vertex missing')
    assert.ok(task2Id, 'task2 vertex missing')
    assert.ok(data1Id, 'data1 vertex missing')
    assert.ok(deferredId, 'deferred vertex missing')

    const componentTasks = await g.V(componentId).out(domain.edge.has_task.component_task.constants.LABEL).id()
    assert.deepEqual(componentTasks.sort(), [task1Id, task2Id].sort())

    const componentData = await g.V(componentId).out(domain.edge.has_data.component_data.constants.LABEL).id()
    assert.deepEqual(componentData, [data1Id])

    const componentDeferred = await g.V(componentId).out(domain.edge.has_deferred.component_deferred.constants.LABEL).id()
    assert.deepEqual(componentDeferred, [deferredId])

    const task1DataDeps = await g.V(task1Id).out(domain.edge.has_dependency.task_data.constants.LABEL).id()
    assert.deepEqual(task1DataDeps, [data1Id])

    const task1DeferredDeps = await g.V(task1Id).out(domain.edge.has_dependency.task_deferred.constants.LABEL).id()
    assert.deepEqual(task1DeferredDeps, [deferredId])

    const dataTaskDeps = await g.V(data1Id).out(domain.edge.has_dependency.data_task.constants.LABEL).id()
    assert.deepEqual(dataTaskDeps, [task2Id])

    assert.deepEqual(await g.V(task1Id).out(domain.edge.has_dependency.task_task.constants.LABEL).id(), [])
    assert.deepEqual(await g.V(data1Id).out(domain.edge.has_dependency.data_data.constants.LABEL).id(), [])
    assert.deepEqual(await g.V(data1Id).out(domain.edge.has_dependency.data_deferred.constants.LABEL).id(), [])
  })
})

test('handler allows data entries without fnc', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-no-data-fnc',
      name: 'NoDataFncComponent',
      tasks: [],
      data: [
        { name: 'dataNoFnc', codeRef: { file: 'dNoFnc.js', line: 1, column: 1 }, deps: [] },
      ],
    }

    await registerComponent({ diagnostics, dataMapper, g }, component)

    const [dataId] = await g
      .V()
      .has('label', domain.vertex.data.constants.LABEL)
      .has('name', 'dataNoFnc')
      .id()

    assert.ok(dataId, 'data vertex missing')
  })
})

test('handler builds inject edges for data and tasks', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-inject-123',
      name: 'InjectComponent',
      tasks: [
        { name: 'taskA', fnc: 'fnA', codeRef: { file: 'tA.js', line: 1, column: 1 }, deps: [], inject: ['data.dataOne', 'task.taskB'] },
        { name: 'taskB', fnc: 'fnB', codeRef: { file: 'tB.js', line: 2, column: 2 }, deps: [] },
      ],
      data: [
        { name: 'dataOne', fnc: 'dfn1', codeRef: { file: 'd1.js', line: 3, column: 3 }, deps: [], inject: ['data.dataTwo', 'task.taskB'] },
        { name: 'dataTwo', fnc: 'dfn2', codeRef: { file: 'd2.js', line: 4, column: 4 }, deps: [] },
      ],
    }

    await registerComponent({ diagnostics, dataMapper, g }, component)

    const [taskAId] = await g.V().has('label', domain.vertex.task.constants.LABEL).has('name', 'taskA').id()
    const [taskBId] = await g.V().has('label', domain.vertex.task.constants.LABEL).has('name', 'taskB').id()
    const [dataOneId] = await g.V().has('label', domain.vertex.data.constants.LABEL).has('name', 'dataOne').id()
    const [dataTwoId] = await g.V().has('label', domain.vertex.data.constants.LABEL).has('name', 'dataTwo').id()

    assert.ok(taskAId, 'taskA vertex missing')
    assert.ok(taskBId, 'taskB vertex missing')
    assert.ok(dataOneId, 'dataOne vertex missing')
    assert.ok(dataTwoId, 'dataTwo vertex missing')

    const taskADataInjects = await g.V(taskAId).out(domain.edge.injects_into.task_data.constants.LABEL).id()
    assert.deepEqual(taskADataInjects, [dataOneId])

    const taskATaskInjects = await g.V(taskAId).out(domain.edge.injects_into.task_task.constants.LABEL).id()
    assert.deepEqual(taskATaskInjects, [taskBId])

    const dataOneDataInjects = await g.V(dataOneId).out(domain.edge.injects_into.data_data.constants.LABEL).id()
    assert.deepEqual(dataOneDataInjects, [dataTwoId])

    const dataOneTaskInjects = await g.V(dataOneId).out(domain.edge.injects_into.data_task.constants.LABEL).id()
    assert.deepEqual(dataOneTaskInjects, [taskBId])

    assert.deepEqual(await g.V(taskBId).out(domain.edge.injects_into.task_data.constants.LABEL).id(), [])
    assert.deepEqual(await g.V(dataTwoId).out(domain.edge.injects_into.data_task.constants.LABEL).id(), [])
  })
})

test('handler resolves namespaced inject paths through imports', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const componentFirst = {
      hash: 'hash-first',
      name: 'FirstComponent',
      imports: [],
      tasks: [
        { name: 'init', fnc: 'fnInit', codeRef: { file: 'f.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [],
    }
    const componentEngine = {
      hash: 'hash-engine',
      name: 'EngineComponent',
      imports: [{ name: 'first', hash: componentFirst.hash }],
      tasks: [
        { name: 'boot', fnc: 'fnBoot', codeRef: { file: 'e.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [],
    }
    const componentWords = {
      hash: 'hash-words',
      name: 'WordsComponent',
      imports: [{ name: 'engine', hash: componentEngine.hash }],
      tasks: [
        { name: 'process', fnc: 'fnProcess', codeRef: { file: 'w.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [
        { name: 'vocab', fnc: 'fnVocab', codeRef: { file: 'wd.js', line: 2, column: 2 }, deps: [] },
      ],
    }
    const componentRoot = {
      hash: 'hash-root',
      name: 'RootComponent',
      imports: [{ name: 'words', hash: componentWords.hash }],
      tasks: [
        {
          name: 'main',
          fnc: 'fnMain',
          codeRef: { file: 'r.js', line: 1, column: 1 },
          deps: [],
          inject: [
            'words.task.process',
            'words.engine.first.task.init',
            'words.data.vocab',
          ],
        },
      ],
      data: [],
    }

    await registerComponent({ diagnostics, dataMapper, g }, componentFirst)
    await registerComponent({ diagnostics, dataMapper, g }, componentEngine)
    await registerComponent({ diagnostics, dataMapper, g }, componentWords)
    await registerComponent({ diagnostics, dataMapper, g }, componentRoot)

    const [rootComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentRoot.hash).id()
    const [mainTaskId] = await g.V(rootComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'main').id()

    const [wordsComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentWords.hash).id()
    const [wordsProcessId] = await g.V(wordsComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'process').id()
    const [wordsVocabId] = await g.V(wordsComponentId).out(domain.edge.has_data.component_data.constants.LABEL).has('name', 'vocab').id()

    const [firstComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentFirst.hash).id()
    const [firstInitId] = await g.V(firstComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'init').id()

    assert.ok(mainTaskId, 'main task missing')
    assert.ok(wordsProcessId, 'words process task missing')
    assert.ok(wordsVocabId, 'words vocab data missing')
    assert.ok(firstInitId, 'first init task missing')

    const taskTargets = await g.V(mainTaskId).out(domain.edge.injects_into.task_task.constants.LABEL).id()
    assert.deepEqual(taskTargets.sort(), [wordsProcessId, firstInitId].sort())

    const dataTargets = await g.V(mainTaskId).out(domain.edge.injects_into.task_data.constants.LABEL).id()
    assert.deepEqual(dataTargets, [wordsVocabId])
  })
})

test('handler resolves namespaced dependency paths through imports', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const componentFirst = {
      hash: 'hash-dep-first',
      name: 'DepFirst',
      imports: [],
      tasks: [
        { name: 'init', fnc: 'fnInit', codeRef: { file: 'f.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [],
    }
    const componentEngine = {
      hash: 'hash-dep-engine',
      name: 'DepEngine',
      imports: [{ name: 'first', hash: componentFirst.hash }],
      tasks: [
        { name: 'boot', fnc: 'fnBoot', codeRef: { file: 'e.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [],
    }
    const componentWords = {
      hash: 'hash-dep-words',
      name: 'DepWords',
      imports: [{ name: 'engine', hash: componentEngine.hash }],
      tasks: [
        { name: 'process', fnc: 'fnProcess', codeRef: { file: 'w.js', line: 1, column: 1 }, deps: [] },
      ],
      data: [
        { name: 'vocab', fnc: 'fnVocab', codeRef: { file: 'wd.js', line: 2, column: 2 }, deps: [] },
      ],
    }
    const componentRoot = {
      hash: 'hash-dep-root',
      name: 'DepRoot',
      imports: [{ name: 'words', hash: componentWords.hash }],
      tasks: [
        {
          name: 'main',
          fnc: 'fnMain',
          codeRef: { file: 'r.js', line: 1, column: 1 },
          deps: [
            'words.task.process',
            'words.engine.first.task.init',
            'words.data.vocab',
          ],
        },
      ],
      data: [],
    }

    await registerComponent({ diagnostics, dataMapper, g }, componentFirst)
    await registerComponent({ diagnostics, dataMapper, g }, componentEngine)
    await registerComponent({ diagnostics, dataMapper, g }, componentWords)
    await registerComponent({ diagnostics, dataMapper, g }, componentRoot)

    const [rootComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentRoot.hash).id()
    const [mainTaskId] = await g.V(rootComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'main').id()

    const [wordsComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentWords.hash).id()
    const [wordsProcessId] = await g.V(wordsComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'process').id()
    const [wordsVocabId] = await g.V(wordsComponentId).out(domain.edge.has_data.component_data.constants.LABEL).has('name', 'vocab').id()

    const [firstComponentId] = await g.V().has('label', domain.vertex.component.constants.LABEL).has('hash', componentFirst.hash).id()
    const [firstInitId] = await g.V(firstComponentId).out(domain.edge.has_task.component_task.constants.LABEL).has('name', 'init').id()

    assert.ok(mainTaskId, 'main task missing')
    assert.ok(wordsProcessId, 'words process task missing')
    assert.ok(wordsVocabId, 'words vocab data missing')
    assert.ok(firstInitId, 'first init task missing')

    const taskDeps = await g.V(mainTaskId).out(domain.edge.has_dependency.task_task.constants.LABEL).id()
    assert.deepEqual(taskDeps.sort(), [wordsProcessId, firstInitId].sort())

    const dataDeps = await g.V(mainTaskId).out(domain.edge.has_dependency.task_data.constants.LABEL).id()
    assert.deepEqual(dataDeps, [wordsVocabId])

    assert.deepEqual(await g.V(mainTaskId).out(domain.edge.has_dependency.task_deferred.constants.LABEL).id(), [])
  })
})


test('handler links imports to existing components', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-importing',
      name: 'ImportingComponent',
      imports: [{ name: 'SharedComponent', hash: 'shared-hash' }],
      tasks: [],
      data: [],
    }

    const { id: sharedComponentId } = await dataMapper.vertex.component.create({ hash: 'shared-hash', name: 'SharedComponent' })

    await registerComponent({ diagnostics, dataMapper, g }, component)

    const [componentId] = await g
      .V()
      .has('label', domain.vertex.component.constants.LABEL)
      .has('hash', component.hash)
      .id()

    const imports = await g.V(componentId).out(domain.edge.has_import.component_component.constants.LABEL).id()
    assert.deepEqual(imports, [sharedComponentId])

    const [importEdgeValues] = await g
      .V(componentId)
      .outE(domain.edge.has_import.component_component.constants.LABEL)
      .valueMap('alias')

    assert.ok(importEdgeValues, 'import edge missing')
    const aliasValue = Array.isArray(importEdgeValues.alias) ? importEdgeValues.alias[0] : importEdgeValues.alias
    assert.equal(aliasValue, component.imports[0].name)
  })
})

test('handler rejects missing imported components', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-importing',
      name: 'ImportingComponent',
      imports: [{ name: 'SharedComponent', hash: 'missing-hash' }],
      tasks: [],
      data: [],
    }

    await assert.rejects(
      registerComponent({ diagnostics, dataMapper, g }, component),
      diagnostics.DiagnosticError,
    )

  })
})

test('handler rejects duplicate import names', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-importing-duplicate',
      name: 'ImportingComponent',
      imports: [
        { name: 'SharedComponent', hash: 'shared-hash-1' },
        { name: 'SharedComponent', hash: 'shared-hash-2' },
      ],
      tasks: [],
      data: [],
    }

    await assert.rejects(
      registerComponent({ diagnostics, dataMapper, g }, component),
      diagnostics.DiagnosticError,
    )
  })
})

test('handler rejects unknown dependency types', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-err',
      name: 'InvalidComponent',
      tasks: [
        { name: 'invalidTask', fnc: 'fn', codeRef: { file: 'x.js', line: 1, column: 1 }, deps: ['unknown.dep'] },
      ],
      data: [],
    }

    await assert.rejects(
      registerComponent({ diagnostics, dataMapper, g }, component),
      diagnostics.DiagnosticError,
    )
  })
})

test('handler rejects unsupported injection types', async () => {
  await withGraphContext(async ({ diagnostics, dataMapper, g }) => {
    const component = {
      hash: 'hash-inject-err',
      name: 'InvalidInjectionComponent',
      tasks: [
        { name: 'taskInvalidInject', fnc: 'fn', codeRef: { file: 't.js', line: 1, column: 1 }, deps: [], inject: ['deferred.ready'] },
      ],
      data: [],
    }

    await assert.rejects(
      registerComponent({ diagnostics, dataMapper, g }, component),
      diagnostics.DiagnosticError,
    )
  })
})

test('skipIfExists aborts when existing component found', async () => {
  await withGraphContext(async ({ g, dataMapper }) => {
    const abortCtl = { aborted: false, payload: null, abort(payload) { this.aborted = true; this.payload = payload } }
    const hash = 'dupe-hash'

    for (let i = 0; i < 3; i += 1) {
      await dataMapper.vertex.component.create({ hash, name: `Existing-${i + 1}` })
    }

    await skipIfExists({
      rootCtx: { g },
      scope: { component: { hash }, [s.scope.ac]: abortCtl },
    })

    assert.equal(abortCtl.aborted, true)
    assert.deepEqual(abortCtl.payload, {
      reason: 'component already registered.',
      hash,
      count: 3,
    })
  })
})
