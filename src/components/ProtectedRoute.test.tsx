import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/hooks/useAdmin", () => ({ useIsAdmin: () => ({ data: false, isLoading: false }) }));
afterEach(() => { cleanup(); state.user = null; });
function SignInPage() {
  const location = useLocation();
  return <p>Continue to: {(location.state as { from: string }).from}</p>;
}
describe("Protected navigation", () => {
  it("preserves the requested path and query when sign-in is needed", () => {
    render(<MemoryRouter initialEntries={["/open-play?session=example"]}><Routes>
      <Route path="/open-play" element={<ProtectedRoute><p>Session</p></ProtectedRoute>} />
      <Route path="/auth" element={<SignInPage />} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("Continue to: /open-play?session=example")).toBeInTheDocument();
  });
  it("continues to exclude non-admin players from the admin workspace", () => {
    state.user = { id: "player" };
    render(<MemoryRouter initialEntries={["/admin"]}><Routes>
      <Route path="/admin" element={<ProtectedRoute requireAdmin><p>Admin data</p></ProtectedRoute>} />
      <Route path="/" element={<p>Club home</p>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("Club home")).toBeInTheDocument();
    expect(screen.queryByText("Admin data")).not.toBeInTheDocument();
  });
});
