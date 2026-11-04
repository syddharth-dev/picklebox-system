import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";

const state = vi.hoisted(() => ({ signOut: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: state.signOut }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/components/theme/ThemeToggle", () => ({ ThemeToggle: () => null }));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function mount() {
  render(
    <MemoryRouter initialEntries={["/admin/bookings"]}>
      <Routes>
        <Route path="/admin/bookings" element={<AdminLayout>Admin bookings</AdminLayout>} />
        <Route path="/" element={<p>Public homepage</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Admin sidebar logout", () => {
  it("waits for sign-out before returning to the homepage and prevents repeat clicks", async () => {
    let finishSignOut!: () => void;
    state.signOut.mockReturnValue(new Promise<void>((resolve) => { finishSignOut = resolve; }));
    mount();

    const logout = screen.getByRole("button", { name: "Logout" });
    expect(screen.queryByRole("link", { name: "Back to the website" })).not.toBeInTheDocument();
    fireEvent.click(logout);
    expect(logout).toBeDisabled();
    expect(screen.getByText("Logging out...")).toBeInTheDocument();
    expect(screen.getByText("Admin bookings")).toBeInTheDocument();
    expect(screen.queryByText("Public homepage")).not.toBeInTheDocument();
    fireEvent.click(logout);
    expect(state.signOut).toHaveBeenCalledTimes(1);

    await act(async () => finishSignOut());
    expect(screen.getByText("Public homepage")).toBeInTheDocument();
    expect(state.toast).not.toHaveBeenCalled();
  });

  it("stays in admin and allows retrying if sign-out fails", async () => {
    state.signOut.mockRejectedValueOnce(new Error("Network unavailable"));
    mount();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Logout" })));
    expect(screen.getByText("Admin bookings")).toBeInTheDocument();
    expect(screen.queryByText("Public homepage")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeEnabled();
    expect(state.toast).toHaveBeenCalledWith({
      title: "Could not log out", description: "Please try again.", variant: "destructive",
    });

    state.signOut.mockResolvedValueOnce(undefined);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Logout" })));
    expect(screen.getByText("Public homepage")).toBeInTheDocument();
  });
});
