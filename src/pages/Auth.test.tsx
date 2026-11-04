import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { venueDate } from "@/lib/openPlay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth";

const state = vi.hoisted(() => ({ navigate: vi.fn(), signIn: vi.fn().mockResolvedValue({ error: null }), signUp: vi.fn(), user: null as { id: string } | null, toast: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => state.navigate }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, signIn: state.signIn, signUp: state.signUp }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "player" } } }) },
  from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) }),
} }));
afterEach(() => { cleanup(); state.navigate.mockClear(); });
beforeEach(() => { state.user = null; state.signUp.mockReset().mockResolvedValue({ error: null }); state.signIn.mockReset().mockResolvedValue({ error: null }); state.toast.mockClear(); });
function booking() {
  return { date: format(addDays(parseISO(venueDate()), 1), "yyyy-MM-dd"), totalPrice: 400, selections: [
    { courtId: "00000000-0000-4000-8000-000000000010", courtName: "Court 1", pricePerHour: 200, slots: ["18:00:00", "19:00:00"] },
  ] };
}
function CheckoutProbe() {
  return <p data-testid="checkout-selection">{JSON.stringify(useLocation().state)}</p>;
}
async function signIn(from: string, checkout?: unknown) {
  render(<MemoryRouter initialEntries={[{ pathname: "/auth", state: { from, checkout } }]}><Auth /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign In" })); });
}
describe("Sign-in continuation", () => {
  it("returns to Courts if selected hours expired before authentication finished", async () => {
    state.user = { id: "verified-player" };
    render(<MemoryRouter initialEntries={[{ pathname: "/auth", state: {
      from: "/checkout", checkout: { ...booking(), date: "2020-01-01" },
    } }]}><Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/courts" element={<p>Choose future court hours</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("Choose future court hours")).toBeInTheDocument();
  });
  it("continues to checkout with the guest's selected court hours after sign-in", async () => {
    const checkout = booking();
    await signIn("/checkout", { ...checkout, totalPrice: 1 });
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/checkout", { state: checkout }));
  });
  it.each([false, true])("keeps selections through signup (immediate session: %s)", async (immediateSession) => {
    const checkout = booking();
    const flow = () => <MemoryRouter initialEntries={[{ pathname: "/auth", state: { from: "/checkout", checkout } }]}><Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/checkout" element={<CheckoutProbe />} />
    </Routes></MemoryRouter>;
    const view = render(flow());
    state.signUp.mockImplementation(async () => {
      if (immediateSession) state.user = { id: "new-player" };
      return { error: null };
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Create account" }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "New Player" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "valid-password" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create Account" })); });
    expect(state.signUp).toHaveBeenCalledWith("new@example.com", "valid-password", "New Player");
    if (!immediateSession) {
      expect(screen.queryByTestId("checkout-selection")).not.toBeInTheDocument();
      state.user = { id: "verified-player" };
    }
    view.rerender(flow());
    await waitFor(() => expect(JSON.parse(screen.getByTestId("checkout-selection").textContent!)).toEqual(checkout));
  });
  it("restores the sign-in button and explains a thrown network failure", async () => {
    state.signIn.mockRejectedValueOnce(new Error("Network unavailable"));
    await signIn("/open-play");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled());
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Login failed", variant: "destructive" }));
  });
  it("returns the player to the session flow they were trying to open", async () => {
    await signIn("/open-play");
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/open-play"));
  });
  it("rejects an external return destination", async () => {
    await signIn("//example.com");
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/"));
  });
});
