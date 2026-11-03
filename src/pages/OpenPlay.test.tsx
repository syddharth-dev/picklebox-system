import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenPlay from "./OpenPlay";
import type { OpenPlaySessionRow } from "@/hooks/useOpenPlay";

const state = vi.hoisted(() => ({
  sessions: [] as OpenPlaySessionRow[],
  error: null as Error | null,
  rosterError: null as Error | null,
  roster: [] as { user_id: string; registration_id: string; status: string; payment_status: string }[],
  register: vi.fn(),
  cancel: vi.fn(),
  user: { id: "player" } as { id: string } | null,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/hooks/useCourts", () => ({ useCourts: () => ({ data: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/checkin/QRCodeDialog", () => ({ QRCodeDialog: () => null }));
vi.mock("@/hooks/useOpenPlay", () => ({
  useOpenPlaySessions: () => ({ data: state.sessions, error: state.error, isLoading: false, refetch: vi.fn() }),
  useOpenPlayRoster: () => ({ data: state.roster, error: state.rosterError, isLoading: false, refetch: vi.fn() }),
  useRegisterOpenPlay: () => ({ mutateAsync: state.register, isPending: false }),
  useCancelOpenPlayRegistration: () => ({ mutateAsync: state.cancel, isPending: false }),
}));

const session: OpenPlaySessionRow = {
  id: "session", session_date: "2099-10-30", start_time: "18:00:00", end_time: "20:00:00",
  court_ids: [], skill: "all", max_players: 1, price_php: 150, cancel_cutoff_hours: 2,
  status: "scheduled", title: "Friday Open Play", notes: null, registered_count: 0,
  waitlist_count: 0, my_status: null, my_waitlist_position: null,
};

const renderPage = () => render(<MemoryRouter><OpenPlay /></MemoryRouter>);

describe("Open Play player flow", () => {
  beforeEach(() => {
    state.sessions = [{ ...session }];
    state.error = null;
    state.rosterError = null;
    state.roster = [];
    state.user = { id: "player" };
    state.register.mockReset().mockResolvedValue({ status: "registered" });
    state.cancel.mockReset();
  });
  afterEach(cleanup);

  it("keeps an open dialog in sync when the last spot is taken", () => {
    const view = renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    state.sessions = [{ ...session, registered_count: 1 }];
    view.rerender(<MemoryRouter><OpenPlay /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Join Waitlist" })).toBeInTheDocument();
  });

  it("displays a failed session query instead of an empty schedule", () => {
    state.sessions = [];
    state.error = new Error("Network unavailable");
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/load.*sessions/i);
    expect(screen.queryByText(/No open play sessions scheduled/)).not.toBeInTheDocument();
  });

  it("clears the payment reference when changing sessions", () => {
    state.sessions.push({ ...session, id: "other", title: "Saturday Open Play" });
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    fireEvent.change(screen.getByLabelText("GCash reference number"), { target: { value: "previous-payment" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByText("Saturday Open Play"));
    expect(screen.getByLabelText("GCash reference number")).toHaveValue("");
  });

  it("disables cancellation for checked-in players", () => {
    state.sessions = [{ ...session, my_status: "checked_in" }];
    state.roster = [{ user_id: "player", registration_id: "reg", status: "checked_in", payment_status: "completed" }];
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    expect(screen.getByRole("button", { name: /Cancel Registration/ })).toBeDisabled();
  });

  it("does not present a broken roster query as an empty roster", () => {
    state.rosterError = new Error("RPC unavailable");
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    expect(screen.getByRole("alert")).toHaveTextContent(/load.*registration/i);
    expect(screen.queryByText("No one registered yet.")).not.toBeInTheDocument();
  });

  it("removes registration actions when a session is cancelled while open", () => {
    const view = renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    state.sessions = [];
    view.rerender(<MemoryRouter><OpenPlay /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /^Register/ })).not.toBeInTheDocument();
  });
  it("submits a paid registration with a trimmed reference and closes on success", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    fireEvent.change(screen.getByLabelText("GCash reference number"), { target: { value: " 1234567890123 " } });
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    await waitFor(() => expect(state.register).toHaveBeenCalledWith({ sessionId: "session", paymentReference: "1234567890123" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("does not submit a paid registration without a payment reference", () => {
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    expect(state.register).not.toHaveBeenCalled();
  });
  it("offers the waitlist when a free session is full", async () => {
    state.sessions = [{ ...session, price_php: 0, registered_count: 1 }];
    state.register.mockResolvedValue({ status: "waitlisted", waitlist_position: 1 });
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    fireEvent.click(screen.getByRole("button", { name: "Join Waitlist" }));
    await waitFor(() => expect(state.register).toHaveBeenCalledWith({ sessionId: "session", paymentReference: undefined }));
  });
  it("cancels the player's own registration before the deadline", async () => {
    state.sessions = [{ ...session, my_status: "registered" }];
    state.roster = [{ user_id: "player", registration_id: "reg", status: "registered", payment_status: "completed" }];
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    fireEvent.click(screen.getByRole("button", { name: /Cancel Registration/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel registration" }));
    await waitFor(() => expect(state.cancel).toHaveBeenCalledWith("reg"));
  });
  it("uses a native button to open a session", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /View Friday Open Play session/ }));
    expect(screen.getByRole("dialog", { name: "Friday Open Play" })).toBeInTheDocument();
  });

  it("lets signed-out visitors inspect a session before asking them to sign in", () => {
    state.user = null;
    renderPage();
    fireEvent.click(screen.getByText("Friday Open Play"));
    expect(screen.getAllByText("₱150")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Sign in to register" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByLabelText("GCash reference number")).not.toBeInTheDocument();
  });
});
