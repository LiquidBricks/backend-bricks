import { GraphQLBoolean, GraphQLEnumType, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'


const ClientLogPayloadType = new GraphQLObjectType({
  name: 'ClientLogPayload',
  fields: () => ({
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    correlationId: { type: GraphQLString },
  }),
})

const ClientLogLevelEnum = new GraphQLEnumType({
  name: 'ClientLogLevel',
  values: {
    DEBUG: { value: 'debug' },
    INFO: { value: 'info' },
    WARN: { value: 'warn' },
    ERROR: { value: 'error' },
    FATAL: { value: 'fatal' },
  },
})

export const clientLogField = {
  type: new GraphQLNonNull(ClientLogPayloadType),
  args: {
    message: { type: new GraphQLNonNull(GraphQLString) },
    details: { type: GraphQLString },
    level: { type: ClientLogLevelEnum },
  },
  resolve: async (_source, { message, details, level }, { diagnostics }) => {

    let parsedDetails
    if (typeof details === 'string' && details.trim().length) {
      try {
        parsedDetails = JSON.parse(details)
      } catch (_err) {
        parsedDetails = { rawDetails: details }
      }
    }

    try {
      const normalized = typeof level === 'string' ? level.toLowerCase() : 'error'
      const meta = parsedDetails ?? undefined

      switch (normalized) {
        case 'debug':
          diagnostics.debug(message, meta)
          break
        case 'info':
          diagnostics.info(message, meta)
          break
        case 'warn':
          // diagnostics.warn logs without throwing when first arg is false
          diagnostics.warn(false, 'CLIENT_LOG_WARN', message, meta)
          break
        case 'fatal':
          // treat fatal as non-throwing log event
          diagnostics.warn(false, 'CLIENT_LOG_FATAL', message, meta)
          break
        case 'error':
        default:
          // Do not throw; record as warning-level diagnostic with error code
          diagnostics.warn(false, 'CLIENT_LOG_ERROR', message, meta)
          break
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('clientLog emit failed', { err })
      throw err
    }

    return { ok: true }
  },
}
