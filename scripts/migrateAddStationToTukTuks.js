import { pool } from "../src/config/db.js";

// 1) Add station_id column + FK (idempotent)
await pool.query("alter table tuk_tuks add column if not exists station_id integer");
await pool.query(`
  do $$
  begin
    if not exists (
      select 1
      from pg_constraint
      where conname = 'fk_tuktuk_station'
    ) then
      alter table tuk_tuks
      add constraint fk_tuktuk_station
      foreign key (station_id)
      references police_stations(station_id)
      on delete set null;
    end if;
  end $$;
`);

await pool.query("create index if not exists idx_tuktuk_station on tuk_tuks(station_id)");

// 2) Backfill station_id for existing tuk_tuks:
//    pick the first police station in the tuk-tuk's district.
await pool.query(`
  update tuk_tuks t
  set station_id = ps.station_id
  from (
    select distinct on (district_id) district_id, station_id
    from police_stations
    order by district_id, station_id
  ) ps
  where t.station_id is null
    and t.district_id = ps.district_id
`);

// eslint-disable-next-line no-console
console.log("Migration complete: tuk_tuks.station_id ensured and backfilled.");

process.exit();

