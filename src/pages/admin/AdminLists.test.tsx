import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminPayments from "./AdminPayments";
import AdminUsers from "./AdminUsers";
import AdminCourts from "./AdminCourts";
import AdminAttendance from "./AdminAttendance";
import AdminReservations from "./AdminReservations";

const state = vi.hoisted(() => ({ csv: vi.fn() }));
const rows = Array.from({ length: 11 }, (_, i) => ({
  id: `record-${i}`, user_id: `user-${i}`, name: `Court ${i + 1}`, full_name: `Player ${i + 1}`, phone: "09123456789",
  is_active: true, price_per_hour: 200, created_at: "2026-11-04T01:00:00Z", paid_at: null, amount: 200,
  status: "paid", payment_method: "gcash", transaction_reference: `GCASH-${i + 1}`, reference_code: `PB-${i + 1}`,
  bookings: { reference_code: `PB-${i + 1}`, courts: { name: "Court 1" } }, courts: { name: "Court 1" },
  court_name: "Court 1", start_time: "18:00:00", end_time: "19:00:00", checked_in_at: null, admin_note: `Block ${i + 1}`,
}));
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/useAdmin", () => ({ useAdminPayments: () => ({ data: rows, isLoading: false }) }));
vi.mock("@/hooks/useCourts", () => ({ useAllCourts: () => ({ data: rows, isLoading: false }), useCourts: () => ({ data: rows.slice(0, 1) }) }));
vi.mock("@/hooks/useAttendance", () => ({ useBookingAttendance: () => ({ data: rows, isLoading: false }), useSessionAttendance: () => ({ data: [], isLoading: false }) }));
vi.mock("@/hooks/useOpenPlay", () => ({ useAdminOpenPlaySessions: () => ({ data: [] }) }));
vi.mock("@/hooks/useBookings", () => ({ useBookedSlotsAllCourts: () => ({ data: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/attendanceExport", () => ({ exportAttendanceCsv: state.csv, exportAttendancePdf: vi.fn(), fmtTimestamp: () => "Nov 4, 2026" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", async () => ({ ...await vi.importActual("@tanstack/react-query"),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[1] === "roles" ? [] : rows, isLoading: false }),
}));
let client: QueryClient;
beforeEach(() => { client = new QueryClient(); state.csv.mockClear(); });
afterEach(() => { cleanup(); client.clear(); });
function mount(children: ReactNode) { return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>); }

describe("Admin list pagination", () => {
  it.each([
    ["Payments", AdminPayments], ["Members", AdminUsers], ["Courts", AdminCourts],
  ])("shows ten %s per page", (label, Page) => {
    mount(<Page />);
    expect(screen.getAllByRole("row")).toHaveLength(11);
    const pager = screen.getByRole("navigation", { name: `${label} pagination` });
    fireEvent.click(within(pager).getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
  it("paginates admin reservation records while keeping the time grid intact", () => {
    mount(<AdminReservations />);
    expect(screen.queryByText("Block 11")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Reservations pagination" })).getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Block 11")).toBeInTheDocument();
    expect(screen.queryByText("Block 1")).not.toBeInTheDocument();
  });
  it("exports all attendance rows while showing only ten per page", async () => {
    mount(<AdminAttendance />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Court bookings" }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() => expect(state.csv).toHaveBeenCalled());
    expect(state.csv.mock.calls[0][2]).toHaveLength(11);
    const pager = screen.getByRole("navigation", { name: "Booking attendance pagination" });
    fireEvent.click(within(pager).getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Player 11")).toBeInTheDocument();
  });
});
