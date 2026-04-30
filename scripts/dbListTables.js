import { Client } from "pg";

import { getEnv } from "../src/config/env.js";

const c = new Client({
  connectionString: getEnv("DATABASE_URL"),
  ssl: { rejectUnauthorized: false }
});

await c.connect();
try {
  const r = await c.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename"
  );
  // eslint-disable-next-line no-console
  console.log(r.rows.map((x) => x.tablename).join("\n"));
} finally {
  await c.end();
}

