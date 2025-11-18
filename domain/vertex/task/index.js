import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ name, fnc, codeRef: { file, line, column } }) {
    const now = new Date().toISOString();
    const [id] = await g
      .addV(constants.LABEL)
      .property('name', name)
      .property('fnc', fnc)
      .property('codeRef', { file, line, column })
      .property('createdAt', now)
      .property('updatedAt', now)
      .id();
    return { id }
  }
}

export function task({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
