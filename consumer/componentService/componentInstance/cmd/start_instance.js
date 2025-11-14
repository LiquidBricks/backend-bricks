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
}

async function getStateMachine({ rootCtx: { diagnostics, g }, scope: { instanceId } }) {
  const stateMachineIds = await g.V(instanceId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id()

  return { stateMachineId: stateMachineIds[0] }
}

export async function handler({ rootCtx: { diagnostics, g }, scope: { instanceId, stateMachineId } }) {
  await g
    .V(stateMachineId)
    .property('state', domain.vertex.stateMachine.constants.STATES.RUNNING)
    .property('updatedAt', new Date().toISOString())

}

async function publishEvents({ scope: { instanceId }, rootCtx: { natsContext } }) {
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
