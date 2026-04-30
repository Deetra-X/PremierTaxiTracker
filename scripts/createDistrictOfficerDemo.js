import bcrypt from "bcryptjs";

import { pool } from "../src/config/db.js";

// Creates a district officer user assigned to a station in the chosen district.
// Usage: node scripts/createDistrictOfficerDemo.js <districtId> <email> <password>
const districtId = Number(process.argv[2] ?? 1);
const email = process.argv[3] ?? "district.officer@police.lk";
const password = process.argv[4] ?? null;

if (!password) {
  // eslint-disable-next-line no-console
  console.error("Usage: node scripts/createDistrictOfficerDemo.js <districtId> <email> <password>");
  process.exitCode = 2;
  process.exit();
}

const station = await pool.query(
  "select station_id from police_stations where district_id = $1 order by station_id limit 1",
  [districtId]
);
if (!station.rowCount) {
  // eslint-disable-next-line no-console
  console.error("No station found for district:", districtId);
  process.exitCode = 2;
  process.exit();
}

const hash = await bcrypt.hash(password, 10);

await pool.query(
  `insert into users (station_id, full_name, email, password_hash, role, is_active)
   values ($1, $2, $3, $4, 'DISTRICT_OFFICER', true)
   on conflict (email) do update
     set station_id = excluded.station_id,
         password_hash = excluded.password_hash,
         role = excluded.role,
         is_active = true`,
  [station.rows[0].station_id, "District Officer", email, hash]
);

// eslint-disable-next-line no-console
console.log("District officer ready:", { districtId, email });
process.exit();

