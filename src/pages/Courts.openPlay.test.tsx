import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Courts from "./Courts";

const state = vi.hoisted(() => ({
  rows: [] as { court_id: string; start_time: string; end_time: string; status: string; is_admin_block: boolean; admin_note: string }[],
  toast: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
  error: null as Error | null, refetch: vi.fn(),
  user: { id: "player" } as { id: string } | null,
}));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate, useSearchParams: () => [new URLSearchParams()] }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
const client = { invalidateQueries: state.invalidate };
vi.mock("@/hooks/useCourts", () => ({ useCourts: () => ({ data: courts, isLoading: false, refetch: state.refetch }) }));
const courts = [{ id: "court", name: "Court 1", price_per_hour: 200 }];
vi.mock("@/hooks/useBookings", () => ({ useBookedSlotsAllCourts: () => ({ data: state.rows, error: state.error, refetch: state.refetch }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() },
}));
const reserved = { court_id: "court", start_time: "18:00:00", end_time: "19:00:00", status: "paid", is_admin_block: true, admin_note: "Open Play" };
beforeEach(() => { state.rows = []; state.error = null; state.user = { id: "player" }; state.navigate.mockClear(); state.refetch.mockClear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-31T00:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Open Play court reservations", () => {
  it("carries guest court selections to sign-in for checkout", () => {
    state.user = null;
    render(<Courts />);
    fireEvent.click(screen.getByRole("button", { name: "Court 1, 6PM–7PM" }), { detail: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Court 1, 7PM–8PM" }), { detail: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Proceed to Checkout" }));
    expect(state.navigate).toHaveBeenCalledWith("/auth", { state: {
      from: "/checkout", checkout: { date: "2026-10-31", totalPrice: 400, selections: [
        { courtId: "court", courtName: "Court 1", pricePerHour: 200, slots: ["18:00:00", "19:00:00"] },
      ] },
    } });
  });
  it("closes the calendar after a player selects a booking date", () => {
    render(<Courts />);
    fireEvent.click(screen.getByRole("button", { name: "Choose booking date" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to next month" }));
    fireEvent.click(screen.getAllByRole("gridcell", { name: "1" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose booking date" })).toHaveTextContent("Nov 1, 2026");
  });
  it("does not present unknown availability as free court hours", () => {
    state.error = new Error("Network error"); render(<Courts />);
    expect(screen.getByRole("alert")).toHaveTextContent(/court availability/);
    expect(screen.queryByRole("button", { name: "Court 1, 6PM–7PM" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(state.refetch).toHaveBeenCalled();
  });
  it("disables a past hour using Philippine time", () => {
    render(<Courts />);
    expect(screen.getByRole("button", { name: "Court 1, 7AM–8AM, past" })).toBeDisabled();
  });
  it("allows assistive and keyboard-generated clicks to toggle available hours", () => {
    render(<Courts />);
    const cell = screen.getByRole("button", { name: "Court 1, 6PM–7PM" });
    fireEvent.click(cell, { detail: 0 });
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toBeInTheDocument();
    fireEvent.click(cell, { detail: 0 });
    expect(cell).toHaveAttribute("aria-pressed", "false");
  });
  it("labels and disables Open Play hours in the regular booking grid", () => {
    state.rows = [reserved];
    render(<Courts />);
    const cell = screen.getByRole("button", { name: "Court 1, 6PM–7PM, reserved" });
    expect(cell).toBeDisabled();
    expect(cell).toHaveTextContent("Open Play");
  });
  it("removes a selected slot when refreshed availability reserves it for Open Play", async () => {
    const view = render(<Courts />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Court 1, 6PM–7PM" }));
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toBeInTheDocument();
    state.rows = [reserved];
    view.rerender(<Courts />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Proceed to Checkout" })).not.toBeInTheDocument());
  });
});
