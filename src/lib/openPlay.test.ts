import { describe, expect, it } from "vitest";
import { openPlayErrorMessage, openPlayStart, validateOpenPlaySession, venueDate } from "./openPlay";

const session = {
  session_date: "2099-10-30", start_time: "18:00", end_time: "20:00", court_ids: ["court"],
  max_players: 16, price_php: 150, cancel_cutoff_hours: 2,
};

describe("Open Play validation and venue time", () => {
  it("uses Philippine time for the session start regardless of browser time zone", () => {
    expect(openPlayStart(session)).toBe(Date.parse("2099-10-30T10:00:00Z"));
  });
  it("uses the Philippine date during UTC's previous day", () => {
    expect(venueDate(new Date("2026-10-29T17:00:00Z"))).toBe("2026-10-30");
  });
  it("accepts valid free and paid sessions", () => {
    expect(validateOpenPlaySession(session)).toBeNull();
    expect(validateOpenPlaySession({ ...session, price_php: 0, start_time: "18:00:00", end_time: "20:00:00" })).toBeNull();
  });
  it.each([
    { session_date: "" }, { session_date: "2099-02-31" }, { start_time: "" }, { end_time: "17:00" },
    { start_time: "25:00" }, { start_time: "18:00", end_time: "18:00:00" },
    { court_ids: [] }, { court_ids: ["court", "court"] }, { max_players: 1.5 }, { max_players: 0 },
    { price_php: -1 }, { price_php: NaN }, { cancel_cutoff_hours: -1 }, { cancel_cutoff_hours: 0.5 },
  ])("rejects invalid form input %j", (invalid) => {
    expect(validateOpenPlaySession({ ...session, ...invalid })).toBeTruthy();
  });
  it("rejects the exact start time and all past times", () => {
    expect(validateOpenPlaySession(session, openPlayStart(session))).toMatch(/future/);
  });
  it("turns database errors into actionable messages", () => {
    expect(openPlayErrorMessage({ message: "COURT_TIME_CONFLICT" })).toMatch(/another court or time/);
    expect(openPlayErrorMessage({ message: "CANCELLATION_CUTOFF_PASSED" })).toMatch(/deadline has passed/);
    expect(openPlayErrorMessage(null)).toMatch(/try again/);
  });
});
