
export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "vertex.component",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "hash",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "hash": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    }
  }
}