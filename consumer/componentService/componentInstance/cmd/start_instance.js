import { Errors } from '../../../errors.js'
import { decodeData, ackMessage, startDiagnosticsTimer, stopDiagnosticsTimer } from '../../middleware.js'

export const path = { channel: 'cmd', entity: 'componentInstance', action: 'start_instance' }
export const spec = {
  decode: [
    decodeData('data'),
  ],
  pre: [
    logItWasReceived,
    startDiagnosticsTimer,
  ],
  handler,
  post: [
    stopDiagnosticsTimer(({ scope: { data: { instanceId } } }) => ({ instanceId })),
    ackMessage,
  ]
}

// decode handled via shared helper

// post middlewares handled via shared helper

function logItWasReceived({ rootCtx: { diagnostics }, scope: { data: { instanceId } } }) {
  diagnostics.info('componentInstance start_instance command received', { instanceId })
}

export async function handler({ rootCtx: { diagnostics }, scope: { data: { instanceId } } }) {
  diagnostics.require(typeof instanceId === 'string' && instanceId.length, Errors.PRECONDITION_REQUIRED, 'instanceId required for start_instance', { field: 'instanceId' })
  diagnostics.info('componentInstance start requested', { code: Errors.COMPONENT_INSTANCE_START_REQUESTED, instanceId })
  return null
}
