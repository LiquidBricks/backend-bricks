import { Errors } from '../../../../errors.js'
import { domain } from '../../../../../domain/index.js'

export async function loadStateMachine({ scope: { handlerDiagnostics, instanceVertexId, instanceId }, rootCtx: { g } }) {
  const [stateMachineId] = await g
    .V(instanceVertexId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id()
  handlerDiagnostics.require(stateMachineId, Errors.PRECONDITION_INVALID, `stateMachine for componentInstance ${instanceId} not found`, { instanceId })
  return { stateMachineId }
}
