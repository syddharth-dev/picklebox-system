import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth";

const state = vi.hoisted(() => ({ navigate: vi.fn(), signIn: vi.fn().mockResolvedValue({ error: null }), toast: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => state.navigate }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signIn: state.signIn, signUp: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "player" } } }) },
  from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) }),
} }));
afterEach(() => { cleanup(); state.navigate.mockClear(); });
beforeEach(() => { state.signIn.mockReset().mockResolvedValue({ error: null }); state.toast.mockClear(); });
async function signIn(from: string) {
  render(<MemoryRouter initialEntries={[{ pathname: "/auth", state: { from } }]}><Auth /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign In" })); });
}
describe("Sign-in continuation", () => {
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
