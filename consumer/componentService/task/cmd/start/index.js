import { ackMessage, decodeData } from '../../../middleware.js'
import { handler } from './handler.js'
import { loadTaskDependencyResults } from './loadTaskDependencyResults.js'
import { loadTaskNodes } from './loadTaskNodes.js'
import { publishExecutionRequest } from './publishExecutionRequest.js'

export const path = { channel: 'cmd', entity: 'task', action: 'start' }
export const spec = {
  decode: [
    decodeData(['instanceId', 'stateId']),
  ],
  pre: [
    loadTaskNodes,
    loadTaskDependencyResults,
  ],
  handler,
  post: [
    publishExecutionRequest,
    ackMessage,
  ]
}
