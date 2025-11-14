export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "vertex.deferred",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "name",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "name": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}

