// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const player = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
const court = "00000000-0000-4000-8000-000000000010";
const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
async function asUser(id: string | null, role = id ? "authenticated" : "anon") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await db.exec(`SET ROLE ${role}`);
}
async function book(start = "18:00", end = "19:00", offset = 1) {
  return (await db.query<{ ids: string[] }>(`SELECT public.create_bookings_atomic(
    (now() AT TIME ZONE 'Asia/Manila')::date + $1::int, 'reference', $2::jsonb) AS ids`,
  [offset, JSON.stringify([{ court_id: court, start_time: start, end_time: end, amount: 0, status: "paid", user_id: other }])])).rows[0].ids[0];
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    -- pgcrypto is not bundled in PGlite. Only random-byte generation is a
    -- fixture; policies, privileges and API functions are production SQL.
    CREATE FUNCTION public.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql VOLATILE AS
      $$ SELECT decode(md5(random()::text), 'hex') $$;
    CREATE PUBLICATION supabase_realtime;
  `);
  await db.exec(migration("20260205050532_7a98f9ad-8ae3-4360-be08-41e668ee554a.sql"));
  await db.exec(`
    ALTER TABLE bookings ADD COLUMN is_admin_block boolean NOT NULL DEFAULT false, ADD COLUMN admin_note text;
    -- The later overlap migration retires the original all-status unique key.
    -- PGlite lacks btree_gist; slot uniqueness below supplies fixture conflicts.
    ALTER TABLE bookings DROP CONSTRAINT no_double_booking;
    CREATE TABLE booking_slots(booking_id uuid REFERENCES bookings(id), court_id uuid, booking_date date,
      start_time time, is_reserved boolean DEFAULT true);
    CREATE UNIQUE INDEX slots_reserved_unique ON booking_slots(court_id, booking_date, start_time) WHERE is_reserved;
    ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "legacy shared slots" ON booking_slots FOR SELECT TO authenticated USING (true);
    CREATE FUNCTION public.create_booking_reservation(uuid,date,time[],text) RETURNS jsonb
      LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{"legacy": true}'::jsonb $$;
  `);
  await db.exec(migration("20260205050611_edb67597-8710-4ac0-b9fb-7b571ea1321a.sql"));
  await db.exec(migration("20260205053357_398840fb-f162-4e2e-9a38-4b513e1eba60.sql"));
  await db.exec(migration("20260301133148_035be763-5145-49b4-84e7-54bf2ae6f9fd.sql"));
  await db.exec(migration("20260302005704_bd805505-a553-416f-bbba-e7dc9627c3d5.sql"));
  await db.exec(migration("20260727014544_e0a26cb7-31ad-4eeb-80ff-9d242c96a06e.sql"));
  await db.exec(migration("20260731094023_0b3d2e3f-cf58-4d05-b308-0ea17aaae0a2.sql"));
  await db.exec(migration("20260916090641_152fd4a3-3ff6-484d-a798-981ff065ee17.sql"));
  const hardening = migration("20260917120000_security_hardening.sql");
  // Cron is a platform integration not available in this isolated engine.
  await db.exec(hardening.slice(0, hardening.indexOf("-- Retire the legacy cron"))
    + hardening.slice(hardening.indexOf("-- Rate-limit authenticated")));
  await db.exec(migration("20261029120000_open_play_reliability.sql"));
  await db.exec(migration("20261031120000_player_booking_time_guards.sql"));
  if (process.env.SECURITY_AUDIT_BASELINE !== "1") await db.exec(migration("20261031150000_api_security_audit.sql"));
}, 120_000);

beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE auth.users, courts, open_play_registrations, open_play_sessions CASCADE;");
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2),($3)", [player, other, admin]);
  await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [admin]);
  await db.query("INSERT INTO courts(id,name,price_per_hour) VALUES($1,'Court 1',200)", [court]);
  await asUser(player);
});
afterAll(() => db.close());

describe("API database authorization under real SQL roles", () => {
  it("uses server pricing, identity and pending state despite spoofed JSON fields", async () => {
    const id = await book();
    expect((await db.query("SELECT user_id,total_amount,status FROM bookings WHERE id=$1", [id])).rows)
      .toEqual([{ user_id: player, total_amount: "200.00", status: "pending" }]);
  });
  it("hides another account's booking, payment and profile rows", async () => {
    await book(); await asUser(other);
    expect((await db.query("SELECT * FROM bookings")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM payments")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM profiles WHERE user_id=$1", [player])).rows).toEqual([]);
  });
  it("does not allow self-approval or payment forgery through table updates", async () => {
    await book();
    expect((await db.query("UPDATE bookings SET status='paid' RETURNING id")).rows).toEqual([]);
    expect((await db.query("UPDATE payments SET status='completed' RETURNING id")).rows).toEqual([]);
  });
  it("denies direct booking and payment inserts", async () => {
    await expect(db.query("INSERT INTO bookings(user_id,court_id,booking_date,start_time,end_time,total_amount,status) VALUES($1,$2,CURRENT_DATE+1,'18:00','19:00',0,'paid')", [player,court])).rejects.toThrow();
    await expect(db.query("INSERT INTO payments(booking_id,user_id,amount,status) VALUES(gen_random_uuid(),$1,0,'completed')", [player])).rejects.toThrow();
  });
  it("denies role escalation", async () => {
    await expect(db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [player])).rejects.toThrow(/permission denied/);
  });
  it("retains owner profile edits but prevents identity/timestamp replacement", async () => {
    expect((await db.query("UPDATE profiles SET full_name='Player',phone='09123456789' WHERE user_id=$1 RETURNING full_name", [player])).rows).toEqual([{ full_name: "Player" }]);
    await expect(db.query("UPDATE profiles SET id=gen_random_uuid() WHERE user_id=$1", [player])).rejects.toThrow(/permission denied/);
    await expect(db.query("UPDATE profiles SET created_at=now() WHERE user_id=$1", [player])).rejects.toThrow(/permission denied/);
    await expect(db.query("UPDATE profiles SET full_name=repeat('a',401) WHERE user_id=$1", [player])).rejects.toThrow(/profile_name_size/);
  });
  it("denies private slot enumeration and the retired reservation RPC", async () => {
    await expect(db.query("SELECT * FROM booking_slots")).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT create_booking_reservation($1,CURRENT_DATE+1,ARRAY['18:00'::time],'ref')", [court])).rejects.toThrow(/permission denied/);
  });
  it("masks internal notes while preserving minimal availability", async () => {
    await asUser(admin);
    await db.query("SELECT admin_create_court_block($1,(now() AT TIME ZONE 'Asia/Manila')::date+1,ARRAY['18:00'::time],'Private client contact')", [court]);
    await asUser(player);
    expect((await db.query("SELECT admin_note FROM get_reserved_slots((now() AT TIME ZONE 'Asia/Manila')::date+1)")).rows).toEqual([{ admin_note: null }]);
    await asUser(admin);
    expect((await db.query("SELECT admin_note FROM get_reserved_slots((now() AT TIME ZONE 'Asia/Manila')::date+1)")).rows).toEqual([{ admin_note: "Private client contact" }]);
  });
  it("denies unauthenticated private reads and RPC execution", async () => {
    await asUser(null);
    await expect(db.query("SELECT * FROM payments")).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT * FROM get_reserved_slots(CURRENT_DATE)")).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT consume_user_api_quota('notification')")).rejects.toThrow(/permission denied/);
    expect((await db.query("SELECT name FROM courts")).rows).toEqual([{ name: "Court 1" }]);
  });
  it("denies function creation and future default-public execution", async () => {
    await expect(db.exec("CREATE FUNCTION public.attack() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE; CREATE FUNCTION public.new_private_helper() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;");
    await asUser(other);
    await expect(db.query("SELECT new_private_helper()")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE; DROP FUNCTION new_private_helper();");
  });
  it("requires admin for privileged operations even with known IDs/tokens", async () => {
    await expect(db.query("SELECT lookup_checkin('known-token')")).rejects.toThrow(/ADMIN_REQUIRED/);
    await expect(db.query("SELECT perform_checkin('known-token')")).rejects.toThrow(/ADMIN_REQUIRED/);
    await expect(db.query("SELECT admin_create_court_block($1,CURRENT_DATE+1,ARRAY['18:00'::time],'x')", [court])).rejects.toThrow(/ADMIN_REQUIRED/);
  });
  it("enforces Open Play ownership, admin approval and QR authorization through SQL roles", async () => {
    await asUser(admin);
    const id = (await db.query<{ id: string }>(`INSERT INTO open_play_sessions
      (session_date,start_time,end_time,court_ids,max_players,price_php,created_by)
      VALUES((now() AT TIME ZONE 'Asia/Manila')::date+2,'18:00','20:00',ARRAY[$1::uuid],4,100,$2) RETURNING id`, [court,admin])).rows[0].id;
    await asUser(player);
    const reg = (await db.query<{ result: { registration_id: string } }>("SELECT register_for_open_play($1,'reference') AS result", [id])).rows[0].result.registration_id;
    await expect(db.query("UPDATE open_play_registrations SET payment_status='completed' WHERE id=$1", [reg])).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT get_my_qr_token('open_play',$1)", [reg])).rejects.toThrow(/QR_NOT_AVAILABLE/);
    await asUser(other);
    expect((await db.query("SELECT * FROM open_play_registrations")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM get_open_play_roster($1)", [id])).rows).toEqual([]);
    await expect(db.query("SELECT admin_update_open_play_registration($1,NULL,'completed')", [reg])).rejects.toThrow(/ADMIN_REQUIRED/);
    await asUser(admin);
    await db.query("SELECT admin_update_open_play_registration($1,NULL,'completed')", [reg]);
    await asUser(player);
    expect((await db.query<{ token: string }>("SELECT get_my_qr_token('open_play',$1) AS token", [reg])).rows[0].token).toBeTruthy();
    await asUser(other);
    await expect(db.query("SELECT get_my_qr_token('open_play',$1)", [reg])).rejects.toThrow(/QR_NOT_AVAILABLE/);
  });
});

describe("Persistent abuse limits", () => {
  it("limits notifications, isolates users and prevents table resets", async () => {
    for (let i=0;i<20;i++) expect((await db.query<{ allowed: boolean }>("SELECT consume_user_api_quota('notification') AS allowed")).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_user_api_quota('notification') AS allowed")).rows[0].allowed).toBe(false);
    await expect(db.query("DELETE FROM api_request_limits")).rejects.toThrow(/permission denied/);
    await asUser(other);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_user_api_quota('notification') AS allowed")).rows[0].allowed).toBe(true);
    await expect(db.query("SELECT consume_user_api_quota('arbitrary')")).rejects.toThrow(/INVALID_QUOTA_BUCKET/);
  });
  it("rejects excessive unpaid inventory holds atomically", async () => {
    await book("07:00", "23:00", 1);
    await expect(book("07:00", "23:00", 2)).rejects.toThrow(/PENDING_BOOKING_LIMIT/);
    expect((await db.query("SELECT id FROM bookings")).rows).toHaveLength(1);
    await book("07:00", "15:00", 2);
    await expect(book("18:00", "19:00", 3)).rejects.toThrow(/PENDING_BOOKING_LIMIT/);
  });
  it("prevents repeated cancellation/rebooking from bypassing request limits", async () => {
    for (let i=0;i<30;i++) {
      const id = await book();
      await db.query("SELECT cancel_booking_reservation($1)", [id]);
    }
    await expect(book()).rejects.toThrow(/BOOKING_RATE_LIMIT/);
  });
  it("enforces the daily AI budget even when the minute window resets", async () => {
    for (let i=0;i<10;i++) expect((await db.query<{ allowed: boolean }>("SELECT consume_faq_chat_quota() AS allowed")).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_faq_chat_quota() AS allowed")).rows[0].allowed).toBe(false);
    await db.exec("RESET ROLE");
    await db.query("UPDATE faq_chat_rate_limits SET window_started_at=now()-interval '2 minutes',day_request_count=100 WHERE user_id=$1", [player]);
    await asUser(player);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_faq_chat_quota() AS allowed")).rows[0].allowed).toBe(false);
    await asUser(other);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_faq_chat_quota() AS allowed")).rows[0].allowed).toBe(true);
  });
});
