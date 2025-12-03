import { ackMessage, decodeData } from '../../../middleware.js'
import { findStateEdge } from './findStateEdge.js'
import { handler } from './handler.js'
import { loadInstanceVertex } from './loadInstanceVertex.js'
import { loadStateMachine } from './loadStateMachine.js'
import { completeStateMachineIfFinished } from './completeStateMachineIfFinished.js'
import { publishInjectedResultComputedEvents } from './publishInjectedResultComputedEvents.js'
import { publishStartDependantsCommand } from './publishStartDependantsCommand.js'
import { validatePayload } from './validatePayload.js'

export const path = { channel: 'evt', entity: 'componentInstance', action: 'result_computed' }
export const spec = {
  decode: [
    decodeData(['instanceId', 'type', 'name', 'result']),
  ],
  pre: [
    validatePayload,
    loadInstanceVertex,
    loadStateMachine,
    findStateEdge,
  ],
  handler,
  post: [
    completeStateMachineIfFinished,
    publishInjectedResultComputedEvents,
    publishStartDependantsCommand,
    ackMessage,
  ]
}

export { getCodeLocation } from './getCodeLocation.js'
