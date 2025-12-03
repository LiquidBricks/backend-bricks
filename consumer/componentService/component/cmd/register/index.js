import { ackMessage, decodeData } from '../../../middleware.js'
import { handler } from './handler/index.js'
import { skipIfExists } from './skipIfExists.js'
import { publishEvents } from './publishEvents/index.js'
import { validatePayload } from './validatePayload/index.js'

export const path = { channel: 'cmd', entity: 'component', action: 'register' }

export const spec = {
  decode: [
    /*
    todo: create a hook function which takes the diagnostics from the rootctx and returns it on scope. 
    the scope var should be named diag.
    diag should be a child of diagnostics and include the hook name.
    */
    decodeData('component'),
    validatePayload,
  ],
  pre: [
    skipIfExists,
  ],
  handler,
  post: [
    ackMessage,
    publishEvents,
  ],
}
