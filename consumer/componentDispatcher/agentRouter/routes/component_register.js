import { create as createSubject } from '@liquid-bricks/shared-providers/subject/create/basic'

export const path = {
  channel: 'cmd', entity: 'component',
  action: 'register', context: 'component-agent'
}

export const spec = {
  handler: async ({ message, rootCtx: { natsContext } }) => {
    const parts = String(message?.subject ?? '').split('.')
    const [env, ns, tenant, , , , , version, id] = parts

    const subject = createSubject()
      .set(parts.length === 9 ? { env, ns, tenant, version, id } : {})
      .context('component-dispatcher')
      .channel('cmd')
      .entity('component')
      .action('register')
      .build()

    const payload = { data: message.data }
    await natsContext.publish(subject, JSON.stringify(payload))
  },
}