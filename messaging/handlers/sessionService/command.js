import * as SessionService from '../../../types/session/index.js'

export async function handle({ client, m }) {
  const { command, data } = m.json()
  if (command === 'create') {
    const { id, metadata } = data || {};
    const res = await SessionService.session.create({ id, metadata });
    await client.publish('sessionService.event', JSON.stringify({ event: 'created', data }))
    return m.ack()
  } else if (command === 'addComponent') {
    const { sessionID, componentID } = data;
    await SessionService.session.V(sessionID).addE('has_component', componentID)
    await client.publish('sessionService.event', JSON.stringify({ event: 'componentAdded', data }))
    return m.ack()
  }
  return m.nak()
}
