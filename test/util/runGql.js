import { graphql } from 'graphql'

export async function runGql({ schema, source, variableValues, contextValue }) {
  return graphql({ schema, source, variableValues, contextValue })
}
