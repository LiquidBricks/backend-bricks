import { component } from '../../../types/component/index.js'

export async function handle({ client, m }) {
  const { command, data } = m.json()
  if (command === 'register') {
    const { hash, name, data: compData, tasks } = data
    await component.register({
      hash,
      name,
      tasks,
      data: compData,
    })
    await client.publish('componentService.event', JSON.stringify({
      event: 'registered',
      data: { hash },
    }))
    return m.ack()
  } else if (command === 'create') {
    const { runID, id } = data
    console.log(`Creating component instance of id: ${id}, runID: ${runID}`)
    return m.ack()
  }
  return m.nak()
}
