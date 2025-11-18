import { ackMessage, decodeData } from '../../middleware.js'

export const path = { channel: 'evt', entity: 'componentInstance', action: 'created' }
export const spec = {
  decode: [
    // Extract main properties from event payload
    decodeData(['instanceId', 'componentHash'])
  ],
  pre: [
    logItWasReceived,
  ],
  handler() { },
  post: [
    ackMessage,
  ]
}

function logItWasReceived({ rootCtx: { diagnostics }, scope: { instanceId, componentHash }, message }) {
  diagnostics.info('componentInstance created event received', {
    subject: message.subject,
    instanceId,
    componentHash,
  })
}
