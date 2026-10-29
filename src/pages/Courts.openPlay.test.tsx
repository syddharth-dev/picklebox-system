import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Courts from "./Courts";

const state = vi.hoisted(() => ({
  rows: [] as { court_id: string; start_time: string; end_time: string; status: string; is_admin_block: boolean; admin_note: string }[],
  toast: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
const client = { invalidateQueries: state.invalidate };
vi.mock("@/hooks/useCourts", () => ({ useCourts: () => ({ data: courts, isLoading: false }) }));
const courts = [{ id: "court", name: "Court 1", price_per_hour: 200 }];
vi.mock("@/hooks/useBookings", () => ({ useBookedSlotsAllCourts: () => ({ data: state.rows }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() },
}));
const reserved = { court_id: "court", start_time: "18:00:00", end_time: "19:00:00", status: "paid", is_admin_block: true, admin_note: "Open Play" };
beforeEach(() => { state.rows = []; });
afterEach(cleanup);

describe("Open Play court reservations", () => {
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
