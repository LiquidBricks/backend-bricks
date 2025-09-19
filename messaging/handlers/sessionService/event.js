export async function handle({ client, m }) {
  const { event, data } = m.json()
  console.log('sessionService.event', { event, data })
  return m.ack()
}
