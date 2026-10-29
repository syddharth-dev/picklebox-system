import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import {
  Calendar,
  CreditCard,
  MapPin,
  Trophy,
  QrCode,
  Users,
} from "lucide-react";
import { useAdminBookings, useTodayBookings, useTodayOpenPlay } from "@/hooks/useAdmin";
import { useAllCourts } from "@/hooks/useCourts";
import { format, subDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useMemo } from "react";

const statusColors: Record<string, string> = {
  paid: "bg-primary text-primary-foreground",
  pending: "bg-accent text-accent-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
];

const fmtTime = (t: string) => {
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return format(d, "h:mm a");
};

const AdminDashboard = () => {
  const { data: bookings, isLoading: bookingsLoading } = useAdminBookings();
  const { data: courts, isLoading: courtsLoading } = useAllCourts();
  const { data: todayBookings, isLoading: todayBookingsLoading } = useTodayBookings();
  const { data: todaySessions, isLoading: todaySessionsLoading } = useTodayOpenPlay();

  const isLoading = bookingsLoading || courtsLoading;

  const totalBookings = bookings?.length || 0;
  const totalRevenue =
    bookings
      ?.filter((b: any) => b.status === "paid" || b.status === "completed")
      .reduce((sum, b: any) => sum + Number(b.total_amount || 0), 0) || 0;
  const activeCourts = courts?.filter((c) => c.is_active)?.length || 0;
  const pendingPayments = bookings?.filter((b: any) => b.status === "pending").length || 0;
  const recentBookings = bookings?.slice(0, 5) || [];

  const bookingCheckIns = (todayBookings ?? []).filter((b: any) => !!b.checked_in_at).length;
  const sessionCheckIns = (todaySessions ?? []).reduce((s, x) => s + x.checked_in, 0);
  const expectedToday =
    (todayBookings ?? []).filter((b: any) => b.status === "paid" || b.status === "completed").length +
    (todaySessions ?? []).reduce((s, x) => s + x.registered, 0);

  const revenueData = useMemo(() => {
    if (!bookings) return [];
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      days[format(subDays(new Date(), i), "MMM d")] = 0;
    }
    bookings.forEach((b: any) => {
      if (b.status === "paid" || b.status === "completed") {
        const day = format(new Date(b.booking_date), "MMM d");
        if (day in days) days[day] += Number(b.total_amount || 0);
      }
    });
    return Object.entries(days).map(([name, revenue]) => ({ name, revenue }));
  }, [bookings]);

  const statusData = useMemo(() => {
    if (!bookings) return [];
    const counts: Record<string, number> = {};
    bookings.forEach((b: any) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [bookings]);

  const stats = [
    { title: "Total Bookings", value: totalBookings.toString(), icon: Calendar },
    { title: "Revenue", value: `₱${totalRevenue.toLocaleString()}`, icon: CreditCard },
    { title: "Active Courts", value: activeCourts.toString(), icon: MapPin },
    { title: "Awaiting Payment", value: pendingPayments.toString(), icon: Users },
    {
      title: "Checked In Today",
      value: `${bookingCheckIns + sessionCheckIns}/${expectedToday}`,
      icon: QrCode,
    },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-secondary">Operations overview</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">Today at The Pickle Box</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")} — everything happening today.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/check-in">
                <QrCode className="mr-2 h-4 w-4" /> Open Scanner
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/open-play">
                <Trophy className="mr-2 h-4 w-4" /> Open Play
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
                )}
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Today: Open Play + Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> Today's Open Play
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/open-play">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySessionsLoading ? (
                [1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (todaySessions ?? []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sessions scheduled today</p>
              ) : (
                todaySessions!.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {s.title || "Open Play"}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Skill {s.skill} · {s.registered}/{s.max_players} players
                        {s.waitlisted > 0 ? ` · ${s.waitlisted} waitlisted` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === "cancelled" ? (
                        <Badge className="bg-destructive/10 text-destructive">Cancelled</Badge>
                      ) : (
                        <Badge variant="secondary">{s.checked_in} checked in</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Today's Court Bookings
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/bookings">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayBookingsLoading ? (
                [1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (todayBookings ?? []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bookings for today</p>
              ) : (
                todayBookings!.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {b.full_name}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {b.courts?.name || "Court"}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fmtTime(b.start_time)}–{fmtTime(b.end_time)} · ₱{b.total_amount}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[b.status] || ""}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </Badge>
                      {b.checked_in_at ? (
                        <Badge variant="secondary">
                          In {format(new Date(b.checked_in_at), "h:mm a")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not in</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [`₱${value.toLocaleString()}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : statusData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentBookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bookings yet</p>
            ) : (
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentBookings.map((booking: any) => (
                      <TableRow key={booking.id}>
                        <td className="py-4 px-4 font-mono text-sm text-foreground">{booking.reference_code || "—"}</td>
                        <td className="py-4 px-4 text-sm text-muted-foreground">{booking.courts?.name || "Unknown"}</td>
                        <td className="py-4 px-4 text-sm text-foreground">{format(new Date(booking.booking_date), "MMM d, yyyy")}</td>
                        <td className="py-4 px-4 font-semibold text-foreground">₱{booking.total_amount}</td>
                        <TableCell>
                          <Badge className={statusColors[booking.status] || ""}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
