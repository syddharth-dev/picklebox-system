import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock as ClockIcon, Calendar, Clock, Home, AlertCircle } from "lucide-react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useBookingsByIds } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";

const Confirmation = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const state = location.state as { bookingIds?: string[]; bookingId?: string } | null;
  // Support legacy single-booking state as well
  const ids = state?.bookingIds ?? (state?.bookingId ? [state.bookingId] : undefined);

  const { data: bookings, isLoading } = useBookingsByIds(ids);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!ids?.length) return <Navigate to="/courts" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 pb-16 md:pt-36">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="text-center mb-8">
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-6" />
              <Skeleton className="h-8 w-64 mx-auto mb-2" />
              <Skeleton className="h-4 w-96 mx-auto" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!bookings?.length) return <Navigate to="/courts" replace />;

  const first = bookings[0] as any;
  const totalAmount = bookings.reduce((s, b: any) => s + Number(b.total_amount || 0), 0);
  const bookingDate = first.booking_date;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-32 pb-16 md:pt-36">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-8 animate-slide-up">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary mb-6">
              <ClockIcon className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {bookings.length === 1 ? "Booking Submitted!" : `${bookings.length} Bookings Submitted!`}
            </h1>
            <p className="text-muted-foreground">
              Your {bookings.length === 1 ? "booking is" : "bookings are"} pending admin verification of your GCash payment.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground">
              <p className="font-semibold mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>The admin will verify your GCash payment using your reference number</li>
                <li>Once verified, your booking status will be updated to <strong className="text-foreground">Paid</strong></li>
                <li>Your time slots stay reserved during verification</li>
                <li>If denied, the slots will be released for others to book</li>
                <li>Once paid, a <strong className="text-foreground">check-in QR code</strong> appears on My Bookings — show it at the court</li>
              </ul>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {format(new Date(bookingDate), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">Booking date</p>
                </div>
              </div>

              <div className="space-y-3">
                {bookings.map((b: any) => (
                  <div key={b.id} className="p-4 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground">{b.courts?.name || "Court"}</p>
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Clock className="h-4 w-4" />
                      <span>{b.start_time} – {b.end_time}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">Ref: {b.reference_code || "—"}</span>
                      <span className="font-semibold text-foreground">₱{b.total_amount}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                <span className="font-medium text-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-primary">₱{totalAmount}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/bookings" className="flex-1">
              <Button variant="hero" className="w-full">
                View My Bookings
              </Button>
            </Link>
            <Link to="/" className="flex-1">
              <Button variant="heroOutline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Need help? Contact our support at{" "}
            <a href="mailto:support@picklecourt.ph" className="text-primary hover:underline">
              support@picklecourt.ph
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Confirmation;
