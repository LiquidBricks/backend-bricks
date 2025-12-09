import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocket } from 'ws'

import { componentDispatcher } from '../../../consumer/componentDispatcher/index.js'
import { Codes } from '../../../consumer/componentProvider/codes.js'

const DEFAULT_TIMEOUT = 5000

function createDiagnosticsStub() {
  const calls = { info: [], warn: [], require: [] }
  class DiagnosticError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  }
  const stub = {
    calls,
    DiagnosticError,
    child() { return stub },
    info(...args) { calls.info.push(args) },
    warn(...args) { calls.warn.push(args) },
    require(value, code, message, meta) {
      calls.require.push({ value, code, message, meta })
      if (!value) throw new DiagnosticError(message, code)
    },
  }
  return stub
}

async function startDispatcher() {
  const server = http.createServer()
  const diagnostics = createDiagnosticsStub()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const dispatcher = await componentDispatcher({ server, diagnostics })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const url = `ws://127.0.0.1:${port}/componentAgent`
  return { server, url, diagnostics, dispatcher }
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve))
}

async function shutdown(ws, server) {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
      try { await waitForClose(ws) } catch { }
    }
  } finally {
    try { await closeServer(server) } catch { }
  }
}

function waitForOpen(ws, timeoutMs = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timed out')), timeoutMs)
    ws.once('open', () => { clearTimeout(timer); resolve() })
    ws.once('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

function waitForMessage(ws, timeoutMs = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket message timed out')), timeoutMs)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(typeof data === 'string' ? data : data.toString())
    })
    ws.once('error', (err) => { clearTimeout(timer); reject(err) })
    ws.once('close', () => { clearTimeout(timer); reject(new Error('WebSocket closed before message')) })
  })
}

function waitForClose(ws, timeoutMs = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket close timed out')), timeoutMs)
    ws.once('close', () => { clearTimeout(timer); resolve() })
    ws.once('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

test('componentDispatcher sends an initial connected message', async () => {
  const { server, url } = await startDispatcher()
  const ws = new WebSocket(url)
  const initialMessage = waitForMessage(ws)

  try {
    await waitForOpen(ws)
    const initial = JSON.parse(await initialMessage)
    assert.deepEqual(initial, { ok: true, message: 'componentDispatcher connected' })
  } finally {
    await shutdown(ws, server)
  }
})

test('componentDispatcher rejects invalid JSON payloads', async () => {
  const { server, url, diagnostics } = await startDispatcher()
  const ws = new WebSocket(url)
  const initialMessage = waitForMessage(ws)

  try {
    await waitForOpen(ws)
    await initialMessage // consume initial connected message

    ws.send('not-json')
    const response = JSON.parse(await waitForMessage(ws))

    assert.equal(response.ok, false)
    assert.equal(response.error, 'Invalid JSON payload')
    assert.ok(
      diagnostics.calls.warn.some((args) => args[1] === Codes.PRECONDITION_INVALID),
      'warn called with PRECONDITION_INVALID'
    )
  } finally {
    await shutdown(ws, server)
  }
})

test('componentDispatcher replies with generic not-served response for valid payloads', async () => {
  const { server, url } = await startDispatcher()
  const ws = new WebSocket(url)
  const initialMessage = waitForMessage(ws)

  try {
    await waitForOpen(ws)
    await initialMessage // consume initial connected message

    ws.send(JSON.stringify({ ping: true }))
    const response = JSON.parse(await waitForMessage(ws))

    assert.deepEqual(response, { ok: false, error: 'componentDispatcher does not serve components' })
  } finally {
    await shutdown(ws, server)
  }
})

test('componentDispatcher tracks connections in a registry', async () => {
  const { server, url, dispatcher } = await startDispatcher()
  const ws = new WebSocket(url)
  const initialMessage = waitForMessage(ws)

  try {
    await waitForOpen(ws)
    await initialMessage // consume initial connected message

    assert.equal(dispatcher.connectionRegistry.size, 1)

    ws.close()
    await waitForClose(ws)

    assert.equal(dispatcher.connectionRegistry.size, 0)
  } finally {
    await shutdown(ws, server)
  }
})
