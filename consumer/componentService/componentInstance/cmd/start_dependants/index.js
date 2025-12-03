import { ackMessage, decodeData } from '../../../middleware.js'
import { handler } from './handler.js'
import { loadInstanceVertex } from './loadInstanceVertex.js'
import { loadProvidedStateEdge } from './loadProvidedStateEdge.js'
import { loadStateMachine } from './loadStateMachine.js'
import { validatePayload } from './validatePayload.js'

export const path = { channel: 'cmd', entity: 'componentInstance', action: 'start_dependants' }
export const spec = {
  decode: [
    decodeData(['instanceId', 'stateEdgeId', 'type']),
  ],
  pre: [
    validatePayload,
    loadInstanceVertex,
    loadStateMachine,
    loadProvidedStateEdge,
  ],
  handler,
  post: [
    ackMessage,
  ]
}
