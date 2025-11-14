import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'
import { create as createBasicSubject } from "@liquid-bricks/shared-providers/subject/create/basic";
import { domain } from '../../../../domain/index.js'

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
  // Delegate instanceId validation to domain
  diagnostics.require(
    typeof instanceId === 'string' && instanceId.length,
    Errors.PRECONDITION_REQUIRED,
    'instanceId required',
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
export async function handler({ rootCtx: { diagnostics, g, dataMapper }, scope: { instanceId, componentHash } }) {

  const [componentId] = await g.V()
    .has('label', domain.vertex.component.constants.LABEL)
    .has('hash', componentHash).id()
  diagnostics.require(
    componentId,
    Errors.PRECONDITION_INVALID,
    `component not found for componentHash ${componentHash}`,
    { field: 'componentHash', componentHash }
  )

  const { id: instanceVertexId } = await dataMapper.vertex.componentInstance.create({ instanceId })
  await dataMapper.edge.instance_of.componentInstance_component.create({ fromId: instanceVertexId, toId: componentId })

  const dataNodeIds = await g.V(componentId)
    .out(domain.edge.has_data.component_data.constants.LABEL).id()
  await Promise.all(
    dataNodeIds.map(nodeId => dataMapper.edge.has_data_state.componentInstance_data.create({ fromId: instanceVertexId, toId: nodeId, }))
  )

  const taskNodeIds = await g.V(componentId)
    .out(domain.edge.has_task.component_task.constants.LABEL).id()
  await Promise.all(
    taskNodeIds.map(taskId => dataMapper.edge.has_task_state.componentInstance_task.create({ fromId: instanceVertexId, toId: taskId, }))
  )

  const { id: stateMachineId } = await dataMapper.vertex.stateMachine.create()
  await dataMapper.edge.has_stateMachine.componentInstance_stateMachine.create({ fromId: instanceVertexId, toId: stateMachineId })

}
