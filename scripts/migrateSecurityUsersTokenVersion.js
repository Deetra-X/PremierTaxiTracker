import { pool } from "../src/config/db.js";
import { connectDb, disconnectDb } from "../src/config/db.js";

await connectDb();

await pool.query("alter table users add column if not exists token_version integer not null default 0");
await pool.query(
  "alter table users add column if not exists password_changed_at timestamp default current_timestamp"
);

// Best-effort backfill: if password_changed_at is null, set to created_at (or now)
await pool.query(
  "update users set password_changed_at = coalesce(created_at, current_timestamp) where password_changed_at is null"
);

// eslint-disable-next-line no-console
console.log("Security migration applied: users.token_version + users.password_changed_at");

await disconnectDb();

