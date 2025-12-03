export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "edge.has_task.component__task",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}

