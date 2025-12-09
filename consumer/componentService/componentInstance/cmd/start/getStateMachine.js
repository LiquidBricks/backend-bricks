import { domain } from '../../../../../domain/index.js'

export async function getStateMachine({ rootCtx: { g }, scope: { instanceVertexId } }) {
  const [stateMachineId] = await g.V(instanceVertexId)
    .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
    .id()

  return { stateMachineId }
}
