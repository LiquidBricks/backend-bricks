export async function handle({ client, m }) {
  const { event, data } = m.json()
  if (event === 'registered') {
    const { hash } = data;
    // Additional side-effects on registered can be placed here
    return m.ack()
  }
  return m.nak()
}
