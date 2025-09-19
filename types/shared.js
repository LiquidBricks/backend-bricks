import assert from "node:assert";
import { connection } from "../natsConnection.js";

// Cache bucket promises per TYPE to enforce singletons per bucket
const bucketPromises = new Map();

export async function getBucket(type) {
  assert(typeof type === 'string' && type.length > 0, 'Type must be a non-empty string');
  const promise = (async () => {
    const kv = await connection.Kvm();
    return kv.create(type);
  })();
  bucketPromises.set(type, promise);

  return bucketPromises.get(type);
}

