import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ state = constants.STATES.CREATED } = {}) {
    const now = new Date().toISOString();
    const [id] = await g
      .addV(constants.LABEL)
      .property('state', state)
      .property('createdAt', now)
      .property('updatedAt', now)
      .id();
    return { id }
  }
}

export function stateMachine({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
