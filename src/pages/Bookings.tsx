import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MoreVertical, Eye, XCircle, QrCode, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { QRCodeDialog } from "@/components/checkin/QRCodeDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUserBookings } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type BookingStatus = "pending" | "paid" | "completed" | "cancelled";

const statusColors: Record<BookingStatus, string> = {
  paid: "bg-primary text-primary-foreground",
  pending: "bg-accent text-accent-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: bookings, isLoading } = useUserBookings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelBooking = useMutation({
    mutationFn: async (id: string) => {
      // RPC also frees the reserved slot and marks the pending payment as failed.
      const { error } = await supabase.rpc("cancel_booking_reservation", { p_booking_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking cancelled" });
      // Send cancellation notification
      supabase.functions.invoke("send-booking-notification", {
        body: { bookingId: id, type: "cancellation" },
      }).catch((err) => console.error("Notification error:", err));
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const upcomingBookings = bookings?.filter(
    (b) => b.status === "paid" || b.status === "pending"
  ) || [];
  const pastBookings = bookings?.filter(
    (b) => b.status === "completed" || b.status === "cancelled"
  ) || [];

  const BookingCard = ({ booking }: { booking: any }) => {
    const [qrOpen, setQrOpen] = useState(false);
    return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground text-lg">{booking.courts?.name || "Court"}</h3>
          </div>
          <Badge className={statusColors[booking.status as BookingStatus] || ""}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(booking.booking_date), "EEE, MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{booking.start_time} - {booking.end_time}</span>
          </div>
        </div>

        <div className="mb-4">
          {booking.status === "cancelled" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
              <XCircle className="h-3.5 w-3.5" /> Cancelled
            </span>
          ) : booking.checked_in_at ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Checked in · {format(new Date(booking.checked_in_at), "MMM d, p")}
            </span>
          ) : booking.status === "paid" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Not checked in yet
            </span>
          ) : null}
        </div>

        {booking.status === "paid" && (
          <div className="mb-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4 mr-2" />
              {booking.checked_in_at ? "View QR (checked in)" : "Show check-in QR"}
            </Button>
            <QRCodeDialog
              open={qrOpen}
              onOpenChange={setQrOpen}
              kind="booking"
              id={booking.id}
              title={booking.courts?.name || "Court"}
              subtitle={`${format(new Date(booking.booking_date), "EEE, MMM d")} · ${booking.start_time} – ${booking.end_time}`}
              referenceCode={booking.reference_code}
              checkedInAt={booking.checked_in_at}
            />
          </div>
        )}
        {booking.status === "pending" && (
          <p className="mb-4 text-xs text-muted-foreground">
            Your check-in QR code unlocks once the admin approves your payment.
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Ref: {booking.reference_code || "—"}</p>
            <p className="text-lg font-bold text-foreground">₱{booking.total_amount}</p>
          </div>
          {booking.status === "pending" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => cancelBooking.mutate(booking.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Booking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-32 pb-16 md:pt-36">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              My Bookings
            </h1>
            <p className="text-muted-foreground">
              Manage your court reservations and view booking history
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="upcoming">
                  Upcoming ({upcomingBookings.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past ({pastBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-4">
                {upcomingBookings.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingBookings.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No upcoming bookings</p>
                      <Button asChild>
                        <a href="/courts">Book a Court</a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-4">
                {pastBookings.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pastBookings.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">No past bookings</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Bookings;
