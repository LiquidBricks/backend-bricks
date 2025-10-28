import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from "@liquid-bricks/shared-providers/subject/create/basic";
import { s } from "@liquid-bricks/shared-providers/subject/router";

export const path = { channel: 'cmd', entity: 'component', action: 'register' }
export const spec = {
  decode: [
    decodeData('component'),
    validateData,
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
function validateData({ rootCtx: { diagnostics }, scope: { component } }) {
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
  diagnostics.require(
    Array.isArray(component.tasks),
    Errors.PRECONDITION_INVALID,
    'Component tasks array is required',
    { field: 'tasks' }
  )
}

// timer handled via shared middleware

async function ignoreAlreadyExists({ rootCtx: { g }, scope: { component: { hash }, [s.scope.abort]: abortCtl } }) {
  //todo fix this. .drop doesnt work.
  // await g
  //   .V()
  //   .has('label', 'component')
  //   .has('hash', component.hash)
  //   .drop()
  const ids = await g
    .V()
    .has('label', 'component')
    .has('hash', hash)
    .id()

  if (ids.length > 0)
    abortCtl.abort({
      reason: 'component already registered.',
      hash: hash,
      count: ids.length,
    })
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
async function handler({ rootCtx: { diagnostics, g }, scope: { component } }) {
  const { hash, name: compName, data, tasks } = component

  const [componentVID] = await g
    .addV('component')
    .property('hash', hash)
    .property('name', compName)
    .property('createdAt', new Date().toISOString())
    .property('updatedAt', new Date().toISOString())
    .id()

  const dependencyList = new Map()
  for (const { name, deps, fnc, codeRef } of tasks) {
    diagnostics.require(typeof name === 'string' && name.length, Errors.PRECONDITION_REQUIRED, 'task name required', { field: 'task.name' });
    diagnostics.require(Array.isArray(deps), Errors.PRECONDITION_INVALID, 'task deps must be an array', { field: 'task.deps' });
    diagnostics.require(typeof fnc === 'string' && fnc.length, Errors.PRECONDITION_REQUIRED, 'task fnc required', { field: 'task.fnc' });
    diagnostics.require(typeof codeRef === 'object', Errors.PRECONDITION_INVALID, 'task codeRef required', { field: 'task.codeRef' });
    const { file, line, column } = codeRef
    const [taskVID] = await g
      .addV('task')
      .property('name', name)
      .property('fnc', fnc)
      .property('codeRef', { file, line, column })
      .property('createdAt', new Date().toISOString())
      .property('updatedAt', new Date().toISOString())
      .id()

    await g
      .addE('has_task', componentVID, taskVID)
      .property('createdAt', new Date().toISOString())
      .property('updatedAt', new Date().toISOString())

    dependencyList.set(`task:${name}`, { id: taskVID, deps })
  }
  for (const { name, deps, fnc, codeRef } of data) {
    diagnostics.require(typeof name === 'string' && name.length, Errors.PRECONDITION_REQUIRED, 'data name required', { field: 'data.name' });
    diagnostics.require(Array.isArray(deps), Errors.PRECONDITION_INVALID, 'data deps must be an array', { field: 'data.deps' });
    diagnostics.require(typeof fnc === 'string' && fnc.length, Errors.PRECONDITION_REQUIRED, 'data fnc required', { field: 'data.fnc' });
    diagnostics.require(typeof codeRef === 'object', Errors.PRECONDITION_INVALID, 'task codeRef required', { field: 'data.codeRef' });
    const { file, line, column } = codeRef
    const [dataVID] = await g
      .addV('data')
      .property('name', name)
      .property('fnc', fnc)
      .property('codeRef', { file, line, column })
      .property('createdAt', new Date().toISOString())
      .property('updatedAt', new Date().toISOString())
      .id()

    await g
      .addE('has_data', componentVID, dataVID)
      .property('createdAt', new Date().toISOString())
      .property('updatedAt', new Date().toISOString())

    dependencyList.set(`data:${name}`, { id: dataVID, deps })
  }

  const [deferredVID] = await g
    .addV('deferred')
    .property('name', 'deferred')
    .property('createdAt', new Date().toISOString())
    .property('updatedAt', new Date().toISOString())
    .id()
  await g
    .addE('has_deferred', componentVID, deferredVID)
    .property('createdAt', new Date().toISOString())
    .property('updatedAt', new Date().toISOString())
  dependencyList.set(`deferred:deferred`, { id: deferredVID, deps: [] })


  for (const [dependencyRef, { id, deps }] of dependencyList.entries()) {
    const [dependencyType, dependencyName] = dependencyRef.split(':')
    for (const dep of deps) {
      const [type, name] = dep.trim().split(':')
      diagnostics.require(type, Errors.PRECONDITION_REQUIRED, `Dependency type is required for component(${compName})#${hash} ${dependencyType}:${dependencyName}`, { component: compName, hash, dependencyType, dependencyName })
      diagnostics.require(['data', 'task', 'deferred'].includes(type), Errors.PRECONDITION_INVALID, `Unknown dependency type:${type} for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { type, dep, component: compName, hash })
      diagnostics.require(name, Errors.PRECONDITION_REQUIRED, `Dependency name is required for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { component: compName, hash, dependencyType, dependencyName })

      const match = dependencyList.get(dep)
      diagnostics.require(match, Errors.PRECONDITION_INVALID, `Dependency not found for component(${compName})#${hash} ${dependencyType}:${dependencyName} dep[${dep}]`, { dep, component: compName, hash })
      await g
        .addE('has_dependency', id, match.id)
    }
  }

}
