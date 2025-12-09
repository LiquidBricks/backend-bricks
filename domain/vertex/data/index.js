import { schema } from "./schema.js";
import * as constants from './constants.js'

function create({ g, diagnostics }) {
  return async function ({ name, fnc, codeRef: { file, line, column } }) {
    const now = new Date().toISOString();
    const vertex = g
      .addV(constants.LABEL)
      .property('name', name)
      .property('codeRef', { file, line, column })
      .property('createdAt', now)
      .property('updatedAt', now)

    if (fnc !== undefined) {
      vertex.property('fnc', fnc)
    }

    const [id] = await vertex.id();
    return { id }
  }
}

export function data({ g, diagnostics }) {
  return {
    create: create({ g, diagnostics })
  }
}

export const meta = {
  schema,
  constants,
}
