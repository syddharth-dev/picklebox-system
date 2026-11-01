import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { venueDate } from "@/lib/openPlay";
import { addDays, format, parseISO } from "date-fns";
import Checkout from "./Checkout";
const state = vi.hoisted(() => ({ navigate: vi.fn(), toast: vi.fn(), save: vi.fn(), rpc: vi.fn(), invoke: vi.fn(), getSession: vi.fn(), profileError: null as Error | null, rate: 200, latestRate: 200 }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => state.navigate }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player", email: "player@example.com" }, loading: false }) }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ data: { full_name: "Player One", phone: "09123456789" }, isLoading: false, error: state.profileError, refetch: vi.fn() }), useUpdateProfile: () => ({ mutateAsync: state.save }) }));
vi.mock("@/hooks/useCourts", () => ({ useCourts: () => ({ data: [{ id: "00000000-0000-4000-8000-000000000010", is_active: true, price_per_hour: state.rate }], isLoading: false, refetch: async () => ({ data: [{ id: "00000000-0000-4000-8000-000000000010", is_active: true, price_per_hour: state.latestRate }], error: null }) }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc, functions: { invoke: state.invoke }, auth: { getSession: state.getSession } } }));
let client: QueryClient;
function mount(routeState?: unknown) {
  const date = format(addDays(parseISO(venueDate()), 1), "yyyy-MM-dd");
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: "/checkout", state: routeState ?? { date, totalPrice: 1, selections: [{ courtId: "00000000-0000-4000-8000-000000000010", courtName: "Court 1", pricePerHour: 200, slots: ["18:00:00", "19:00:00"] }] } }]}><Checkout /></MemoryRouter></QueryClientProvider>);
}
function submit() { fireEvent.change(screen.getByLabelText("GCash reference number"), { target: { value: " 123456789 " } }); fireEvent.click(screen.getByRole("button", { name: "Submit Booking" })); }
beforeEach(() => { client = new QueryClient(); vi.clearAllMocks(); state.profileError = null; state.rate = 200; state.latestRate = 200; state.save.mockResolvedValue({}); state.rpc.mockResolvedValue({ data: ["booking-1"], error: null }); state.invoke.mockResolvedValue({}); state.getSession.mockResolvedValue({ data: { session: { user: { id: "player" } } } }); });
afterEach(() => { cleanup(); client.clear(); });
describe("Player checkout", () => {
  it.each([
    ["PENDING_BOOKING_LIMIT", /24 court hours/],
    ["BOOKING_RATE_LIMIT", /Wait a minute/],
  ])("explains the server abuse limit %s", async (code, message) => {
    state.rpc.mockResolvedValue({ data: null, error: { message: code } });
    mount(); submit();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Booking Failed", description: expect.stringMatching(message),
    })));
    expect(state.invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit Booking" })).toBeEnabled();
  });
  it("hides payment instructions when a selected court's current rate differs", () => {
    state.rate = 300; mount();
    expect(screen.getByRole("alert")).toHaveTextContent(/changed/);
    expect(screen.queryByRole("button", { name: "Enlarge GCash payment QR" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Booking" })).toBeDisabled();
  });
  it("rechecks rates just before creating a reservation", async () => {
    state.latestRate = 300; mount(); submit();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Court details changed" })));
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled();
  });
  it("uses account email, saves edited contact information, and atomically submits grouped slots", async () => {
    mount();
    expect(screen.getByLabelText("Email Address *")).toHaveValue("player@example.com");
    expect(screen.getByLabelText("Email Address *")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: " Updated Player " } });
    submit();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/confirmation", { state: { bookingIds: ["booking-1"] } }));
    expect(state.save).toHaveBeenCalledWith({ full_name: "Updated Player", phone: "09123456789" });
    expect(state.rpc).toHaveBeenCalledWith("create_bookings_atomic", expect.objectContaining({ p_reference: "123456789", p_items: [{ court_id: "00000000-0000-4000-8000-000000000010", start_time: "18:00:00", end_time: "20:00:00", amount: 400 }] }));
  });
  it("does not create a booking if contact saving fails", async () => {
    state.save.mockRejectedValue(new Error("Could not save profile"));
    mount(); submit();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Booking Failed" })));
    expect(state.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit Booking" })).toBeEnabled();
  });
  it("does not report success when the booking RPC returns no created reservations", async () => {
    state.rpc.mockResolvedValue({ data: [], error: null });
    mount(); submit();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Booking Failed" })));
    expect(state.navigate).not.toHaveBeenCalledWith("/confirmation", expect.anything());
  });
  it("blocks submission when profile details cannot be loaded", () => {
    state.profileError = new Error("Network error"); mount();
    expect(screen.getByRole("alert")).toHaveTextContent(/contact details/);
    expect(screen.getByRole("button", { name: "Submit Booking" })).toBeDisabled();
  });
  it("rejects malformed navigation state without crashing", () => {
    expect(() => mount({ date: "not-a-date", selections: [{}] })).not.toThrow();
    expect(screen.queryByRole("button", { name: "Submit Booking" })).not.toBeInTheDocument();
  });
  it("does not submit under an account that changed while checkout was open", async () => {
    state.getSession.mockResolvedValue({ data: { session: { user: { id: "different-player" } } } });
    mount(); submit();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/auth"));
    expect(state.save).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled();
  });
});
