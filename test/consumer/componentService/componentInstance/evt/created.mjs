import test from 'node:test'
import assert from 'node:assert/strict'

import router from '@liquid-bricks/shared-providers/subject/router'
import { diagnostics as makeDiagnostics } from '@liquid-bricks/shared-providers/diagnostics'
import { spec as evtSpec, path as evtPath } from '../../../../../consumer/componentService/componentInstance/evt/created.js'

test('componentInstance/evt/created: acks valid event', async () => {
  const diagnostics = makeDiagnostics()

  let acked = false
  const message = {
    subject: 'prod.component-service.tenant.ctx.evt.componentInstance.created.v1',
    json: () => ({ data: { instanceId: `i_${Date.now()}`, componentId: `c_${Date.now()}` } }),
    ack: () => { acked = true },
  }

  const r = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { diagnostics },
  }).route(evtPath, evtSpec)

  await r.request({ subject: message.subject, message })
  assert.equal(acked, true)
})

test('componentInstance/evt/created: rejects missing fields', async () => {
  const diagnostics = makeDiagnostics()

  const message = {
    subject: 'prod.component-service.tenant.ctx.evt.componentInstance.created.v1',
    json: () => ({ data: { instanceId: '' } }),
    ack: () => {},
  }

  const r = router({
    tokens: ['env', 'ns', 'tenant', 'context', 'channel', 'entity', 'action', 'version', 'id'],
    context: { diagnostics },
  }).route(evtPath, evtSpec)

  await assert.rejects(() => r.request({ subject: message.subject, message }))
})

