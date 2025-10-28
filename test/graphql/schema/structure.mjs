import test from 'node:test'
import assert from 'node:assert/strict'
import { GraphQLObjectType } from 'graphql'
import { schema } from '../../../graphql/index.js'

const IGNORED_TYPES = new Set(['Query', 'Mutation', 'Subscription', 'PageInfo'])

const shouldEnforce = (typeName) => {
  if (IGNORED_TYPES.has(typeName)) return false
  if (typeName.startsWith('__')) return false
  if (typeName.endsWith('Connection')) return false
  if (typeName.endsWith('Edge')) return false
  if (typeName.endsWith('Payload')) return false
  if (typeName.endsWith('CodeRef')) return false
  if (typeName.endsWith('DependencyType')) return false
  return true
}

test('object types expose createdAt/updatedAt and hide id', () => {
  const typeMap = schema.getTypeMap()
  for (const typeName of Object.keys(typeMap)) {
    const type = typeMap[typeName]
  if (!(type instanceof GraphQLObjectType)) continue

  const fields = type.getFields()

  for (const field of Object.values(fields)) {
    for (const arg of field.args || []) {
      assert.notEqual(arg.name, 'id', `${typeName}.${field.name} accepts forbidden id argument`)
    }
  }

  if (!shouldEnforce(typeName)) continue

  assert.ok(fields.createdAt, `${typeName} missing createdAt field`)
  assert.ok(fields.updatedAt, `${typeName} missing updatedAt field`)
  assert.ok(!fields.id, `${typeName} exposes forbidden id field`)
  }
})
