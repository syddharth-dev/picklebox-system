import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteScrollReset } from "./RouteScrollReset";
function Navigation() {
  const navigate = useNavigate();
  return <><RouteScrollReset /><Link to="/courts">Courts</Link><Link to="/help#payments">Payment help</Link><Link to="/admin">Admin</Link><button onClick={() => navigate(-1)}>Back</button></>;
}
beforeEach(() => { window.scrollTo = vi.fn(); });
afterEach(cleanup);
describe("Player page navigation", () => {
  it("starts a newly opened page at the top", () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Courts" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });
  it("preserves browser history restoration", () => {
    render(<MemoryRouter initialEntries={["/", "/courts"]} initialIndex={1}><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it("preserves anchor navigation and excluded admin behavior", () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Payment help" }));
    fireEvent.click(screen.getByRole("link", { name: "Admin" }));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
