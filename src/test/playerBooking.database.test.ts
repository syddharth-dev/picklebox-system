// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const player = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const court = "00000000-0000-4000-8000-000000000010";
const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const item = (start = "18:00:00", end = "19:00:00") => ({ court_id: court, start_time: start, end_time: end, amount: 1 });
async function book(items = [item()], dayOffset = 1, reference: string | null = " GCash reference ") {
  return db.query<{ ids: string[] }>("SELECT create_bookings_atomic((now() AT TIME ZONE 'Asia/Manila')::date + $1::int, $2::text, $3::jsonb) AS ids", [dayOffset, reference, JSON.stringify(items)]);
}
beforeAll(async () => {
  // Surrounding schema is a fixture; the atomic RPC and guard use production SQL.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TYPE public.app_role AS ENUM ('admin','user');
    CREATE TYPE public.booking_status AS ENUM ('pending','paid','cancelled','completed');
    CREATE TABLE user_roles(user_id uuid, role public.app_role);
    CREATE TABLE courts(id uuid PRIMARY KEY, price_per_hour numeric, is_active boolean);
    CREATE TABLE bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, court_id uuid, booking_date date, start_time time, end_time time, total_amount numeric, status public.booking_status, is_admin_block boolean DEFAULT false);
    CREATE TABLE booking_slots(booking_id uuid, court_id uuid, booking_date date, start_time time, is_reserved boolean);
    CREATE UNIQUE INDEX reserved_slot_unique ON booking_slots(court_id,booking_date,start_time) WHERE is_reserved;
    CREATE TABLE payments(booking_id uuid, user_id uuid, amount numeric, payment_method text, transaction_reference text, status text);
  `);
  const sql = migration("20260917120000_security_hardening.sql");
  await db.exec(sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.has_role"), sql.indexOf("-- Do not expose cancelled")));
  if (process.env.PLAYER_AUDIT_BASELINE !== "1") await db.exec(migration("20261031120000_player_booking_time_guards.sql"));
}, 120_000);
beforeEach(async () => {
  await db.exec("TRUNCATE bookings, booking_slots, payments, courts, user_roles");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [player]);
  await db.query("INSERT INTO courts VALUES($1,200,true)", [court]);
});
afterAll(() => db.close());
describe("Player booking database boundaries", () => {
  it("rejects a past hour today", async () => {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    const start = Math.min(hour, 22);
    await expect(book([item(`${String(start).padStart(2, "0")}:00`, `${String(start + 1).padStart(2, "0")}:00`)], 0)).rejects.toThrow(/BOOKING_TIME_PASSED|INVALID_BOOKING_TIME/);
  });
  it("rejects dates beyond the advertised booking window", async () => { await expect(book([item()], 61)).rejects.toThrow("INVALID_BOOKING_DATE"); });
  it.each([["06:00", "07:00"], ["23:00", "24:00"]])("rejects out-of-hours ranges %s to %s", async (start, end) => { await expect(book([item(start, end)])).rejects.toThrow("INVALID_BOOKING_TIME"); });
  it("derives charges from stored prices and keeps payments pending", async () => {
    const result = await book([item("18:00", "20:00")]);
    expect(result.rows[0].ids).toHaveLength(1);
    expect((await db.query("SELECT total_amount, status FROM bookings")).rows).toEqual([{ total_amount: "400.00", status: "pending" }]);
    expect((await db.query("SELECT amount, transaction_reference, status FROM payments")).rows).toEqual([{ amount: "400.00", transaction_reference: "GCash reference", status: "pending" }]);
  });
  it("rolls back every new booking and payment if any selected hour conflicts", async () => {
    await book([item("20:00", "21:00")]);
    await expect(book([item("18:00", "19:00"), item("20:00", "21:00")])).rejects.toThrow("SLOT_TAKEN");
    expect((await db.query("SELECT * FROM bookings")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM payments")).rows).toHaveLength(1);
  });
  it("does not let another account cancel a player's reservation", async () => {
    const id = (await book()).rows[0].ids[0];
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
    await expect(db.query("SELECT cancel_booking_reservation($1)", [id])).rejects.toThrow("BOOKING_NOT_CANCELLABLE");
  });
  it("cancellation releases pending slots and payment records together", async () => {
    const id = (await book()).rows[0].ids[0];
    await db.query("SELECT cancel_booking_reservation($1)", [id]);
    expect((await db.query("SELECT is_reserved FROM booking_slots")).rows).toEqual([{ is_reserved: false }]);
    expect((await db.query("SELECT status FROM payments")).rows).toEqual([{ status: "failed" }]);
  });
  it("requires a signed-in user before reserving anything", async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
    await expect(book()).rejects.toThrow("AUTH_REQUIRED");
  });
});
