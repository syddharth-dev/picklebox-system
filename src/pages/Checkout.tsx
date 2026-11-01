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
import { useRef, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import gcashQrImage from "@/assets/gcash-qr.png";
import { PageHeading } from "@/components/layout/PageHeading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { profileSchema } from "@/lib/profile";
import { groupBookingSlots, parseCheckoutState } from "@/lib/booking";
import { useCourts, type Court } from "@/hooks/useCourts";

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
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: currentCourts, isLoading: courtsLoading, error: courtsError, refetch: refetchCourts } = useCourts();
  const submitting = useRef(false);
  const [draft, setDraft] = useState<{ fullName: string; phone: string } | null>(null);
  const formData = draft ?? { fullName: profile?.full_name || "", phone: profile?.phone || "" };

  const bookingData = parseCheckoutState(location.state);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!bookingData?.selections?.length || !bookingData?.date) {
    return <Navigate to="/courts" replace />;
  }

  const { selections, totalPrice, date } = bookingData;
  const ratesChanged = (courts: Court[] | undefined) => !courts || selections.some((selection) => {
    const court = courts.find((court) => court.id === selection.courtId);
    return !court || !court.is_active || Number(court.price_per_hour) !== selection.pricePerHour;
  });
  const pricingBlocked = courtsLoading || !!courtsError || ratesChanged(currentCourts);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitBooking = async () => {
    if (submitting.current || profileLoading || profileError || pricingBlocked) return;
    const contact = profileSchema.safeParse({ full_name: formData.fullName, phone: formData.phone });
    if (!contact.success || !contact.data.phone) {
      toast({
        title: "Missing Information",
        description: !contact.success ? contact.error.issues[0].message : "Enter your phone number.",
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

    if (!parseCheckoutState(location.state)) {
      toast({ title: "Selection expired", description: "Choose a future court time before submitting.", variant: "destructive" });
      navigate("/courts");
      return;
    }
    submitting.current = true;
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
      for (const group of groupBookingSlots(sel.slots)) {
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
      if (!sessionData.session || sessionData.session.user.id !== user.id) {
        toast({
          title: "Please sign in again",
          description: "Your session expired. Sign in and resubmit your booking.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const latestCourts = await refetchCourts();
      if (latestCourts.error) throw new Error("Could not verify the current court rates. Please try again.");
      if (ratesChanged(latestCourts.data)) {
        toast({ title: "Court details changed", description: "Review the current court rates and availability before paying or submitting.", variant: "destructive" });
        return;
      }

      await updateProfile.mutateAsync(contact.data);

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
      if (!createdIds.length) throw new Error("Could not confirm the saved reservation. Check My bookings before submitting again.");

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
    } catch (error: unknown) {
      const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
      toast({
        title: "Booking Failed",
        description:
          message.includes("PENDING_BOOKING_LIMIT")
            ? "You can hold up to 24 court hours while payment verification is pending. Reduce this booking, wait for approval, or cancel an unused pending reservation."
            : message.includes("BOOKING_RATE_LIMIT")
            ? "Too many reservation attempts. Wait a minute before trying again."
            : message ||
          "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      submitting.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main id="main-content" className="pt-32 pb-20 md:pt-40">
        <div className="site-container max-w-[1200px]">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Booking</span>
          </button>
          <PageHeading title="Make it a plan." description="Review your court time, send your GCash payment, and submit your reference for staff approval." />

          {/* Progress Steps */}
          <div aria-label="Booking progress" className="mb-10 flex flex-wrap items-center gap-3 text-sm sm:gap-4">
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

          <div className="grid items-start gap-8 lg:grid-cols-5 lg:gap-10">
            {/* Payment Form */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">These contact details will be saved to your profile. Notifications use your account email.</p>
                  {profileError && <div role="alert" className="text-sm text-destructive">Could not load your contact details. <button type="button" className="underline" onClick={() => void refetchProfile()}>Try again</button></div>}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input id="fullName" name="fullName" autoComplete="name" maxLength={120} disabled={profileLoading || !!profileError} placeholder="Juan Dela Cruz" value={formData.fullName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input id="email" name="email" autoComplete="email" type="email" value={user.email || ""} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input id="phone" name="phone" autoComplete="tel" maxLength={32} disabled={profileLoading || !!profileError} type="tel" placeholder="+63 912 345 6789" value={formData.phone} onChange={handleInputChange} />
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
                  {pricingBlocked && <div role="alert" className="rounded-lg border border-border p-4 text-sm">
                    {courtsLoading ? "Checking current court rates…" : "Court details could not be verified or have changed. Review current rates before sending payment."}
                    <div className="mt-2 flex flex-wrap gap-3"><button type="button" className="underline" onClick={() => void refetchCourts()}>Check again</button><button type="button" className="underline" onClick={() => navigate("/courts?date=" + date)}>Review courts</button></div>
                  </div>}
                  <div hidden={pricingBlocked} className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                      <p className="font-semibold text-foreground">Send payment via GCash</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-muted/30 text-center space-y-3">
                      <button type="button" aria-label="Enlarge GCash payment QR" onClick={() => setQrFullscreen(true)} className="mx-auto block rounded-lg bg-white p-2">
                      <img
                        src={gcashQrImage}
                        alt="GCash QR Code"
                        className="h-48 w-48 rounded-lg object-contain"
                      />
                      </button>
                      <p className="text-xs text-muted-foreground">Tap the QR code to enlarge</p>
                      <p className="text-sm text-muted-foreground">
                        Send <span className="font-bold text-foreground">₱{totalPrice}</span> via GCash
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Open your GCash app → Scan QR → Send ₱{totalPrice}
                      </p>
                    </div>

                    <Dialog open={qrFullscreen} onOpenChange={setQrFullscreen}>
                      <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>GCash payment QR</DialogTitle><DialogDescription>Scan this code with GCash and send the amount shown in your booking summary.</DialogDescription></DialogHeader>
                        <img
                          src={gcashQrImage}
                          alt="GCash QR Code"
                          className="mx-auto max-h-[65dvh] w-full rounded-xl bg-white object-contain"
                        />
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                      <p className="font-semibold text-foreground">Enter GCash Reference Number</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-reference" className="sr-only">GCash reference number</Label>
                      <Input
                        id="payment-reference"
                        maxLength={128}
                        placeholder="e.g. 1234 567 890"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="text-base tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        You can find the reference number in your GCash transaction receipt after sending the payment.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      Your booking will be marked as <strong>pending</strong> until the admin verifies your payment. Time slots stay reserved for you during verification. Up to 24 court hours can await verification per account; check your pending bookings before sending payment.
                    </span>
                  </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-2 lg:sticky lg:top-28">
              <Card>
                <CardHeader>
                  <CardTitle>Your court time</CardTitle>
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
                    disabled={isProcessing || profileLoading || !!profileError || pricingBlocked || !referenceNumber.trim()}
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-ink/30 border-t-brand-ink" />
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
