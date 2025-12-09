import { Status } from "./constants.js";

export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "edge.has_task_state.stateMachine__task",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "status",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "status": { "type": "string", "enum": Object.values(Status) },
    "result": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
