import test from 'node:test'
import assert from 'node:assert/strict'
import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { schema } from '../../../graphql/index.js'
import { runGql } from '../../util/runGql.js'

test('componentInstanceProvideData publishes typed payload', async () => {
  const published = []
  const natsContext = {
    publish: async (subject, data) => {
      published.push({ subject, data })
    },
  }

  const variables = {
    instanceId: 'instance-1',
    stateId: 'state-1',
    name: 'Data Node',
    type: 'DATA',
    payload: '{"count":2,"active":false}',
  }

  const result = await runGql({
    schema,
    source: `mutation ProvideData($instanceId: String!, $stateId: String!, $name: String!, $type: String!, $payload: String!) {
      componentInstanceProvideData(instanceId: $instanceId, stateId: $stateId, name: $name, type: $type, payload: $payload) {
        ok
      }
    }`,
    variableValues: variables,
    contextValue: { natsContext },
  })

  assert.ok(!result.errors?.length, `Unexpected errors: ${result.errors?.map((err) => err.message).join(', ')}`)
  assert.deepEqual(result.data?.componentInstanceProvideData, { ok: true })
  assert.equal(published.length, 1, 'publish should be called once')

  const { subject, data } = published[0]
  const parsed = JSON.parse(data)
  const expectedSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('result_computed')
    .version('v1')
    .build()

  assert.equal(subject, expectedSubject)
  assert.deepEqual(parsed?.data, {
    instanceId: variables.instanceId,
    stateId: variables.stateId,
    name: variables.name,
    type: 'data',
    result: { count: 2, active: false },
  })
  assert.equal(typeof parsed.data.result.count, 'number')
  assert.equal(typeof parsed.data.result.active, 'boolean')
})
