export const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "edge.has_import.component__component",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "alias",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "alias": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
