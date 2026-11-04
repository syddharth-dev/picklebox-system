import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminPagination } from "@/hooks/useAdminPagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { useAdminOpenPlaySessions } from "@/hooks/useOpenPlay";
import { useSessionAttendance, useBookingAttendance } from "@/hooks/useAttendance";
import {
  AttendanceRow,
  exportAttendanceCsv,
  exportAttendancePdf,
  fmtTimestamp,
} from "@/lib/attendanceExport";

const statusLabel: Record<string, string> = {
  registered: "Registered (not checked in)",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  checked_in: "Checked in",
  no_show: "No-show",
  pending: "Pending payment",
  paid: "Paid (not checked in)",
  completed: "Completed",
};

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "checked_in") return "default";
  if (status === "no_show" || status === "cancelled") return "destructive";
  if (status === "waitlisted" || status === "pending") return "outline";
  return "secondary";
};

const AdminAttendance = () => {
  const { data: sessions } = useAdminOpenPlaySessions();
  const [sessionId, setSessionId] = useState<string>();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: roster, isLoading: rosterLoading } = useSessionAttendance(sessionId);
  const { data: bookings, isLoading: bookingsLoading } = useBookingAttendance(date);
  const rosterPagination = useAdminPagination(roster, sessionId);
  const bookingPagination = useAdminPagination(bookings, date);

  const session = sessions?.find((s: any) => s.id === sessionId);

  const sessionRows: AttendanceRow[] = useMemo(
    () =>
      (roster ?? []).map((r) => ({
        name: r.full_name,
        phone: r.phone,
        detail:
          r.status === "waitlisted" && r.waitlist_position
            ? `Waitlist #${r.waitlist_position}`
            : r.payment_reference || "—",
        status: statusLabel[r.status] ?? r.status,
        payment: r.payment_status,
        registeredAt: fmtTimestamp(r.registered_at),
        checkedInAt: fmtTimestamp(r.checked_in_at),
      })),
    [roster]
  );

  const bookingRows: AttendanceRow[] = useMemo(
    () =>
      (bookings ?? []).map((b) => ({
        name: b.full_name,
        phone: b.phone,
        detail: `${b.court_name} · ${b.start_time}–${b.end_time} · ${b.reference_code || "—"}`,
        status: b.checked_in_at ? "Checked in" : statusLabel[b.status] ?? b.status,
        payment: b.status === "paid" || b.status === "completed" ? "completed" : b.status,
        registeredAt: fmtTimestamp(b.created_at),
        checkedInAt: fmtTimestamp(b.checked_in_at),
      })),
    [bookings]
  );

  const sessionSummary = useMemo(() => {
    const r = roster ?? [];
    const count = (s: string) => r.filter((x) => x.status === s).length;
    return `Checked in: ${count("checked_in")} · Registered: ${count("registered")} · Waitlisted: ${count(
      "waitlisted"
    )} · No-show: ${count("no_show")} · Cancelled: ${count("cancelled")} · Total: ${r.length}`;
  }, [roster]);

  const bookingSummary = useMemo(() => {
    const b = bookings ?? [];
    const checked = b.filter((x) => x.checked_in_at).length;
    const cancelled = b.filter((x) => x.status === "cancelled").length;
    return `Checked in: ${checked} · Not checked in: ${b.length - checked - cancelled} · Cancelled: ${cancelled} · Total: ${b.length}`;
  }, [bookings]);

  const sessionTitle = session
    ? `${session.title || "Open Play"} — ${format(new Date(session.session_date), "MMM d, yyyy")} ${session.start_time}–${session.end_time}`
    : "";

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground">
            Review and export who checked in, who was waitlisted, and who never showed up
          </p>
        </div>

        <Tabs defaultValue="open-play">
          <TabsList className="mb-6">
            <TabsTrigger value="open-play">Open Play sessions</TabsTrigger>
            <TabsTrigger value="bookings">Court bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="open-play">
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-md space-y-2">
                  <Label>Session</Label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sessions ?? []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {format(new Date(s.session_date), "MMM d")} · {s.start_time}–{s.end_time} ·{" "}
                          {s.title || "Open Play"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!sessionRows.length}
                    onClick={() =>
                      exportAttendanceCsv(
                        `Open Play attendance — ${sessionTitle}`,
                        sessionSummary,
                        sessionRows,
                        `open-play-attendance-${session?.session_date}.csv`
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" /> CSV
                  </Button>
                  <Button
                    disabled={!sessionRows.length}
                    onClick={() =>
                      exportAttendancePdf(
                        "Open Play attendance",
                        sessionTitle,
                        sessionSummary,
                        sessionRows,
                        `open-play-attendance-${session?.session_date}.pdf`
                      )
                    }
                  >
                    <FileText className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!sessionId ? (
                  <div className="p-8 text-center text-muted-foreground">Select a session to view attendance</div>
                ) : rosterLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading attendance...</div>
                ) : !roster?.length ? (
                  <div className="p-8 text-center text-muted-foreground">No registrations for this session</div>
                ) : (
                  <>
                    <p className="px-6 pb-4 text-sm text-muted-foreground">{sessionSummary}</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Waitlist / Ref</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Registered at</TableHead>
                            <TableHead>Checked in at</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rosterPagination.rows.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-foreground">
                                <span className="font-medium">{r.full_name}</span>
                                <span className="block text-xs text-muted-foreground">{r.phone}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={badgeVariant(r.status)}>
                                  {statusLabel[r.status] ?? r.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {r.status === "waitlisted" && r.waitlist_position
                                  ? `#${r.waitlist_position}`
                                  : r.payment_reference || "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{r.payment_status}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmtTimestamp(r.registered_at)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmtTimestamp(r.checked_in_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <AdminPagination label="Session attendance" pagination={rosterPagination} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-xs space-y-2">
                  <Label htmlFor="attendance-date">Booking date</Label>
                  <Input
                    id="attendance-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!bookingRows.length}
                    onClick={() =>
                      exportAttendanceCsv(
                        `Court booking attendance — ${format(new Date(date), "MMM d, yyyy")}`,
                        bookingSummary,
                        bookingRows,
                        `booking-attendance-${date}.csv`
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" /> CSV
                  </Button>
                  <Button
                    disabled={!bookingRows.length}
                    onClick={() =>
                      exportAttendancePdf(
                        "Court booking attendance",
                        format(new Date(date), "MMMM d, yyyy"),
                        bookingSummary,
                        bookingRows,
                        `booking-attendance-${date}.pdf`
                      )
                    }
                  >
                    <FileText className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {bookingsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading attendance...</div>
                ) : !bookings?.length ? (
                  <div className="p-8 text-center text-muted-foreground">No bookings on this date</div>
                ) : (
                  <>
                    <p className="px-6 pb-4 text-sm text-muted-foreground">{bookingSummary}</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead>Court</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Booked at</TableHead>
                            <TableHead>Checked in at</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookingPagination.rows.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="text-foreground">
                                <span className="font-medium">{b.full_name}</span>
                                <span className="block text-xs text-muted-foreground">{b.phone}</span>
                              </TableCell>
                              <TableCell className="text-foreground">{b.court_name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {b.start_time} - {b.end_time}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                {b.reference_code || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={b.checked_in_at ? "default" : badgeVariant(b.status)}>
                                  {b.checked_in_at ? "Checked in" : statusLabel[b.status] ?? b.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmtTimestamp(b.created_at)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmtTimestamp(b.checked_in_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <AdminPagination label="Booking attendance" pagination={bookingPagination} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAttendance;
