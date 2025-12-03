import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ fromId, toId }) {
    const now = new Date().toISOString();
    await g
      .addE(constants.LABEL, fromId, toId)
      .property('createdAt', now)
      .property('updatedAt', now)
  }
}

export function componentInstance_stateMachine({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
