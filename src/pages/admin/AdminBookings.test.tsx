import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminBookings from "./AdminBookings";

function fixture(i: number) {
  return { id: `booking-${i}`, reference_code: `PB-${String(i).padStart(4, "0")}`, court_id: i % 2 ? "a" : "b",
    booking_date: i <= 12 ? "2026-11-04" : "2026-11-05", start_time: "18:00:00", end_time: "19:00:00", total_amount: 200,
    status: ["pending", "paid", "cancelled", "completed"][(i - 1) % 4], courts: { name: i % 2 ? "Court 1" : "Court 2" },
    profiles: { full_name: `Player ${String(i).padStart(2, "0")}`, phone: `0917${String(i).padStart(7, "0")}` },
    payments: [{ id: `payment-${i}`, transaction_reference: `GCASH-${String(i).padStart(4, "0")}`, status: "pending" }],
  };
}
const state = vi.hoisted(() => ({ rows: [] as ReturnType<typeof fixture>[], rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/useAdmin", () => ({ useAdminBookings: () => ({ data: state.rows, isLoading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.rows = Array.from({ length: 23 }, (_, i) => fixture(i + 1));
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ error: null });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); client.clear(); });
function mount() { return render(<QueryClientProvider client={client}><AdminBookings /></QueryClientProvider>); }
function search(value: string) { fireEvent.change(screen.getByRole("searchbox", { name: "Search bookings" }), { target: { value } }); }
async function select(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("Admin booking search, filters and pagination", () => {
  it("shows ten rows per page with working first/previous/next/last controls", () => {
    mount();
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("PB-0011")).toBeInTheDocument();
    expect(screen.queryByText("PB-0001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("Showing 21–23 of 23 bookings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("PB-0011")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(screen.getByText("PB-0001")).toBeInTheDocument();
  });
  it.each(["player 17", "pb-0017", "gcash-0017", "booking-17", "09170000017", "  PLAYER   17  "])("searches all pages for %s", (term) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));
    search(term);
    expect(screen.getByText("PB-0017")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Showing 1–1 of 1 bookings")).toBeInTheDocument();
  });
  it("combines status, court, date and search filters and resets them", async () => {
    mount();
    await select("Status", "Paid");
    await select("Court", "Court 2");
    fireEvent.change(screen.getByLabelText("Booking date from"), { target: { value: "2026-11-05" } });
    fireEvent.change(screen.getByLabelText("Booking date to"), { target: { value: "2026-11-05" } });
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("PB-0014")).toBeInTheDocument();
    expect(screen.queryByText("PB-0002")).not.toBeInTheDocument();
    search("not found");
    expect(screen.getByText("No bookings match your search or filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Showing 1–10 of 23 bookings")).toBeInTheDocument();
  });
  it("approves the correct booking after searching on a later page", async () => {
    mount(); search("PB-0017");
    const row = screen.getByText("PB-0017").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("resolve_booking_reservation", {
      p_booking_id: "booking-17", p_status: "paid",
    }));
  });
});
