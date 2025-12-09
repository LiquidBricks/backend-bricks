export const path = { channel: 'metric' };
export const spec = {
  tokens: ['entity', 'version'],
  pre: [
  ],
  children: [
    [{ entity: 'counter' }, { handler: () => { console.log('counter') } }],
    [{ entity: 'histogram' }, { handler: () => { console.log('histogram') } }],
  ],
  post: [
    ackMessage,
  ]
}

// post middlewares
function ackMessage({ message }) { message.ack() }
