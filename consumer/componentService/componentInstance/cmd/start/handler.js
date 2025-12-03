import { domain } from '../../../../../domain/index.js'

export async function handler({ rootCtx: { g }, scope: { stateMachineId } }) {
  await g
    .V(stateMachineId)
    .property('state', domain.vertex.stateMachine.constants.STATES.RUNNING)
    .property('updatedAt', new Date().toISOString())
}
