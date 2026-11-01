import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "./Profile";

const state = vi.hoisted(() => ({ profile: { full_name: "Player One", phone: "09123456789" }, error: null as Error | null, save: vi.fn(), refetch: vi.fn(), toast: vi.fn() }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player", email: "player@example.com" } }) }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ data: state.profile, error: state.error, isLoading: false, refetch: state.refetch }), useUpdateProfile: () => ({ mutateAsync: state.save, isPending: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
beforeEach(() => { state.profile = { full_name: "Player One", phone: "09123456789" }; state.error = null; vi.clearAllMocks(); });
afterEach(cleanup);
describe("Player profile", () => {
  it("preserves an unsaved edit when the server refreshes the profile", () => {
    const view = render(<Profile />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "My unsaved name" } });
    state.profile = { ...state.profile, phone: "09987654321" };
    view.rerender(<Profile />);
    expect(screen.getByLabelText("Full Name")).toHaveValue("My unsaved name");
  });
  it("shows a recoverable load error instead of an editable empty profile", () => {
    state.error = new Error("Network error");
    render(<Profile />);
    expect(screen.getByRole("alert")).toHaveTextContent(/load your profile/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });
  it("rejects a blank name without changing stored account details", () => {
    render(<Profile />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(state.save).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
