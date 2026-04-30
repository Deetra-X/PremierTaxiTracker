import bcrypt from "bcryptjs";

import { pool } from "../src/config/db.js";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  // eslint-disable-next-line no-console
  console.log("Usage: node scripts/checkUserPassword.js <email> <password>");
  process.exitCode = 2;
} else {
  const { rows } = await pool.query(
    "select user_id,email,password_hash,is_active from users where lower(email) = lower($1)",
    [email]
  );
  const user = rows[0];
  // eslint-disable-next-line no-console
  console.log(user);
  if (!user) {
    process.exitCode = 3;
  } else {
    const ok = await bcrypt.compare(password, user.password_hash);
    // eslint-disable-next-line no-console
    console.log("compare:", ok);
  }
  process.exit();
}

