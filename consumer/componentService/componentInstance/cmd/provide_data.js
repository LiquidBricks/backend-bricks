import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from "@liquid-bricks/shared-providers/subject/create/basic";
import { domain } from '../../../../domain/index.js'

export const path = { channel: 'cmd', entity: 'componentInstance', action: 'provide_data' }
export const spec = {
  decode: [
    decodeData('data'),
  ],
  pre: [
    logItWasReceived,
    startDiagnosticsTimer,
  ],
  handler,
  post: [
    stopDiagnosticsTimer(({ scope: { data: { instanceId }, result: { stateId } } }) => ({ instanceId, stateId })),
    ackMessage,
    publishEvents,
  ]
}

// decode handled via shared helper

// post middlewares
function logItWasReceived({ rootCtx: { diagnostics }, scope: { data: { instanceId, stateId } } }) {
  diagnostics.info('componentInstance provide_data command received', { instanceId, stateId })
}

async function publishEvents({ scope: { data: { instanceId }, result: { stateId } }, rootCtx: { natsContext } }) {
  const subject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('data_provided')
    .version('v1')

  await natsContext.publish(
    subject.build(),
    JSON.stringify({ data: { instanceId, stateId } })
  )
}

// ack handled via shared helper

export async function handler({ rootCtx: { diagnostics, g }, scope: { data: { instanceId, stateId, payload } } }) {
  diagnostics.require(
    typeof instanceId === 'string' && instanceId.length,
    Errors.PRECONDITION_REQUIRED,
    'instanceId required',
    { field: 'instanceId' }
  )
  diagnostics.require(typeof stateId === 'string' && stateId.length, Errors.PRECONDITION_REQUIRED, 'stateId required for provide_data', { field: 'stateId' })
  diagnostics.info('componentInstance provide data requested', { code: Errors.COMPONENT_INSTANCE_PROVIDE_DATA_REQUESTED, instanceId, stateId })

  const instanceVertices = await g.V()
    .has('label', domain.vertex.componentInstance.constants.LABEL)
    .has('instanceId', instanceId).id()
  diagnostics.require(instanceVertices?.length, Errors.PRECONDITION_INVALID, `componentInstance ${instanceId} not found`, { instanceId })
  const instanceVertexId = instanceVertices[0]

  const stateIds = await g
    .V(instanceVertexId)
    .out(domain.edge.has_data_state.componentInstance_data.constants.LABEL)
    .id()
  diagnostics.require(stateIds?.includes(stateId), Errors.PRECONDITION_INVALID, `state ${stateId} not associated with instance ${instanceId}`, { stateId, instanceId })

  const now = new Date().toISOString()
  const resultValue = payload != null ? JSON.stringify(payload) : ''

  await g
    .V(stateId)
    .property('result', resultValue)
    .property('status', 'provided')
    .property('updatedAt', now)

  diagnostics.info('componentInstance data provided', { code: Errors.COMPONENT_INSTANCE_DATA_PROVIDED, instanceId, stateId })

  return { instanceId, stateId }
}
