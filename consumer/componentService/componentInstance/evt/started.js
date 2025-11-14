import { ackMessage, decodeData } from '../../middleware.js'

export const path = { channel: 'evt', entity: 'componentInstance', action: 'started' }
export const spec = {
  decode: [
    decodeData(['instanceId'])
  ],
  pre: [
    logItWasReceived,
  ],
  handler() { },
  post: [
    ackMessage,
  ]
}

function logItWasReceived({ rootCtx: { diagnostics }, scope: { instanceId }, message }) {
  diagnostics.info('componentInstance started event received', {
    subject: message.subject,
    instanceId,
  })
}
