import { s } from "@liquid-bricks/shared-providers/subject/router";
import { Errors } from "../../errors.js";

const levelPriority = { error: 40, warn: 30, info: 20, debug: 10, trace: 5 };
const currentLogLevel = 'info';

export const path = { channel: 'log' };
export const spec = {
  tokens: ['version'],
  decode: [
    decodeLogPayload,
  ],
  pre: [
    validateData,
    checkLevelThreshold,
  ],
  handler,
  post: [
    ackMessage,
  ]
}

// decode middleware
function decodeLogPayload({ message }) {
  const { ts, level, attributes, kind } = message.json()
  return { ts, level, attributes, kind }
}

// pre middlewares
function validateData({ scope: { ts, level, attributes, kind }, message, rootCtx: { diagnostics } }) {
  diagnostics.invariant(kind === 'log', Errors.PRECONDITION_INVALID, `Invalid telemetry kind: ${kind}`, { kind, subject: message.subject })
  diagnostics.require(level, Errors.PRECONDITION_REQUIRED, 'Log level is required', { field: 'level', subject: message.subject })
  diagnostics.require(ts, Errors.PRECONDITION_REQUIRED, 'Log timestamp is required', { field: 'ts', subject: message.subject })
  diagnostics.require(attributes, Errors.PRECONDITION_REQUIRED, 'Log attributes are required', { field: 'attributes', subject: message.subject })
  diagnostics.require(attributes.msg, Errors.PRECONDITION_REQUIRED, 'Log message is required', { field: 'message', subject: message.subject })
  diagnostics.require(attributes.meta, Errors.PRECONDITION_REQUIRED, 'Log info is required', { field: 'info', subject: message.subject })
}

function checkLevelThreshold({ scope: { level, [s.scope.ac]: abortCtl }, rootCtx: { diagnostics } }) {
  diagnostics.require(Object.keys(levelPriority).includes(level), Errors.PRECONDITION_INVALID, `Invalid log level: ${level}`, { level })

  levelPriority[level] < levelPriority[currentLogLevel] &&
    abortCtl.abort({ reason: 'log level below threshold', level, threshold: currentLogLevel })
}

// handler
function handler({ scope: { level, ts, attributes }, message }) {

  const time = (new Date(ts)).toLocaleTimeString()
  const out = `[${time}] ${level.toUpperCase()} ${attributes.msg}`
  // eslint-disable-next-line no-console
  console[level](message.subject, JSON.stringify({ out, attributes }, null, 2))
}

// post middlewares
function ackMessage({ message }) { message.ack() }
