export const path = { channel: 'trace' };
export const spec = {
  tokens: ['entity', 'version'],
  pre: [
  ],
  children: [
    [{ entity: '*' }, { handler: () => { console.log('trace *') } }],
  ],
  post: [
    ackMessage,
  ]
}

// post middlewares
function ackMessage({ message }) { message.ack() }
