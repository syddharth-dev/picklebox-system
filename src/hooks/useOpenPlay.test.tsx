import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateOpenPlayQueries, useCreateOpenPlaySession, useOpenPlayRoster, useOpenPlaySessions, useRegisterOpenPlay } from "./useOpenPlay";
import { useMyQrToken } from "./useCheckIn";

const state = vi.hoisted(() => ({ userId: "first" as string | null, rpc: vi.fn(), from: vi.fn(), removeChannel: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.userId ? { id: state.userId } : null }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc, from: state.from, removeChannel: state.removeChannel,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  },
}));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  state.userId = "first";
  state.rpc.mockReset().mockImplementation(async () => ({ data: [{ user_id: state.userId }], error: null }));
  state.from.mockReset();
});
afterEach(() => { cleanup(); client.clear(); });

describe("Open Play cache and requests", () => {
  it("does not show a previous account's session registration after switching accounts", async () => {
    const hook = renderHook(() => useOpenPlaySessions(), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    state.userId = "second";
    hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() => expect(hook.result.current.data?.[0]).toMatchObject({ user_id: "second" }));
  });
  it("keeps roster data separate for each signed-in account", async () => {
    const hook = renderHook(() => useOpenPlayRoster("session"), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    state.userId = "second";
    hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() => expect(hook.result.current.data?.[0].user_id).toBe("second"));
  });
  it("does not make session or roster RPC calls while signed out", async () => {
    state.userId = null;
    renderHook(() => { useOpenPlaySessions(); useOpenPlayRoster("session"); }, { wrapper });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("invalidates attendance, dashboard, QR, player and admin lists after a change", async () => {
    const keys = [["open-play", "sessions", "first"], ["admin", "today", "open-play"],
      ["admin", "open-play", "sessions"], ["admin", "attendance", "session", "session"],
      ["qr-token", "open_play", "reg", "first"], ["booked-slots-all", "2099-10-30"]];
    keys.forEach((key) => client.setQueryData(key, []));
    client.setQueryData(["courts"], []);
    await invalidateOpenPlayQueries(client);
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(client.getQueryState(["courts"])?.isInvalidated).toBe(false);
  });
  it("sends the session and payment reference through the atomic registration RPC", async () => {
    state.rpc.mockResolvedValue({ data: { status: "registered", registration_id: "reg", waitlist_position: null }, error: null });
    const hook = renderHook(() => useRegisterOpenPlay(), { wrapper });
    await act(async () => { await hook.result.current.mutateAsync({ sessionId: "session", paymentReference: "123" }); });
    expect(state.rpc).toHaveBeenCalledWith("register_for_open_play", { p_session_id: "session", p_payment_reference: "123" });
  });
  it("rejects invalid session forms before contacting the database", async () => {
    const hook = renderHook(() => useCreateOpenPlaySession(), { wrapper });
    await act(async () => {
      await expect(hook.result.current.mutateAsync({ session_date: "2099-10-30", start_time: "20:00", end_time: "18:00",
        court_ids: ["court"], skill: "all", max_players: 16, price_php: 150, cancel_cutoff_hours: 2 })).rejects.toThrow(/End time/);
    });
    expect(state.from).not.toHaveBeenCalled();
  });
  it("never reuses another account's cached QR token", async () => {
    state.rpc.mockImplementation(async () => ({ data: `${state.userId}-token`, error: null }));
    const hook = renderHook(() => useMyQrToken("open_play", "reg"), { wrapper });
    await waitFor(() => expect(hook.result.current.data).toBe("first-token"));
    state.userId = "second";
    hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() => expect(hook.result.current.data).toBe("second-token"));
  });
});
