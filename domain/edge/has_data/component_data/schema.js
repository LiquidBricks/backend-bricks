export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "edge.has_data.component__data",
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

