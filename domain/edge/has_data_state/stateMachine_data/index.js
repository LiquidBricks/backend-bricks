import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ fromId, toId, status = constants.Status.WAITING, result = null }) {
    const now = new Date().toISOString();
    await g
      .addE(constants.LABEL, fromId, toId)
      .property('status', status)
      .property('result', result)
      .property('createdAt', now)
      .property('updatedAt', now)
  }
}

export function stateMachine_data({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
