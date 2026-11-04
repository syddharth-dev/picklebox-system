import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminOpenPlay from "./AdminOpenPlay";

const state = vi.hoisted(() => ({
  error: null as Error | null,
  rosterError: null as Error | null,
  payment: "pending",
  sessionCount: 1, rosterCount: 1,
  create: vi.fn(), cancel: vi.fn(), update: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/useCourts", () => ({ useAllCourts: () => ({ data: [
  { id: "court", name: "Court 1", is_active: true }, { id: "closed", name: "Closed Court", is_active: false },
] }) }));
vi.mock("@/hooks/useOpenPlay", () => ({
  useAdminOpenPlaySessions: () => ({ error: state.error, isLoading: false, refetch: vi.fn(), data: Array.from({ length: state.sessionCount }, (_, i) => (
    { id: `session-${i}`, session_date: "2099-10-30", start_time: "18:00", end_time: "20:00", court_ids: ["court"],
      title: i === 0 ? "Friday Open Play" : `Session ${i + 1}`, max_players: 16, price_php: 150, skill: "all", status: "scheduled" }
  )) }),
  useOpenPlayRoster: () => ({ error: state.rosterError, isLoading: false, refetch: vi.fn(), data: Array.from({ length: state.rosterCount }, (_, i) => (
    { registration_id: i === 0 ? "reg" : `reg-${i}`, full_name: i === 0 ? "Player One" : `Player ${i + 1}`, status: "registered", payment_status: state.payment }
  )) }),
  useCreateOpenPlaySession: () => ({ mutateAsync: state.create, isPending: false }),
  useCancelOpenPlaySession: () => ({ mutateAsync: state.cancel, isPending: false }),
  useAdminUpdateRegistration: () => ({ mutateAsync: state.update, isPending: false }),
}));

beforeEach(() => {
  state.error = null;
  state.rosterError = null;
  state.payment = "pending";
  state.sessionCount = 1;
  state.rosterCount = 1;
  state.toast.mockReset();
  state.create.mockReset().mockResolvedValue({});
  state.cancel.mockReset().mockResolvedValue({});
  state.update.mockReset().mockResolvedValue({});
});
afterEach(cleanup);
const expandRoster = () => fireEvent.click(screen.getByRole("button", { name: /Friday Open Play/ }));

describe("Open Play admin flow", () => {
  it("paginates sessions and the selected session's roster independently", () => {
    state.sessionCount = 11; state.rosterCount = 11;
    render(<AdminOpenPlay />);
    expect(screen.queryByRole("button", { name: /Session 11/ })).not.toBeInTheDocument();
    expandRoster();
    expect(screen.queryByText("Player 11")).not.toBeInTheDocument();
    const rosterPager = screen.getByRole("navigation", { name: "Session roster pagination" });
    fireEvent.click(within(rosterPager).getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Player 11")).toBeInTheDocument();
    expect(screen.queryByText("Player One")).not.toBeInTheDocument();
    const sessionPager = screen.getByRole("navigation", { name: "Open Play sessions pagination" });
    fireEvent.click(within(sessionPager).getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("button", { name: /Session 11/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Friday Open Play/ })).not.toBeInTheDocument();
  });
  it("requires payment approval before manual check-in", () => {
    render(<AdminOpenPlay />);
    expandRoster();
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
  });
  it("checks in paid players using the guarded RPC mutation", async () => {
    state.payment = "completed";
    render(<AdminOpenPlay />);
    expandRoster();
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ registrationId: "reg", status: "checked_in" }));
  });
  it("catches and displays failed session cancellations", async () => {
    state.cancel.mockRejectedValue(new Error("Connection lost"));
    render(<AdminOpenPlay />);
    expandRoster();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Session" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Session cancellation failed", description: "Connection lost" })));
  });
  it("reports session query failures", () => {
    state.error = new Error("Network unavailable");
    render(<AdminOpenPlay />);
    expect(screen.getByRole("alert")).toHaveTextContent(/load Open Play sessions/);
  });
  it("reports roster query failures", () => {
    state.rosterError = new Error("Network unavailable");
    render(<AdminOpenPlay />);
    expandRoster();
    expect(screen.getByRole("alert")).toHaveTextContent(/load the roster/);
  });
  it("offers only active courts when creating a session", () => {
    render(<AdminOpenPlay />);
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    expect(screen.getByRole("checkbox", { name: "Court 1" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Closed Court" })).not.toBeInTheDocument();
  });
  it("creates a valid session with the chosen cutoff and unmodified time strings", async () => {
    render(<AdminOpenPlay />);
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2099-10-30" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Court 1" }));
    fireEvent.change(screen.getByLabelText(/Cancellation cutoff/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      session_date: "2099-10-30", court_ids: ["court"], start_time: "18:00", end_time: "20:00", cancel_cutoff_hours: 3,
    })));
  });
  it("rejects an end time before the start time", async () => {
    render(<AdminOpenPlay />);
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2099-10-30" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Court 1" }));
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/End time/) })));
    expect(state.create).not.toHaveBeenCalled();
  });
});
