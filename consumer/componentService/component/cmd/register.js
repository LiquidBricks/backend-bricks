import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from "@liquid-bricks/shared-providers/subject/create/basic";
import { s } from "@liquid-bricks/shared-providers/subject/router";
import { domain } from '../../../../domain/index.js'

export const path = { channel: 'cmd', entity: 'component', action: 'register' }
export const spec = {
  decode: [
    decodeData('component'),
    validateComponent,
  ],
  pre: [
    ignoreAlreadyExists,
    logItWasReceived,
    startDiagnosticsTimer,
  ],
  handler,
  post: [
    stopDiagnosticsTimer(({ scope: { component: { hash } } }) => ({ hash })),
    ackMessage,
    publishEvents,
  ]
}
// decode handled via shared helper

// pre middlewares
function validateComponent({ rootCtx: { diagnostics }, scope: { component } }) {
  diagnostics.require(
    component.hash,
    Errors.PRECONDITION_REQUIRED,
    'Component hash is required',
    { field: 'hash' }
  )
  diagnostics.require(
    component.name,
    Errors.PRECONDITION_REQUIRED,
    'Component name is required',
    { field: 'name' }
  )
}

function validateTaskPayload(diagnostics, task) {
  const { name, fnc, codeRef, deps } = task
  diagnostics.require(
    typeof name === 'string' && name.length,
    Errors.PRECONDITION_REQUIRED,
    'task name required',
    { field: 'task.name' },
  )
  diagnostics.require(
    typeof fnc === 'string' && fnc.length,
    Errors.PRECONDITION_REQUIRED,
    'task fnc required',
    { field: 'task.fnc' },
  )
  diagnostics.require(
    typeof codeRef === 'object',
    Errors.PRECONDITION_INVALID,
    'task codeRef required',
    { field: 'task.codeRef' },
  )
  diagnostics.require(
    Array.isArray(deps),
    Errors.PRECONDITION_INVALID,
    'task deps must be an array',
    { field: 'task.deps' },
  )
}

function validateDataPayload(diagnostics, dataItem) {
  const { name, fnc, codeRef, deps } = dataItem
  diagnostics.require(
    typeof name === 'string' && name.length,
    Errors.PRECONDITION_REQUIRED,
    'data name required',
    { field: 'data.name' },
  )
  diagnostics.require(
    Array.isArray(deps),
    Errors.PRECONDITION_INVALID,
    'data deps must be an array',
    { field: 'data.deps' },
  )
  diagnostics.require(
    typeof fnc === 'string' && fnc.length,
    Errors.PRECONDITION_REQUIRED,
    'data fnc required',
    { field: 'data.fnc' },
  )
  diagnostics.require(
    typeof codeRef === 'object',
    Errors.PRECONDITION_INVALID,
    'task codeRef required',
    { field: 'data.codeRef' },
  )
}

// timer handled via shared middleware

async function ignoreAlreadyExists({ rootCtx: { g }, scope: { component: { hash }, [s.scope.ac]: abortCtl } }) {

  const ids = await g
    .V()
    .has('label', domain.vertex.component.constants.LABEL)
    .has('hash', hash)
    .id()

  if (ids.length > 0) {
    abortCtl.abort({
      reason: 'component already registered.',
      hash: hash,
      count: ids.length,
    })
  }
}

function logItWasReceived({ rootCtx: { diagnostics }, scope: { component: { hash } } }) {
  diagnostics.info('component register command received', { hash })
}

// post middlewares
async function publishEvents({ scope: { component: { hash } }, rootCtx: { natsContext } }) {
  const subject = createBasicSubject()
    .env('prod')
    .ns('component-service')

    .entity('component')
    .channel('evt')
    .action('registered')
    .version('v1')

  await natsContext.publish(
    subject.build(),
    JSON.stringify({
      data: { hash },
    })
  )
}

// ack/timer handled via shared middleware
async function handler({ rootCtx: { diagnostics, g, dataMapper }, scope: { component } }) {
  const { hash, name: compName, data, tasks } = component

  const { id: componentVID } = await dataMapper.vertex.component.create({ hash, name: compName })

  const dependencyList = new Map()
  for (const task of tasks) {
    validateTaskPayload(diagnostics, task)
    const { id: taskVID } = await dataMapper.vertex.task.create(task)
    await dataMapper.edge.has_task.component_task.create({ fromId: componentVID, toId: taskVID })

    dependencyList.set(`task:${task.name}`, { id: taskVID, deps: task.deps })
  }
  for (const d of data) {
    validateDataPayload(diagnostics, d)
    const { id: dataVID } = await dataMapper.vertex.data.create(d)
    await dataMapper.edge.has_data.component_data.create({ fromId: componentVID, toId: dataVID })

    dependencyList.set(`data:${d.name}`, { id: dataVID, deps: d.deps })
  }
  const { id: deferredVID } = await dataMapper.vertex.deferred.create({ name: 'deferred' })
  await dataMapper.edge.has_deferred.component_deferred.create({ fromId: componentVID, toId: deferredVID })
  dependencyList.set(`deferred:deferred`, { id: deferredVID, deps: [] })


  for (const [dependencyRef, { id, deps }] of dependencyList.entries()) {
    const [dependencyType, dependencyName] = dependencyRef.split(':')
    for (const dep of deps) {
      const [type, name] = dep.trim().split(':')
      const match = dependencyList.get(dep)

      diagnostics.require(type, Errors.PRECONDITION_REQUIRED, `Dependency type is required for component(${compName})#${hash} ${dependencyType}:${dependencyName}`, { component: compName, hash, dependencyType, dependencyName })
      diagnostics.require(['data', 'task', 'deferred'].includes(type), Errors.PRECONDITION_INVALID, `Unknown dependency type:${type} for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { type, dep, component: compName, hash })
      diagnostics.require(name, Errors.PRECONDITION_REQUIRED, `Dependency name is required for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { component: compName, hash, dependencyType, dependencyName })

      diagnostics.require(match, Errors.PRECONDITION_INVALID, `Dependency not found for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { dep, component: compName, hash })
      // map to specific has_dependency edge type via dataMapper
      if (dependencyType === 'task') {
        if (type === 'task') await dataMapper.edge.has_dependency.task_task.create({ fromId: id, toId: match.id })
        if (type === 'data') await dataMapper.edge.has_dependency.task_data.create({ fromId: id, toId: match.id })
        if (type === 'deferred') await dataMapper.edge.has_dependency.task_deferred.create({ fromId: id, toId: match.id })
      } else if (dependencyType === 'data') {
        if (type === 'task') await dataMapper.edge.has_dependency.data_task.create({ fromId: id, toId: match.id })
        if (type === 'data') await dataMapper.edge.has_dependency.data_data.create({ fromId: id, toId: match.id })
        if (type === 'deferred') await dataMapper.edge.has_dependency.data_deferred.create({ fromId: id, toId: match.id })
      }
    }
  }

}
