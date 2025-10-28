import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from "@liquid-bricks/shared-providers/subject/create/basic";

export const path = { channel: 'cmd', entity: 'componentInstance', action: 'create_instance' }
export const spec = {
  decode: [
    decodeData(['componentHash', 'instanceId']),
    validateData,
  ],
  pre: [
    logItWasReceived,
    startDiagnosticsTimer,
  ],
  handler,
  post: [
    stopDiagnosticsTimer(({ scope: { instanceId } }) => ({ instanceId, })),
    ackMessage,
    publishEvents,
  ]
}

// decode handled via shared helper

// pre middlewares
function logItWasReceived({ rootCtx: { diagnostics }, scope: { componentHash, instanceId } }) {
  diagnostics.info('componentInstance create_instance command received', { componentHash, instanceId })
}

function validateData({ rootCtx: { diagnostics }, scope: { componentHash, instanceId } }) {
  diagnostics.require(
    typeof componentHash === 'string' && componentHash.length,
    Errors.PRECONDITION_REQUIRED,
    'componentHash required for create_instance',
    { field: 'componentHash' }
  )
  diagnostics.require(
    typeof instanceId === 'string' && instanceId.length,
    Errors.PRECONDITION_REQUIRED,
    'instanceId required for create_instance',
    { field: 'instanceId' }
  )
}


// post middlewares
async function publishEvents({ scope: { instanceId, componentHash }, rootCtx: { natsContext } }) {
  const subject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('created')
    .version('v1')

  await natsContext.publish(
    subject.build(),
    JSON.stringify({ data: { instanceId, componentHash } })
  )
}

// ack handled via shared helper

// Router-style handlers for componentInstance commands
// Expect pre hooks to validate and populate scope directly with decoded data
export async function handler({ rootCtx: { diagnostics, g }, scope: { instanceId, componentHash } }) {

  const [componentId] = await g.V().has('label', 'component').has('hash', componentHash).id()
  diagnostics.require(
    componentId,
    Errors.PRECONDITION_INVALID,
    `component not found for componentHash ${componentHash}`,
    { field: 'componentHash', componentHash }
  )

  const now = new Date().toISOString()

  const [instanceVertexId] = await g
    .addV('componentInstance')
    .property('instanceId', instanceId)
    .property('createdAt', now)
    .property('updatedAt', now)
    .id()

  await g
    .addE('instance_of', instanceVertexId, componentId)
    .property('createdAt', now)
    .property('updatedAt', now)

  const dataNodeIds = await g.V(componentId).out('has_data').id()
  await Promise.all(
    dataNodeIds.map(nodeId => g
      .addE('has_data_state', instanceVertexId, nodeId)
      .property('status', 'waiting')
      .property('result', '')
      .property('createdAt', now)
      .property('updatedAt', now))
  )

  const taskNodeIds = await g.V(componentId).out('has_task').id()
  await Promise.all(
    taskNodeIds.map(taskId => g
      .addE('has_task_state', instanceVertexId, taskId)
      .property('status', 'waiting')
      .property('result', '')
      .property('createdAt', now)
      .property('updatedAt', now))
  )

}
