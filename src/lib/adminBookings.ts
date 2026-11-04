export interface BookingFilters {
  search: string;
  status: string;
  court: string;
  from: string;
  to: string;
}

interface SearchableBooking {
  id: string;
  reference_code: string | null;
  status: string;
  court_id: string;
  booking_date: string;
  courts: { name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  payments: { transaction_reference: string | null }[];
}

export function filterAdminBookings<T extends SearchableBooking>(rows: readonly T[], filters: BookingFilters): T[] {
  const search = filters.search.trim().replace(/\s+/g, " ").toLowerCase();
  return rows.filter((booking) => {
    if (filters.status !== "all" && booking.status !== filters.status) return false;
    if (filters.court !== "all" && booking.court_id !== filters.court) return false;
    if (filters.from && booking.booking_date < filters.from) return false;
    if (filters.to && booking.booking_date > filters.to) return false;
    const fields = [booking.id, booking.reference_code, booking.profiles?.full_name,
      booking.profiles?.phone, booking.courts?.name,
      ...(booking.payments ?? []).map((payment) => payment.transaction_reference),
    ].filter((value): value is string => typeof value === "string").map((value) => value.replace(/\s+/g, " ").toLowerCase());
    return !search || fields.some((field) => field.includes(search));
  });
}
