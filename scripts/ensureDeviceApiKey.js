import crypto from "node:crypto";

import { pool } from "../src/config/db.js";
import { connectDb, disconnectDb } from "../src/config/db.js";

function genKey() {
  return crypto.randomBytes(24).toString("hex");
}

await connectDb();

// add column if missing
await pool.query("alter table gps_devices add column if not exists api_key text unique");

// backfill null keys
const r = await pool.query("select device_id from gps_devices where api_key is null");
for (const row of r.rows) {
  // eslint-disable-next-line no-await-in-loop
  await pool.query("update gps_devices set api_key = $1 where device_id = $2", [
    genKey(),
    row.device_id
  ]);
}

// eslint-disable-next-line no-console
console.log("Device api_key ensured");

await disconnectDb();

