import { ackMessage, decodeData } from '../../../middleware.js'
import { handler } from './handler.js'
import { loadDependencyResults } from './loadDependencyResults.js'
import { loadNodes } from './loadNodes.js'
import { publishEvents } from './publishEvents/index.js'

export const path = { channel: 'cmd', entity: 'data', action: 'start' }
export const spec = {
  decode: [
    decodeData(['instanceId', 'stateId']),
  ],
  pre: [
    loadNodes,
    loadDependencyResults,
  ],
  handler,
  post: [
    publishEvents,
    ackMessage,
  ]
}
