import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Bookings from "./Bookings";

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as Error | null, refetch: vi.fn() }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player" }, loading: false }) }));
vi.mock("@/hooks/useBookings", () => ({ useUserBookings: () => ({ data: state.rows, error: state.error, refetch: state.refetch, isLoading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock("@/components/checkin/QRCodeDialog", () => ({
  QRCodeDialog: ({ open, id }: { open: boolean; id: string }) => open ? <div role="dialog" aria-label="Check-in pass">Pass for {id}</div> : null,
}));
const booking = { id: "booking-1", booking_date: "2099-10-30", start_time: "18:00:00", end_time: "19:00:00",
  status: "paid", courts: { name: "Court 1" }, total_amount: 200, reference_code: "PB-123", checked_in_at: null };
let client: QueryClient;
function Frame() { return <QueryClientProvider client={client}><MemoryRouter><Bookings /></MemoryRouter></QueryClientProvider>; }
beforeEach(() => { client = new QueryClient(); state.rows = [{ ...booking }]; state.error = null; state.refetch.mockClear(); });
afterEach(() => { cleanup(); client.clear(); });

describe("My bookings interaction state", () => {
  it("places elapsed paid reservations in Past instead of Upcoming", () => {
    state.rows = [{ ...booking, booking_date: "2020-01-01" }];
    render(<Frame />);
    expect(screen.getByRole("tab", { name: "Upcoming (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Past (1)" })).toBeInTheDocument();
  });
  it("keeps a check-in pass open when booking data refreshes", () => {
    const view = render(<Frame />);
    fireEvent.click(screen.getByRole("button", { name: "Show check-in QR" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Pass for booking-1");
    state.rows = [{ ...booking, checked_in_at: "2099-10-30T10:00:00Z" }];
    view.rerender(<Frame />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Pass for booking-1");
  });
  it("shows an error and a working retry action when bookings cannot load", () => {
    state.rows = [];
    state.error = new Error("Connection lost");
    render(<Frame />);
    expect(screen.getByRole("alert")).toHaveTextContent(/load your bookings/);
    expect(screen.queryByText("No upcoming bookings")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
  it("keeps QR access unavailable while payment is pending", () => {
    state.rows = [{ ...booking, status: "pending" }];
    render(<Frame />);
    expect(screen.queryByRole("button", { name: "Show check-in QR" })).not.toBeInTheDocument();
    expect(screen.getByText(/unlocks once the admin approves/)).toBeInTheDocument();
  });
});
