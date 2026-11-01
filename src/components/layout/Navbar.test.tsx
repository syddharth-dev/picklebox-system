import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

vi.mock("@/components/theme/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "player", user_metadata: { full_name: "Player One" } }, signOut: vi.fn() }) }));
afterEach(cleanup);
const show = () => render(<MemoryRouter initialEntries={["/courts"]}><Navbar /></MemoryRouter>);

describe("Redesigned navigation", () => {
  it("keeps profile, bookings and sign-out accessible in the mobile menu", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = within(screen.getByRole("navigation", { name: "Mobile navigation" }));
    expect(menu.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile");
    expect(menu.getByRole("link", { name: "My bookings" })).toHaveAttribute("href", "/bookings");
    expect(menu.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
  it("closes the mobile menu with Escape and restores focus", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.keyDown(screen.getByRole("navigation", { name: "Mobile navigation" }), { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });
  it("marks the active route and directs Help to a real route", () => {
    show();
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(nav.getByRole("link", { name: "Courts" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });
});
