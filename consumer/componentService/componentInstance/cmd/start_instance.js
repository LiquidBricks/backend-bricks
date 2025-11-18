import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { domain } from '../../../../domain/index.js'

export const path = { channel: 'cmd', entity: 'componentInstance', action: 'start_instance' }
export const spec = {
  decode: [
    decodeData(['instanceId']),
  ],
  pre: [
    logItWasReceived,
    doesInstanceExist,
    getStateMachine,
    startDiagnosticsTimer,
    findDependencyFreeStates,
  ],
  handler,
  post: [
    stopDiagnosticsTimer(({ scope: { instanceId } }) => ({ instanceId })),
    ackMessage,
    publishEvents,
  ]
}

function logItWasReceived({ rootCtx: { diagnostics }, scope: { instanceId } }) {
  diagnostics.info('componentInstance start_instance command received', { instanceId })
}

async function doesInstanceExist({ rootCtx: { diagnostics, g }, scope: { instanceId } }) {
  const instanceVertices = await g.V()
    .has('label', domain.vertex.componentInstance.constants.LABEL)
    .has('instanceId', instanceId)
    .id()
  diagnostics.require(instanceVertices?.length, Errors.PRECONDITION_INVALID, `componentInstance ${instanceId} not found`, { instanceId })
  return { instanceVertexId: instanceVertices[0] }
}

async function getStateMachine({ rootCtx: { diagnostics, g }, scope: { instanceVertexId, instanceId } }) {
  const stateMachineIds = await g.V(instanceVertexId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id()
  return { stateMachineId: stateMachineIds[0] }
}

async function findDependencyFreeStates({ rootCtx: { g }, scope: { stateMachineId } }) {
  return {
    dependencyIds: await g
      .V(stateMachineId)
      .out(
        domain.edge.has_data_state.stateMachine_data.constants.LABEL,
        domain.edge.has_task_state.stateMachine_task.constants.LABEL,
      )
      .not(_ => _.out(
        domain.edge.has_dependency.data_task.constants.LABEL,
        domain.edge.has_dependency.data_data.constants.LABEL,
        domain.edge.has_dependency.data_deferred.constants.LABEL,
        domain.edge.has_dependency.task_task.constants.LABEL,
        domain.edge.has_dependency.task_data.constants.LABEL,
        domain.edge.has_dependency.task_deferred.constants.LABEL,
      ))
      .valueMap("id", "label")
  }
}


export async function handler({ rootCtx: { g }, scope: { stateMachineId } }) {
  await g
    .V(stateMachineId)
    .property('state', domain.vertex.stateMachine.constants.STATES.RUNNING)
    .property('updatedAt', new Date().toISOString())
}

async function publishEvents({ scope: { instanceId, dependencyIds }, rootCtx: { natsContext } }) {

  const startDataIds = []
  const startTaskIds = []

  for (const dependency of dependencyIds ?? []) {
    const label = Array.isArray(dependency.label) ? dependency.label[0] : dependency.label
    const id = Array.isArray(dependency.id) ? dependency.id[0] : dependency.id

    if (label === domain.vertex.data.constants.LABEL) startDataIds.push(id)
    if (label === domain.vertex.task.constants.LABEL) startTaskIds.push(id)
  }

  for (const [ids, action] of [
    [startDataIds, 'start_data'],
    [startTaskIds, 'start_task'],
  ]) {
    if (!ids.length) continue

    const startSubject = createBasicSubject()
      .env('prod')
      .ns('component-service')
      .entity('componentInstance')
      .channel('cmd')
      .action(action)
      .version('v1')

    for (const stateId of ids) {
      await natsContext.publish(
        startSubject.build(),
        JSON.stringify({ data: { instanceId, stateId } })
      )
    }
  }

  const subject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('started')
    .version('v1')

  await natsContext.publish(
    subject.build(),
    JSON.stringify({ data: { instanceId } })
  )
}
