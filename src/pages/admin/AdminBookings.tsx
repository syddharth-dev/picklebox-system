import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminPagination } from "@/hooks/useAdminPagination";
import { filterAdminBookings, type BookingFilters } from "@/lib/adminBookings";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminBookings } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, Search, XCircle } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "default",
  cancelled: "destructive",
  completed: "secondary",
};

const emptyFilters: BookingFilters = { search: "", status: "all", court: "all", from: "", to: "" };

const AdminBookings = () => {
  const { data: bookings, isLoading, error, refetch } = useAdminBookings();
  const [filters, setFilters] = useState(emptyFilters);
  const filteredBookings = useMemo(() => filterAdminBookings(bookings ?? [], filters), [bookings, filters]);
  const pagination = useAdminPagination(filteredBookings, JSON.stringify(filters));
  const courtOptions = [...new Map((bookings ?? []).map((b) => [b.court_id, b.courts?.name ?? "Unknown court"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const invalidDates = !!filters.from && !!filters.to && filters.from > filters.to;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateBooking = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: "paid" | "cancelled" }) => {
      // Use the SECURITY DEFINER RPC — it atomically updates bookings,
      // booking_slots (frees the slot on cancel), and payments together.
      const { error } = await supabase.rpc("resolve_booking_reservation", {
        p_booking_id: bookingId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      toast({ title: "Booking updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bookings</h1>
          <p className="text-muted-foreground">Manage bookings and verify GCash payments</p>
        </div>

        <div className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="booking-search">Search bookings</Label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input id="booking-search" type="search" className="pl-10" value={filters.search}
                placeholder="Name, phone, booking reference, GCash reference, booking ID or court"
                onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="booking-status">Status</Label>
              <Select value={filters.status} onValueChange={(status) => setFilters({ ...filters, status })}>
                <SelectTrigger id="booking-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-court">Court</Label>
              <Select value={filters.court} onValueChange={(court) => setFilters({ ...filters, court })}>
                <SelectTrigger id="booking-court"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courts</SelectItem>
                  {courtOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="booking-from">Booking date from</Label>
              <Input id="booking-from" type="date" value={filters.from} max={filters.to || undefined}
                aria-invalid={invalidDates} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="booking-to">Booking date to</Label>
              <Input id="booking-to" type="date" value={filters.to} min={filters.from || undefined}
                aria-invalid={invalidDates} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
            <Button type="button" variant="outline" onClick={() => setFilters(emptyFilters)}>Clear filters</Button>
          </div>
          {invalidDates && <p role="alert" className="text-sm text-destructive">The end date must be on or after the start date.</p>}
        </div>

        <Card>
          <CardContent className="p-0">
            {error ? (
              <div role="alert" className="p-8 text-center">Could not load bookings. <Button variant="link" onClick={() => void refetch()}>Try again</Button></div>
            ) : isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading bookings...</div>
            ) : bookings?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No bookings yet</div>
            ) : !filteredBookings.length ? (
              <div className="p-8 text-center text-muted-foreground">No bookings match your search or filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Booked By</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>GCash Ref #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.rows.map((booking) => {
                      const payment = booking.payments?.[0];
                      const isPending = booking.status === "pending";
                      
                      return (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-sm text-foreground">
                            {booking.reference_code || "—"}
                          </TableCell>
                          <TableCell className="text-foreground">
                            <div>
                              <span className="font-medium">{booking.profiles?.full_name || "Unknown"}</span>
                              {booking.profiles?.phone && (
                                <span className="block text-xs text-muted-foreground">{booking.profiles.phone}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">
                            {booking.courts?.name || "Unknown"}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {format(new Date(booking.booking_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {booking.start_time} - {booking.end_time}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            ₱{booking.total_amount}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {payment?.transaction_reference ? (
                              <span className="text-foreground">{payment.transaction_reference}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[booking.status] || "secondary"}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => updateBooking.mutate({
                                    bookingId: booking.id,
                                    status: "paid",
                                  })}
                                  disabled={updateBooking.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateBooking.mutate({
                                    bookingId: booking.id,
                                    status: "cancelled",
                                  })}
                                  disabled={updateBooking.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Deny
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {booking.status === "paid" ? "Verified" : booking.status === "cancelled" ? "Denied" : "—"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && !error && <AdminPagination label="Bookings" pagination={pagination} />}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBookings;
