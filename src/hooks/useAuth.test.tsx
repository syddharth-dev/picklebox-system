import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./useAuth";
const state = vi.hoisted(() => ({ getSession: vi.fn(), unsubscribe: vi.fn(), onChange: null as null | ((event: string, session: unknown) => void) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: state.getSession, onAuthStateChange: (callback: typeof state.onChange) => { state.onChange = callback; return { data: { subscription: { unsubscribe: state.unsubscribe } } }; } } } }));
function Probe() { const { user, loading } = useAuth(); return <p>{loading ? "Loading account" : user?.id || "Signed out"}</p>; }
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("Session startup", () => {
  it("recovers from a failed session lookup instead of staying on a loading screen", async () => {
    state.getSession.mockRejectedValue(new Error("Offline"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
  });
  it("does not overwrite a fresh sign-in with a delayed older session lookup", async () => {
    let resolve!: (value: unknown) => void;
    state.getSession.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    act(() => state.onChange!("SIGNED_IN", { user: { id: "current-player" } }));
    await act(async () => resolve({ data: { session: null } }));
    expect(screen.getByText("current-player")).toBeInTheDocument();
    view.unmount(); expect(state.unsubscribe).toHaveBeenCalledOnce();
  });
});
