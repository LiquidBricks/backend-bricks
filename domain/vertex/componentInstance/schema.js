export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "vertex.componentInstance",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "instanceId",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "instanceId": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}

