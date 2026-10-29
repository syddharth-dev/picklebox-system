import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Users, Clock, Calendar, MapPin, Trophy, X, QrCode, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCourts } from "@/hooks/useCourts";
import { useToast } from "@/hooks/use-toast";
import {
  useOpenPlaySessions,
  useOpenPlayRoster,
  useRegisterOpenPlay,
  useCancelOpenPlayRegistration,
} from "@/hooks/useOpenPlay";
import { QRCodeDialog } from "@/components/checkin/QRCodeDialog";
import { openPlayErrorMessage, openPlayStart } from "@/lib/openPlay";
import gcashQr from "@/assets/gcash-qr.png";

const skillLabel: Record<string, string> = {
  all: "All Levels",
  "2.5-3.0": "2.5 – 3.0",
  "3.5": "3.5",
  "4.0+": "4.0+",
};

const OpenPlay = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: sessions, isLoading, error, refetch } = useOpenPlaySessions();
  const { data: courts } = useCourts();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const openSession = sessions?.find((session) => session.id === selectedSessionId);
  const [paymentRef, setPaymentRef] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const { toast } = useToast();
  const register = useRegisterOpenPlay();
  const cancel = useCancelOpenPlayRegistration();

  const courtNameMap = useMemo(() => {
    const m = new Map<string, string>();
    courts?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [courts]);

  const { data: roster, isLoading: rosterLoading, error: rosterError, refetch: refetchRoster } = useOpenPlayRoster(openSession?.id);

  const selectSession = (id: string | null) => {
    setSelectedSessionId(id);
    setPaymentRef("");
    setQrOpen(false);
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const scheduled = (sessions ?? []).filter((s) => s.status === "scheduled"
    && (openPlayStart(s) > Date.now() || !!s.my_status));
  const started = !!openSession && openPlayStart(openSession) <= Date.now();
  const canCancel = !!openSession && ["registered", "waitlisted"].includes(openSession.my_status)
    && Date.now() < openPlayStart(openSession) - openSession.cancel_cutoff_hours * 3_600_000;

  const handleRegister = async () => {
    if (!openSession || started || register.isPending || error) return;
    if (openSession.price_php > 0 && !paymentRef.trim()) {
      toast({
        title: "GCash reference required",
        description: "Enter your GCash reference number to register.",
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await register.mutateAsync({
        sessionId: openSession.id,
        paymentReference: paymentRef.trim() || undefined,
      });
      toast({
        title:
          res.status === "waitlisted"
            ? `Added to waitlist (#${res.waitlist_position})`
            : "You're registered!",
      });
      setPaymentRef("");
      selectSession(null);
    } catch (e: unknown) {
      toast({ title: "Registration failed", description: openPlayErrorMessage(e), variant: "destructive" });
    }
  };

  const handleCancel = async (registrationId: string) => {
    try {
      await cancel.mutateAsync(registrationId);
      toast({ title: "Registration cancelled" });
      selectSession(null);
    } catch (e: unknown) {
      toast({ title: "Cancel failed", description: openPlayErrorMessage(e), variant: "destructive" });
    }
  };

  const myRosterRow = roster?.find((r) => r.user_id === user.id);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-32 pb-16 md:pt-36">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Open Play
              </h1>
              <p className="text-muted-foreground max-w-xl">
                Drop-in sessions organized by skill level. Register per player — pay via
                GCash, show up, and play.
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              <Trophy className="h-3 w-3 mr-1" /> {scheduled.filter((s) => openPlayStart(s) > Date.now()).length} upcoming
            </Badge>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 p-6">
              <p>Could not load Open Play sessions. Please try again.</p>
              <Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          ) : scheduled.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No open play sessions scheduled yet. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduled.map((s) => {
                const isFull = s.registered_count >= s.max_players;
                const mine = s.my_status;
                return (
                  <Card
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${s.title || "Open Play"} session`}
                    className="hover:shadow-md transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => selectSession(s.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectSession(s.id);
                      }
                    }}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">
                            {s.title || "Open Play"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {skillLabel[s.skill]}
                          </p>
                        </div>
                        {mine === "registered" && <Badge>Registered</Badge>}
                        {mine === "checked_in" && (
                          <Badge className="bg-primary text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Checked in
                          </Badge>
                        )}
                        {mine === "waitlisted" && (
                          <Badge variant="secondary">Waitlist #{s.my_waitlist_position}</Badge>
                        )}
                      </div>

                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(s.session_date), "EEE, MMM d")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {s.court_ids
                            .map((id) => courtNameMap.get(id) ?? "Court")
                            .join(", ")}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {s.registered_count}/{s.max_players}
                          </span>
                          {s.waitlist_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +{s.waitlist_count} waitlist
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">
                            {s.price_php > 0 ? `₱${s.price_php}` : "Free"}
                          </p>
                          {isFull && !mine && (
                            <p className="text-xs text-destructive">Full</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!openSession} onOpenChange={(o) => !o && selectSession(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto max-w-lg">
          {openSession && (
            <>
              <DialogHeader>
                <DialogTitle>{openSession.title || "Open Play"}</DialogTitle>
                <DialogDescription>
                  {format(parseISO(openSession.session_date), "EEEE, MMM d")} ·{" "}
                  {openSession.start_time.slice(0, 5)} –{" "}
                  {openSession.end_time.slice(0, 5)} · {skillLabel[openSession.skill]}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Courts</p>
                    <p className="font-medium">
                      {openSession.court_ids
                        .map((id) => courtNameMap.get(id) ?? "Court")
                        .join(", ")}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Fee per player</p>
                    <p className="font-medium">
                      {openSession.price_php > 0 ? `₱${openSession.price_php}` : "Free"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="font-medium">
                      {openSession.registered_count}/{openSession.max_players} registered
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Waitlist</p>
                    <p className="font-medium">{openSession.waitlist_count}</p>
                  </div>
                </div>

                {openSession.notes && (
                  <p className="text-sm text-muted-foreground">{openSession.notes}</p>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Your registration</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {rosterLoading ? (
                      <p className="text-sm text-muted-foreground">Loading your registration...</p>
                    ) : rosterError ? (
                      <div role="alert" className="text-sm text-destructive">
                        Could not load your registration.
                        <Button variant="link" onClick={() => void refetchRoster()}>Try again</Button>
                      </div>
                    ) : (roster ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">You haven't registered for this session.</p>
                    )}
                    {(roster ?? []).map((r) => (
                      <div
                        key={r.registration_id}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span>{r.full_name || "Player"}</span>
                        {r.status === "waitlisted" ? (
                          <Badge variant="secondary" className="text-xs">
                            Waitlist #{r.waitlist_position}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {r.status === "checked_in" ? "Checked in" : r.status === "no_show" ? "No-show" : "Registered"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {!openSession.my_status && openSession.price_php > 0 && (
                  <div className="space-y-2">
                    <img src={gcashQr} alt="Scan this GCash QR code to pay the session fee" className="mx-auto h-40 w-40 rounded-lg object-contain bg-white" />
                    <Label htmlFor="gcash-ref">GCash reference number</Label>
                    <Input
                      id="gcash-ref"
                      placeholder="e.g. 1234567890123"
                      value={paymentRef}
                      maxLength={128}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Send ₱{openSession.price_php} to our GCash and enter the reference
                      number. Admin will verify before the session.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Cancellation closes {openSession.cancel_cutoff_hours} hours before the session starts (Philippine time).
                {started ? " This session has already started." : openSession.my_status && !canCancel ? " Contact the venue for changes to this registration." : ""}
              </p>

              {myRosterRow && (
                <div className="text-sm">
                  {myRosterRow.status === "cancelled" ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                      <X className="h-3.5 w-3.5" /> Cancelled
                    </span>
                  ) : myRosterRow.checked_in_at ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Checked in · {format(parseISO(myRosterRow.checked_in_at), "MMM d, p")}
                    </span>
                  ) : ["registered", "waitlisted"].includes(myRosterRow.status) ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Not checked in yet
                    </span>
                  ) : null}
                </div>
              )}

              {myRosterRow &&
                (myRosterRow.payment_status === "completed" &&
                ["registered", "checked_in"].includes(myRosterRow.status) ? (
                  <Button variant="outline" className="w-full" onClick={() => setQrOpen(true)}>
                    <QrCode className="h-4 w-4 mr-2" />
                    {myRosterRow.checked_in_at ? "View QR (checked in)" : "Show check-in QR"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {myRosterRow.status === "waitlisted"
                      ? "You'll get a check-in QR code once you move off the waitlist and your payment is approved."
                      : "Your check-in QR code unlocks once the admin approves your payment."}
                  </p>
                ))}

              <DialogFooter>
                {openSession.my_status ? (
                  <Button
                    variant="destructive"
                    onClick={() => myRosterRow && handleCancel(myRosterRow.registration_id)}
                    disabled={cancel.isPending || !myRosterRow || !canCancel || !!rosterError || !!error}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel Registration
                  </Button>
                ) : (
                  <Button onClick={handleRegister} disabled={register.isPending || started || !!error || !!rosterError || rosterLoading}>
                    {openSession.registered_count >= openSession.max_players
                      ? "Join Waitlist"
                      : `Register${openSession.price_php > 0 ? ` — ₱${openSession.price_php}` : ""}`}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <QRCodeDialog
        open={qrOpen && !!openSession}
        onOpenChange={setQrOpen}
        kind="open_play"
        id={myRosterRow?.registration_id}
        title={openSession?.title || "Open Play"}
        subtitle={
          openSession
            ? `${format(parseISO(openSession.session_date), "EEE, MMM d")} · ${openSession.start_time} – ${openSession.end_time}`
            : undefined
        }
        referenceCode={myRosterRow?.payment_reference}
        checkedInAt={myRosterRow?.checked_in_at}
      />

      <Footer />
    </div>
  );
};

export default OpenPlay;
