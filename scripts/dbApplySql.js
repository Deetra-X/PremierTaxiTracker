import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

import { getEnv } from "../src/config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripUsefulQueriesSection(sql) {
  const marker = /--\s*=+\s*\n--\s*USEFUL QUERIES[\s\S]*$/m;
  return sql.replace(marker, "");
}

function maybeRemoveDropStatements(sql, { reset }) {
  if (reset) return sql;
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().toUpperCase().startsWith("DROP TABLE "))
    .join("\n");
}

async function main() {
  const reset = process.env.RESET_DB === "1" || process.env.RESET_DB === "true";
  const sqlPath =
    process.env.SQL_PATH ??
    path.resolve(__dirname, "..", "database_file(table design).sql");

  const raw = await fs.readFile(sqlPath, "utf8");
  const sql = maybeRemoveDropStatements(stripUsefulQueriesSection(raw), { reset });

  const client = new Client({
    connectionString: getEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const info = await client.query(
      "select current_database() as db, current_user as user, inet_server_addr() as host"
    );
    // eslint-disable-next-line no-console
    console.log("Connected:", info.rows[0]);

    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log("SQL applied OK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

