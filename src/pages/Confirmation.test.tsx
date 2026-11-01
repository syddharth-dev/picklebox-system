import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Confirmation from "./Confirmation";
const state = vi.hoisted(() => ({ error: null as Error | null, refetch: vi.fn(), status: "paid" }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player" }, loading: false }) }));
vi.mock("@/hooks/useBookings", () => ({ useBookingsByIds: () => ({ data: state.error ? undefined : [{ id: "booking", status: state.status, booking_date: "2099-10-30", start_time: "18:00:00", end_time: "19:00:00", total_amount: 200, courts: { name: "Court 1" } }], isLoading: false, error: state.error, refetch: state.refetch }) }));
function mount() { return render(<MemoryRouter initialEntries={[{ pathname: "/confirmation", state: { bookingIds: ["booking"] } }]}><Confirmation /></MemoryRouter>); }
beforeEach(() => { state.error = null; state.status = "paid"; state.refetch.mockClear(); });
afterEach(cleanup);
describe("Booking confirmation", () => {
  it("shows the actual settled status rather than claiming payment is pending", () => {
    mount();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText(/pending admin verification/i)).not.toBeInTheDocument();
  });
  it("lets a player recover from a failed confirmation request without starting another booking", () => {
    state.error = new Error("Network error");
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent(/load your booking/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});
