export const serializeError = (error) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }
  if (error && typeof error === 'object') return error
  return { message: String(error) }
}

export async function logClientError(endpoint, { message, details = null, level = 'error' } = {}) {
  const normalizedEndpoint = typeof endpoint === 'string' && endpoint.length ? endpoint : null
  if (!normalizedEndpoint || typeof message !== 'string' || !message.length) {
    return
  }

  let serializedDetails = null
  if (details != null) {
    try {
      serializedDetails = JSON.stringify(details)
    } catch (err) {
      serializedDetails = JSON.stringify({ fallback: String(details), error: err?.message })
    }
  }

  try {
    const response = await fetch(normalizedEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `mutation ClientLog($message: String!, $level: String, $details: String) {
          clientLog(message: $message, level: $level, details: $details) {
            ok
            correlationId
          }
        }`,
        variables: {
          message,
          level,
          details: serializedDetails,
        },
      }),
    })

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn('client log request failed', { status: response.status })
      return
    }

    const payload = await response.json()
    if (payload.errors?.length) {
      // eslint-disable-next-line no-console
      console.warn('client log mutation returned errors', payload.errors)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('client log mutation failed', err)
  }
}
