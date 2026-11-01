import { describe, expect, it } from "vitest";
import { groupBookingSlots, parseCheckoutState } from "./booking";
import { profileSchema } from "./profile";
const now = new Date("2026-10-31T00:00:00Z"); // 8AM in Manila
const selection = { courtId: "00000000-0000-4000-8000-000000000010", courtName: "Court 1", pricePerHour: 200, slots: ["18:00:00", "19:00:00"] };
const draft = { date: "2026-11-01", selections: [selection], totalPrice: 1 };
describe("Checkout trust boundary", () => {
  it("recalculates the displayed total instead of trusting route totals", () => {
    expect(parseCheckoutState(draft, now)?.totalPrice).toBe(400);
  });
  it.each([null, {}, { date: "invalid", selections: [selection] }, { ...draft, date: "2026-02-30" }, { ...draft, date: "2026-10-30" }, { ...draft, date: "2027-01-01" }, { ...draft, selections: [] }, { ...draft, selections: [{ ...selection, slots: [] }] }, { ...draft, selections: [{ ...selection, pricePerHour: NaN }] }, { ...draft, selections: [{ ...selection, slots: ["23:00:00"] }] }, { ...draft, selections: [{ ...selection, slots: ["18:00:00", "18:00:00"] }] }, { ...draft, selections: [selection, selection] }])("rejects malformed or unsupported state: %j", (value) => {
    expect(parseCheckoutState(value, now)).toBeNull();
  });
  it("rejects an elapsed hour in venue time even when the UTC date is unchanged", () => {
    expect(parseCheckoutState({ ...draft, date: "2026-10-31", selections: [{ ...selection, slots: ["07:00:00"] }] }, now)).toBeNull();
  });
  it("groups adjacent hours while keeping separate ranges distinct", () => {
    expect(groupBookingSlots(["20:00:00", "08:00:00", "07:00:00", "18:00:00"])).toEqual([["07:00:00", "08:00:00"], ["18:00:00"], ["20:00:00"]]);
  });
});
describe("Account contact validation", () => {
  it("trims a name and accepts an international phone number", () => {
    expect(profileSchema.parse({ full_name: " Player ", phone: "+63 912 345 6789" }).full_name).toBe("Player");
  });
  it.each(["abc", "123", "1234567890123456"])("rejects invalid phone details: %s", (phone) => {
    expect(profileSchema.safeParse({ full_name: "Player", phone }).success).toBe(false);
  });
});
