import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ fromId, toId, alias }) {
    const now = new Date().toISOString();
    await g
      .addE(constants.LABEL, fromId, toId)
      .property('alias', alias)
      .property('createdAt', now)
      .property('updatedAt', now)
  }
}

export function componentInstance_componentInstance({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
