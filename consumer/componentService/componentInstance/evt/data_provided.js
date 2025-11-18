import { ackMessage } from '../../middleware.js'

export const path = { channel: 'evt', entity: 'componentInstance', action: 'data_provided' }
export const spec = {
  pre: [
    logItWasReceived,
  ],
  handler() { },
  post: [
    ackMessage,
  ]
}

// decode handled via shared helper

// pre middleware
function logItWasReceived({ rootCtx: { diagnostics }, message }) {
  diagnostics.info('componentInstance data_provided event received', { subject: message.subject })
}
