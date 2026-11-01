import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBooking, useBookingsByIds } from "./useBookings";
const state = vi.hoisted(() => ({ user: { id: "player-a" }, fetch: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select() { return this; }, eq() { return this; }, in() { return this; }, single: state.fetch, then: (resolve: (value: unknown) => unknown) => state.fetch().then(resolve) }) } }));
let client: QueryClient;
function Frame({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); state.user = { id: "player-a" }; state.fetch.mockReset(); });
afterEach(() => { cleanup(); client.clear(); });
describe("Private booking cache isolation", () => {
  it("does not expose another account's cached multi-booking confirmation", async () => {
    state.fetch.mockResolvedValueOnce({ data: [{ id: "booking", user_id: "player-a" }], error: null });
    const view = renderHook(() => useBookingsByIds(["booking"]), { wrapper: Frame });
    await waitFor(() => expect(view.result.current.data).toHaveLength(1));
    state.user = { id: "player-b" };
    state.fetch.mockReturnValue(new Promise(() => {}));
    view.rerender();
    expect(view.result.current.data).toBeUndefined();
  });
  it("does not expose another account's cached individual booking", async () => {
    state.fetch.mockResolvedValueOnce({ data: { id: "booking", user_id: "player-a" }, error: null });
    const view = renderHook(() => useBooking("booking"), { wrapper: Frame });
    await waitFor(() => expect(view.result.current.data?.id).toBe("booking"));
    state.user = { id: "player-b" }; state.fetch.mockReturnValue(new Promise(() => {}));
    view.rerender(); expect(view.result.current.data).toBeUndefined();
  });
});
