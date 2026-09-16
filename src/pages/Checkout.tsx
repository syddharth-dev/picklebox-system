import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Smartphone, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import gcashQrImage from "@/assets/gcash-qr.png";

type Selection = {
  courtId: string;
  courtName: string;
  pricePerHour: number;
  slots: string[]; // "HH:MM:SS"
};

// Split sorted slots into contiguous groups.
// e.g. ["07:00:00","08:00:00","15:00:00"] → [["07:00:00","08:00:00"], ["15:00:00"]]
function groupContiguous(slots: string[]): string[][] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort();
  const groups: string[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prevHour = parseInt(sorted[i - 1].split(":")[0], 10);
    const currHour = parseInt(sorted[i].split(":")[0], 10);
    if (currHour === prevHour + 1) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups;
}

function endTimeForGroup(group: string[]): string {
  const lastStart = group[group.length - 1];
  const endHour = parseInt(lastStart.split(":")[0], 10) + 1;
  return `${endHour.toString().padStart(2, "0")}:00:00`;
}

function formatSlot(t: string): string {
  const h = parseInt(t.split(":")[0], 10);
  const suffix = h < 12 ? "AM" : "PM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:00 ${suffix}`;
}

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [isProcessing, setIsProcessing] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [formData, setFormData] = useState({ fullName: "", email: "", phone: "" });

  const bookingData = location.state as
    | { date: string; selections: Selection[]; totalPrice: number }
    | undefined;

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!bookingData?.selections?.length || !bookingData?.date) {
    return <Navigate to="/courts" replace />;
  }

  const { selections, totalPrice, date } = bookingData;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmitBooking = async () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (!referenceNumber.trim()) {
      toast({
        title: "Reference Number Required",
        description: "Please enter the GCash reference number after sending your payment.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const bookingDate = format(new Date(date), "yyyy-MM-dd");

    // Build atomic items list: one row per contiguous group per court
    const items: Array<{
      court_id: string;
      court_name: string;
      start_time: string;
      end_time: string;
      amount: number;
    }> = [];
    for (const sel of selections) {
      for (const group of groupContiguous(sel.slots)) {
        items.push({
          court_id: sel.courtId,
          court_name: sel.courtName,
          start_time: group[0],
          end_time: endTimeForGroup(group),
          amount: group.length * sel.pricePerHour,
        });
      }
    }

    try {
      // Make sure the sign-in is still valid; an expired session makes the
      // booking request fail with a confusing "not found" error.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Please sign in again",
          description: "Your session expired. Sign in and resubmit your booking.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.rpc("create_bookings_atomic", {
        p_date: bookingDate,
        p_reference: referenceNumber.trim(),
        p_items: items.map(({ court_name, ...rest }) => rest),
      });

      if (error) {
        // Parse structured "SLOT_TAKEN:<court_id>:<start_time>" from Postgres
        const msg = error.message || "";
        const match = msg.match(/SLOT_TAKEN:([0-9a-f-]+):(\d{2}:\d{2}:\d{2})/i);
        if (match) {
          const [, courtId, startTime] = match;
          const item = items.find(
            (i) => i.court_id === courtId && i.start_time === startTime
          );
          const label = item
            ? `${item.court_name} at ${formatSlot(startTime)}`
            : "one of your slots";
          toast({
            title: "Slot just taken",
            description: `${label} was booked by someone else moments ago. No bookings or payments were created. Please pick another slot.`,
            variant: "destructive",
          });
          // Refresh availability and send user back
          queryClient.invalidateQueries({ queryKey: ["booked-slots-all"] });
          queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
          navigate("/courts");
          return;
        }
        throw error;
      }

      const createdIds = (data as string[]) || [];

      // Fire-and-forget notifications
      createdIds.forEach((id) => {
        supabase.functions
          .invoke("send-booking-notification", {
            body: { bookingId: id, type: "confirmation" },
          })
          .catch((err) => console.error("Notification error:", err));
      });

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booked-slots-all"] });
      navigate("/confirmation", { state: { bookingIds: createdIds } });
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description:
          error.message ||
          "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Booking</span>
          </button>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">Select</span>
            </div>
            <div className="h-px w-12 bg-primary" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-primary-foreground text-sm font-semibold">
                2
              </div>
              <span className="text-sm font-medium text-foreground">Payment</span>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-semibold">
                3
              </div>
              <span className="text-sm text-muted-foreground">Confirm</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Payment Form */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input id="fullName" name="fullName" placeholder="Juan Dela Cruz" value={formData.fullName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input id="email" name="email" type="email" placeholder="juan@example.com" value={formData.email} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+63 912 345 6789" value={formData.phone} onChange={handleInputChange} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    GCash Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                      <p className="font-semibold text-foreground">Send payment via GCash</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-muted/30 text-center space-y-3">
                      <img
                        src={gcashQrImage}
                        alt="GCash QR Code"
                        className="w-48 h-48 mx-auto rounded-lg object-contain cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setQrFullscreen(true)}
                      />
                      <p className="text-xs text-muted-foreground">Tap the QR code to enlarge</p>
                      <p className="text-sm text-muted-foreground">
                        Send <span className="font-bold text-foreground">₱{totalPrice}</span> via GCash
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Open your GCash app → Scan QR → Send ₱{totalPrice}
                      </p>
                    </div>

                    {qrFullscreen && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setQrFullscreen(false)}
                      >
                        <img
                          src={gcashQrImage}
                          alt="GCash QR Code"
                          className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                      <p className="font-semibold text-foreground">Enter GCash Reference Number</p>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="e.g. 1234 567 890"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="font-mono text-lg"
                      />
                      <p className="text-xs text-muted-foreground">
                        You can find the reference number in your GCash transaction receipt after sending the payment.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      Your booking will be marked as <strong>pending</strong> until the admin verifies your payment. Time slots stay reserved for you during verification.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-2">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">{format(new Date(date), "EEE, MMM d, yyyy")}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selections.map((sel) => (
                      <div key={sel.courtId} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-foreground text-sm">{sel.courtName}</p>
                          <span className="text-sm text-muted-foreground">
                            ₱{sel.pricePerHour} × {sel.slots.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {sel.slots.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {formatSlot(s)}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-right text-sm font-semibold text-foreground">
                          ₱{sel.slots.length * sel.pricePerHour}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">₱{totalPrice}</span>
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={handleSubmitBooking}
                    disabled={isProcessing || !referenceNumber.trim()}
                  >
                    {isProcessing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 mr-2" />
                        Submit Booking
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Your booking will be confirmed once payment is verified by admin
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;
