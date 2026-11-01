import { addDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { venueDate, openPlayStart } from "./openPlay";

const selectionSchema = z.object({
  courtId: z.string().uuid(), courtName: z.string().min(1),
  pricePerHour: z.number().finite().nonnegative(),
  slots: z.array(z.string().regex(/^(0[7-9]|1\d|2[0-2]):00:00$/)).min(1).max(16),
});
const checkoutSchema = z.object({ date: z.string(), selections: z.array(selectionSchema).min(1) });
export type BookingSelection = z.infer<typeof selectionSchema>;

export function groupBookingSlots(slots: string[]): string[][] {
  const groups: string[][] = [];
  for (const slot of [...slots].sort()) {
    const previous = groups.at(-1);
    if (previous && Number(slot.slice(0, 2)) === Number(previous.at(-1)!.slice(0, 2)) + 1) previous.push(slot);
    else groups.push([slot]);
  }
  return groups;
}

export function parseCheckoutState(value: unknown, now = new Date()) {
  const result = checkoutSchema.safeParse(value);
  if (!result.success) return null;
  const parsedDate = parseISO(result.data.date);
  if (!isValid(parsedDate)) return null;
  const date = format(parsedDate, "yyyy-MM-dd");
  const today = venueDate(now);
  const { selections } = result.data;
  if (date < today || date > format(addDays(parseISO(today), 60), "yyyy-MM-dd")
    || new Set(selections.map((s) => s.courtId)).size !== selections.length
    || selections.some((s) => new Set(s.slots).size !== s.slots.length || s.slots.some((start_time) => openPlayStart({ session_date: date, start_time }) <= now.getTime()))
    || selections.reduce((count, s) => count + groupBookingSlots(s.slots).length, 0) > 12) return null;
  const totalPrice = selections.reduce((sum, s) => sum + s.pricePerHour * s.slots.length, 0);
  return Number.isFinite(totalPrice) ? { date, selections, totalPrice } : null;
}
