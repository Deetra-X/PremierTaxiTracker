import { pool } from "../src/config/db.js";

const col = await pool.query(
  `select
     column_name,
     data_type,
     character_maximum_length
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'users'
     and column_name = 'password_hash'`
);

// eslint-disable-next-line no-console
console.log(col.rows[0]);

const sample = await pool.query(
  "select user_id, email, length(password_hash) as len, password_hash from users where email = $1",
  ["hqadmin@police.lk"]
);
// eslint-disable-next-line no-console
console.log(sample.rows[0]);

process.exit();

