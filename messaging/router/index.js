import * as componentCommand from '../handlers/componentService/command.js'
import * as componentEvent from '../handlers/componentService/event.js'
import * as sessionCommand from '../handlers/sessionService/command.js'
import * as sessionEvent from '../handlers/sessionService/event.js'

const routes = {
  'componentService.command': componentCommand.handle,
  'componentService.event': componentEvent.handle,
  'sessionService.command': sessionCommand.handle,
  'sessionService.event': sessionEvent.handle,
}

export async function route({ subject, client, m }) {
  const handler = routes[subject];
  if (!handler) {
    try { return m.nak() } catch {}
    return
  }
  return handler({ client, m })
}
