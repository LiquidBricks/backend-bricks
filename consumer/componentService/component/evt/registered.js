import { ackMessage, decodeData } from '../../middleware.js'
import { Errors } from '../../../errors.js'

export const path = { channel: 'evt', entity: 'component', action: 'registered' }
export const spec = {
  decode: [
    // Extract only the hash from message.data
    decodeData(['hash']),
    validateData,
  ],
  pre: [
    logItWasReceived,
  ],
  handler() { },
  post: [
    ackMessage,
  ]
}

function validateData({ rootCtx: { diagnostics }, scope: { hash } }) {
  diagnostics.require(
    hash,
    Errors.PRECONDITION_REQUIRED,
    'Component hash is required',
    { field: 'hash' }
  )
}

function logItWasReceived({ rootCtx: { diagnostics }, scope: { hash }, message }) {
  diagnostics.info('component registered event received', { hash, subject: message.subject })
}
