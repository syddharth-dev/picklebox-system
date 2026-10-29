// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const admin = "00000000-0000-4000-8000-000000000001";
const player = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const third = "00000000-0000-4000-8000-000000000004";
const fourth = "00000000-0000-4000-8000-000000000005";
const court = "00000000-0000-4000-8000-000000000010";
const db = new PGlite();
const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
async function asUser(id: string | null) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
}
async function scalar<T>(sql: string, args: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, args)).rows[0]?.value;
}
async function session(overrides: Record<string, unknown> = {}) {
  const values = { max_players: 1, price_php: 0, cancel_cutoff_hours: 2, ...overrides };
  return scalar<string>(`INSERT INTO public.open_play_sessions
    (session_date, start_time, end_time, court_ids, max_players, price_php, cancel_cutoff_hours, created_by)
    VALUES ((now() AT TIME ZONE 'Asia/Manila')::date + 2, '18:00', '20:00', ARRAY[$1::uuid], $2, $3, $4, $5)
    RETURNING id AS value`, [court, values.max_players, values.price_php, values.cancel_cutoff_hours, admin]);
}
type Registration = { registration_id: string; status: string; waitlist_position: number | null };
async function register(id: string, user = player, reference: string | null = null) {
  await asUser(user);
  return scalar<Registration>("SELECT public.register_for_open_play($1, $2) AS value", [id, reference]);
}
async function cancel(id: string, user = player) {
  await asUser(user);
  return scalar("SELECT public.cancel_open_play_registration($1) AS value", [id]);
}
async function update(id: string, status: string | null, payment: string | null = null) {
  await asUser(admin);
  return db.query("SELECT public.admin_update_open_play_registration($1, $2::public.open_play_registration_status, $3::public.payment_status)", [id, status, payment]);
}

beforeAll(async () => {
  // Supabase auth/roles and surrounding tables are fixtures. Open Play tables,
  // policies and RPCs below are loaded from the actual application migrations.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
    CREATE TYPE public.payment_status AS ENUM ('pending','completed','failed','refunded');
    CREATE TYPE public.booking_status AS ENUM ('pending','paid','cancelled','completed');
    CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
        SELECT auth.uid() = _user_id AND EXISTS
          (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
      $$;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    CREATE TABLE public.profiles(user_id uuid, full_name text);
    CREATE TABLE public.courts(id uuid PRIMARY KEY, name text, is_active boolean, price_per_hour numeric);
    CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
      court_id uuid, booking_date date, start_time time, end_time time, status public.booking_status,
      reference_code text, total_amount numeric, is_admin_block boolean DEFAULT false, admin_note text, expires_at timestamptz);
    CREATE TABLE public.booking_slots(booking_id uuid, court_id uuid, booking_date date, start_time time, is_reserved boolean DEFAULT true);
    -- pgcrypto is not bundled in this test engine; only QR token generation is
    -- replaced. Token authorization and all state transitions use the real RPCs.
    CREATE FUNCTION public.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql VOLATILE AS
      $$ SELECT decode(md5(random()::text), 'hex') $$;
    CREATE PUBLICATION supabase_realtime;
  `);
  await db.exec(migration("20260727014544_e0a26cb7-31ad-4eeb-80ff-9d242c96a06e.sql"));
  await db.exec(migration("20260731094023_0b3d2e3f-cf58-4d05-b308-0ea17aaae0a2.sql"));
  await db.exec(migration("20260916090641_152fd4a3-3ff6-484d-a798-981ff065ee17.sql"));
  const hardening = migration("20260917120000_security_hardening.sql");
  await db.exec(hardening.slice(hardening.indexOf("-- Do not expose cancelled"), hardening.indexOf("-- Require an authenticated")));
  if (process.env.OPENPLAY_BASELINE !== "1") {
    await db.exec(migration("20261029120000_open_play_reliability.sql"));
  }
}, 120_000);

beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE open_play_registrations, open_play_sessions, courts, profiles, user_roles, bookings, booking_slots CASCADE;");
  await db.query("INSERT INTO user_roles VALUES ($1, 'admin')", [admin]);
  await db.query("INSERT INTO courts VALUES ($1, 'Court 1', true, 200)", [court]);
  await db.query("INSERT INTO profiles VALUES ($1, 'Player One'), ($2, 'Player Two')", [player, other]);
  await asUser(admin);
});
afterAll(() => db.close());

describe("Open Play database registration and waitlist", () => {
  it("requires authentication", async () => {
    const id = await session();
    await asUser(null);
    await expect(scalar("SELECT register_for_open_play($1) AS value", [id])).rejects.toThrow("AUTH_REQUIRED");
  });
  it("registers a free player with completed payment", async () => {
    const registration = await register(await session());
    expect(registration.status).toBe("registered");
    expect(await scalar("SELECT payment_status AS value FROM open_play_registrations WHERE id=$1", [registration.registration_id])).toBe("completed");
  });
  it("requires a reference for paid sessions and leaves submitted payments pending", async () => {
    const id = await session({ price_php: 150 });
    await expect(register(id)).rejects.toThrow("PAYMENT_REFERENCE_REQUIRED");
    const reg = await register(id, player, " 1234567890123 ");
    expect(await scalar("SELECT payment_reference AS value FROM open_play_registrations WHERE id=$1", [reg.registration_id])).toBe("1234567890123");
    expect(await scalar("SELECT payment_status AS value FROM open_play_registrations WHERE id=$1", [reg.registration_id])).toBe("pending");
  });
  it("rejects duplicate active registration", async () => {
    const id = await session();
    await register(id);
    await expect(register(id)).rejects.toThrow("ALREADY_REGISTERED");
  });
  it("assigns full sessions to the waitlist and promotes the first player on cancellation", async () => {
    const id = await session();
    const first = await register(id);
    const next = await register(id, other);
    expect(next).toMatchObject({ status: "waitlisted", waitlist_position: 1 });
    await cancel(first.registration_id);
    expect(await scalar("SELECT status AS value FROM open_play_registrations WHERE id=$1", [next.registration_id])).toBe("registered");
  });
  it("resequences the waitlist when a waitlisted player leaves", async () => {
    const id = await session();
    await register(id);
    const first = await register(id, other);
    await register(id, third);
    await register(id, fourth);
    await cancel(first.registration_id, other);
    expect((await db.query("SELECT waitlist_position FROM open_play_registrations WHERE status='waitlisted' ORDER BY waitlist_position")).rows).toEqual([{ waitlist_position: 1 }, { waitlist_position: 2 }]);
  });
  it("allows rejoining after cancellation without creating two active registrations", async () => {
    const id = await session();
    await cancel((await register(id)).registration_id);
    expect((await register(id)).status).toBe("registered");
  });
  it("prevents a player cancelling another player's registration", async () => {
    const reg = await register(await session());
    await expect(cancel(reg.registration_id, other)).rejects.toThrow("FORBIDDEN");
  });
  it("enforces the cancellation cutoff", async () => {
    const reg = await register(await session({ cancel_cutoff_hours: 1000 }));
    await expect(cancel(reg.registration_id)).rejects.toThrow("CANCELLATION_CUTOFF_PASSED");
  });
  it("does not let a checked-in player cancel themselves", async () => {
    const reg = await register(await session());
    await update(reg.registration_id, "checked_in");
    await expect(cancel(reg.registration_id)).rejects.toThrow("REGISTRATION_NOT_CANCELLABLE");
  });
  it("rejects overlong payment references", async () => {
    await expect(register(await session({ price_php: 150 }), player, "x".repeat(129))).rejects.toThrow("INVALID_PAYMENT_REFERENCE");
  });
  it("does not promote a second player on a repeated cancellation", async () => {
    const id = await session();
    const first = await register(id);
    const next = await register(id, other);
    const last = await register(id, third);
    await cancel(first.registration_id);
    await cancel(first.registration_id);
    expect(await scalar("SELECT status AS value FROM open_play_registrations WHERE id=$1", [next.registration_id])).toBe("registered");
    expect(await scalar("SELECT status AS value FROM open_play_registrations WHERE id=$1", [last.registration_id])).toBe("waitlisted");
  });
  it("does not register players into cancelled sessions", async () => {
    const id = await session();
    await db.query("UPDATE open_play_sessions SET status='cancelled' WHERE id=$1", [id]);
    await expect(register(id)).rejects.toThrow("SESSION_NOT_OPEN");
  });
  it("reports missing sessions", async () => {
    await expect(register(player)).rejects.toThrow("SESSION_NOT_FOUND");
  });
  it("returns accurate list counts and the caller's registration status", async () => {
    const id = await session();
    await register(id);
    await register(id, other);
    expect((await db.query("SELECT registered_count::int, waitlist_count::int, my_status, my_waitlist_position FROM list_open_play_sessions()")).rows)
      .toEqual([{ registered_count: 1, waitlist_count: 1, my_status: "waitlisted", my_waitlist_position: 1 }]);
  });
});

describe("Open Play admin and QR check-in", () => {
  it("requires admin access for status updates", async () => {
    const reg = await register(await session());
    await expect(db.query("SELECT admin_update_open_play_registration($1, 'checked_in')", [reg.registration_id])).rejects.toThrow("ADMIN_REQUIRED");
  });
  it("rejects manual check-in before payment approval", async () => {
    const reg = await register(await session({ price_php: 150 }), player, "123");
    await expect(update(reg.registration_id, "checked_in")).rejects.toThrow("PAYMENT_NOT_APPROVED");
  });
  it("manual check-in records the timestamp and is idempotent", async () => {
    const reg = await register(await session());
    await update(reg.registration_id, "checked_in");
    const timestamp = await scalar("SELECT checked_in_at::text AS value FROM open_play_registrations WHERE id=$1", [reg.registration_id]);
    expect(timestamp).toBeTruthy();
    await update(reg.registration_id, "checked_in");
    expect(await scalar("SELECT checked_in_at::text AS value FROM open_play_registrations WHERE id=$1", [reg.registration_id])).toBe(timestamp);
  });
  it("promotes the waitlist when an admin marks a player as a no-show", async () => {
    const id = await session();
    const first = await register(id);
    const next = await register(id, other);
    await update(first.registration_id, "no_show");
    expect(await scalar("SELECT status AS value FROM open_play_registrations WHERE id=$1", [next.registration_id])).toBe("registered");
  });
  it("does not allow an admin to check in a waitlisted player", async () => {
    const id = await session();
    await register(id);
    const reg = await register(id, other);
    await expect(update(reg.registration_id, "checked_in")).rejects.toThrow("INVALID_REGISTRATION_TRANSITION");
  });
  it("reports an unknown registration instead of succeeding silently", async () => {
    await expect(update(player, null, "completed")).rejects.toThrow("REG_NOT_FOUND");
  });
  it("unlocks QR only after payment verification and only for the owner", async () => {
    const reg = await register(await session({ price_php: 150 }), player, "123");
    await expect(scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id])).rejects.toThrow("QR_NOT_AVAILABLE");
    await update(reg.registration_id, null, "completed");
    await asUser(other);
    await expect(scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id])).rejects.toThrow("QR_NOT_AVAILABLE");
    await asUser(player);
    expect(await scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id])).toBeTruthy();
  });
  it("scans and checks in a paid player idempotently", async () => {
    const reg = await register(await session());
    const token = await scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id]);
    await asUser(admin);
    expect(await scalar("SELECT lookup_checkin($1)->>'player_name' AS value", [token])).toBe("Player One");
    expect(await scalar("SELECT (perform_checkin($1)->>'already')::boolean AS value", [token])).toBe(false);
    expect(await scalar("SELECT (perform_checkin($1)->>'already')::boolean AS value", [token])).toBe(true);
  });
  it("revokes already-issued passes when the session is cancelled", async () => {
    const id = await session();
    const reg = await register(id);
    const token = await scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id]);
    await asUser(admin);
    await db.query("UPDATE open_play_sessions SET status='cancelled' WHERE id=$1", [id]);
    await expect(scalar("SELECT perform_checkin($1) AS value", [token])).rejects.toThrow("SESSION_NOT_OPEN");
    await asUser(player);
    await expect(scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id])).rejects.toThrow("QR_NOT_AVAILABLE");
  });
  it("does not disclose another player's payment details in the roster", async () => {
    const id = await session({ max_players: 2, price_php: 150 });
    await register(id, player, "private-one");
    await register(id, other, "private-two");
    await asUser(player);
    expect((await db.query("SELECT payment_reference FROM get_open_play_roster($1)", [id])).rows).toEqual([{ payment_reference: "private-one" }]);
    await asUser(admin);
    expect((await db.query("SELECT * FROM get_open_play_roster($1)", [id])).rows).toHaveLength(2);
  });
  it("keeps waitlisted players from obtaining a check-in token", async () => {
    const id = await session();
    await register(id);
    const reg = await register(id, other);
    await expect(scalar("SELECT get_my_qr_token('open_play', $1) AS value", [reg.registration_id])).rejects.toThrow("QR_NOT_AVAILABLE");
  });
  it("does not let authenticated admins bypass transition checks by updating the table directly", async () => {
    const reg = await register(await session());
    await asUser(admin);
    await db.exec("SET ROLE authenticated;");
    await expect(db.query("UPDATE open_play_registrations SET status='checked_in' WHERE id=$1", [reg.registration_id])).rejects.toThrow(/permission denied/);
  });
  it("does not expose the internal waitlist helper to authenticated callers", async () => {
    const id = await session();
    await db.exec("SET ROLE authenticated;");
    await expect(db.query("SELECT rebalance_open_play_waitlist($1)", [id])).rejects.toThrow(/permission denied/);
  });
  it("allows an authenticated player to use the registration RPC after direct writes are revoked", async () => {
    const id = await session();
    await asUser(player);
    await db.exec("SET ROLE authenticated;");
    expect(await scalar("SELECT register_for_open_play($1)->>'status' AS value", [id])).toBe("registered");
  });
  it("preserves ordinary court booking QR lookup and idempotent check-in", async () => {
    const id = await scalar<string>("INSERT INTO bookings(user_id,court_id,booking_date,start_time,end_time,status) VALUES ($1,$2,CURRENT_DATE+2,'10:00','11:00','paid') RETURNING id AS value", [player, court]);
    await asUser(player);
    const token = await scalar("SELECT get_my_qr_token('booking',$1) AS value", [id]);
    await asUser(admin);
    expect(await scalar("SELECT lookup_checkin($1)->>'kind' AS value", [token])).toBe("booking");
    expect(await scalar("SELECT (perform_checkin($1)->>'already')::boolean AS value", [token])).toBe(false);
    expect(await scalar("SELECT (perform_checkin($1)->>'already')::boolean AS value", [token])).toBe(true);
  });
});

describe("Open Play scheduling and court availability", () => {
  it.each([{ price_php: -1 }, { cancel_cutoff_hours: -1 }, { max_players: 0 }])("rejects invalid session values: %j", async (values) => {
    await expect(session(values)).rejects.toThrow();
  });
  it("rejects empty court selections", async () => {
    await expect(db.query("INSERT INTO open_play_sessions(session_date,start_time,end_time,court_ids,max_players,created_by) VALUES (CURRENT_DATE+2,'18:00','20:00','{}',4,$1)", [admin])).rejects.toThrow("INVALID_SESSION_COURTS");
  });
  it("rejects inactive courts", async () => {
    await db.query("UPDATE courts SET is_active=false WHERE id=$1", [court]);
    await expect(session()).rejects.toThrow("COURT_UNAVAILABLE");
  });
  it("rejects an overlapping Open Play session", async () => {
    await session();
    await expect(session()).rejects.toThrow("COURT_TIME_CONFLICT");
  });
  it("prevents ordinary bookings on an Open Play court", async () => {
    await session();
    await expect(db.query("INSERT INTO bookings(court_id,booking_date,start_time,end_time,status) VALUES ($1,(now() AT TIME ZONE 'Asia/Manila')::date+2,'19:00','21:00','pending')", [court])).rejects.toThrow("COURT_TIME_CONFLICT");
  });
  it("prevents Open Play from overwriting an existing booking", async () => {
    await db.query("INSERT INTO bookings(court_id,booking_date,start_time,end_time,status) VALUES ($1,(now() AT TIME ZONE 'Asia/Manila')::date+2,'19:00','21:00','paid')", [court]);
    await expect(session()).rejects.toThrow("COURT_TIME_CONFLICT");
  });
  it("returns Open Play hours in the booking availability RPC", async () => {
    await session();
    const rows = (await db.query("SELECT start_time, is_admin_block FROM get_reserved_slots((now() AT TIME ZONE 'Asia/Manila')::date+2)")).rows;
    expect(rows).toEqual([{ start_time: "18:00:00", is_admin_block: true }, { start_time: "19:00:00", is_admin_block: true }]);
  });
  it("releases court availability after session cancellation", async () => {
    const id = await session();
    await db.query("UPDATE open_play_sessions SET status='cancelled' WHERE id=$1", [id]);
    expect((await db.query("SELECT * FROM get_reserved_slots((now() AT TIME ZONE 'Asia/Manila')::date+2)")).rows).toEqual([]);
    expect(await session()).toBeTruthy();
  });
  it("allows bookings immediately adjacent to an Open Play session", async () => {
    await session();
    await expect(db.query("INSERT INTO bookings(court_id,booking_date,start_time,end_time,status) VALUES ($1,(now() AT TIME ZONE 'Asia/Manila')::date+2,'20:00','21:00','paid')", [court])).resolves.toBeTruthy();
  });
  it("blocks every intersecting hourly slot for half-hour sessions", async () => {
    const id = await session();
    await db.query("UPDATE open_play_sessions SET start_time='18:30',end_time='20:30' WHERE id=$1", [id]);
    expect((await db.query("SELECT start_time FROM get_reserved_slots((now() AT TIME ZONE 'Asia/Manila')::date+2)")).rows)
      .toEqual([{ start_time: "18:00:00" }, { start_time: "19:00:00" }, { start_time: "20:00:00" }]);
  });
  it("does not let capacity fall below the active registration count", async () => {
    const id = await session({ max_players: 2 });
    await register(id);
    await register(id, other);
    await expect(db.query("UPDATE open_play_sessions SET max_players=1 WHERE id=$1", [id])).rejects.toThrow("CAPACITY_BELOW_REGISTRATIONS");
  });
  it("rejects duplicate courts in a session", async () => {
    const id = await session();
    await expect(db.query("UPDATE open_play_sessions SET court_ids=ARRAY[$2::uuid,$2::uuid] WHERE id=$1", [id, court])).rejects.toThrow("INVALID_SESSION_COURTS");
  });
  it("rejects sessions already started in Manila time even when Postgres is in UTC", async () => {
    // Historical data is a fixture, bypassing only scheduling triggers.
    await db.exec("SET session_replication_role=replica;");
    const id = await scalar<string>(`INSERT INTO open_play_sessions(session_date,start_time,end_time,court_ids,max_players,created_by)
      SELECT (t - interval '30 minutes')::date,(t - interval '30 minutes')::time,'23:59:59',ARRAY[$1::uuid],4,$2
      FROM (SELECT now() AT TIME ZONE 'Asia/Manila' AS t) clock RETURNING id AS value`, [court, admin]);
    await db.exec("SET session_replication_role=origin; SET TIME ZONE 'UTC';");
    await expect(register(id)).rejects.toThrow("SESSION_ALREADY_STARTED");
  });
  it("keeps other players' registrations inaccessible through table reads", async () => {
    const id = await session({ max_players: 2 });
    await register(id);
    await register(id, other);
    await asUser(player);
    await db.exec("SET ROLE authenticated;");
    expect((await db.query("SELECT user_id FROM open_play_registrations")).rows).toEqual([{ user_id: player }]);
  });
});
