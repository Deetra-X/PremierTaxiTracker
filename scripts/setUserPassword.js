import bcrypt from "bcryptjs";

import { pool } from "../src/config/db.js";
import { connectDb, disconnectDb } from "../src/config/db.js";

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const email = getArg("email") ?? process.env.EMAIL ?? null;
const password = getArg("password") ?? process.env.PASSWORD ?? null;

if (!email || !password) {
  // eslint-disable-next-line no-console
  console.error(
    "Usage: node scripts/setUserPassword.js --email <email> --password <password>"
  );
  process.exitCode = 2;
} else {
  await connectDb();
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "update users set password_hash = $1 where lower(email) = lower($2) returning user_id, email, role",
      [hash, email]
    );
    if (!r.rowCount) {
      // eslint-disable-next-line no-console
      console.error("No user found for email:", email);
      process.exitCode = 3;
    } else {
      // eslint-disable-next-line no-console
      console.log("Password updated:", r.rows[0]);
    }
  } finally {
    await disconnectDb();
  }
}

