import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ fromId, toId }) {
    await g
      .addE(constants.LABEL, fromId, toId)
  }
}

export function data_deferred({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
