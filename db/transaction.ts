import "server-only";

import { Pool, type PoolClient } from "pg";

const globalForPool = globalThis as typeof globalThis & { masarakPool?: Pool };

export function getTransactionPool() {
  if (globalForPool.masarakPool) return globalForPool.masarakPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString, max: 3 });
  if (process.env.NODE_ENV !== "production") globalForPool.masarakPool = pool;
  return pool;
}

export async function inNeonTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getTransactionPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
