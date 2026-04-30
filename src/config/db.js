import { getEnv } from "./env.js";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: getEnv("DATABASE_URL"),
  ssl: { rejectUnauthorized: false }
});

export async function connectDb() {
  const client = await pool.connect();
  try {
    await client.query("select 1");
  } finally {
    client.release();
  }

  return pool;
}

export async function disconnectDb() {
  await pool.end();
}