import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Lock, CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useCourts } from "@/hooks/useCourts";
import { useBookedSlotsAllCourts } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TIME_SLOTS = [
  { label: "7AM–8AM", start: "07:00:00", display: "7:00 AM" },
  { label: "8AM–9AM", start: "08:00:00", display: "8:00 AM" },
  { label: "9AM–10AM", start: "09:00:00", display: "9:00 AM" },
  { label: "10AM–11AM", start: "10:00:00", display: "10:00 AM" },
  { label: "11AM–12PM", start: "11:00:00", display: "11:00 AM" },
  { label: "12PM–1PM", start: "12:00:00", display: "12:00 PM" },
  { label: "1PM–2PM", start: "13:00:00", display: "1:00 PM" },
  { label: "2PM–3PM", start: "14:00:00", display: "2:00 PM" },
  { label: "3PM–4PM", start: "15:00:00", display: "3:00 PM" },
  { label: "4PM–5PM", start: "16:00:00", display: "4:00 PM" },
  { label: "5PM–6PM", start: "17:00:00", display: "5:00 PM" },
  { label: "6PM–7PM", start: "18:00:00", display: "6:00 PM" },
  { label: "7PM–8PM", start: "19:00:00", display: "7:00 PM" },
  { label: "8PM–9PM", start: "20:00:00", display: "8:00 PM" },
  { label: "9PM–10PM", start: "21:00:00", display: "9:00 PM" },
  { label: "10PM–11PM", start: "22:00:00", display: "10:00 PM" },
];

// slotKey = `${courtId}::${slotStart}`
const makeKey = (courtId: string, slotStart: string) => `${courtId}::${slotStart}`;

const Courts = () => {
  const { data: courts, isLoading } = useCourts();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<null | { mode: "add" | "remove" }>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: bookedRows } = useBookedSlotsAllCourts(dateStr);

  // Reset selection when date changes
  useEffect(() => {
    setSelected(new Set());
  }, [dateStr]);

  // Live availability: subscribe to booking_slots changes for the current date
  // (booking_slots is visible to all authenticated users; bookings is not).
  useEffect(() => {
    const channel = supabase
      .channel(`booking-slots-${dateStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_slots",
          filter: `booking_date=eq.${dateStr}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["booked-slots-all", dateStr] });

          const row: any = payload.new || payload.old;
          if (!row) return;
          // Only react when a slot became reserved (or was deleted)
          const nowReserved = payload.eventType !== "DELETE" && row.is_reserved === true;
          if (!nowReserved && payload.eventType !== "DELETE") return;

          setSelected((prev) => {
            const next = new Set(prev);
            let removed = 0;
            prev.forEach((k) => {
              const [courtId, slotStart] = k.split("::");
              if (courtId === row.court_id && slotStart === row.start_time) {
                next.delete(k);
                removed++;
              }
            });
            if (removed > 0) {
              toast({
                title: "A slot you selected was just booked",
                description: `${removed} slot${removed > 1 ? "s were" : " was"} removed from your selection.`,
                variant: "destructive",
              });
            }
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `booking_date=eq.${dateStr}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["booked-slots-all", dateStr] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateStr, queryClient, toast]);


  // Map of courtId -> [(start, end, status)] for booked ranges
  const bookedByCourt = useMemo(() => {
    const map = new Map<string, Map<string, { status: "pending" | "paid"; isAdmin: boolean }>>();
    (bookedRows || []).forEach((b) => {
      if (!map.has(b.court_id)) map.set(b.court_id, new Map());
      map.get(b.court_id)!.set(b.start_time, { status: b.status, isAdmin: b.is_admin_block });
    });
    return map;
  }, [bookedRows]);

  const getBookedStatus = (courtId: string, slotStart: string) =>
    bookedByCourt.get(courtId)?.get(slotStart) ?? null;

  const isBooked = (courtId: string, slotStart: string) => getBookedStatus(courtId, slotStart) !== null;

  // End drag on pointer release anywhere
  useEffect(() => {
    const stop = () => setDragging(null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const toggleCell = (key: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handlePointerDown = (courtId: string, slotStart: string, e: React.PointerEvent) => {
    if (isBooked(courtId, slotStart)) return;
    const key = makeKey(courtId, slotStart);
    const mode: "add" | "remove" = selected.has(key) ? "remove" : "add";
    setDragging({ mode });
    toggleCell(key, mode);
    // capture so pointerenter still fires on siblings
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handlePointerEnter = (courtId: string, slotStart: string) => {
    if (!dragging) return;
    if (isBooked(courtId, slotStart)) return;
    toggleCell(makeKey(courtId, slotStart), dragging.mode);
  };

  // Build selections grouped by court for summary + checkout
  const selections = useMemo(() => {
    if (!courts) return [];
    const byCourt = new Map<string, string[]>();
    selected.forEach((k) => {
      const [courtId, slotStart] = k.split("::");
      if (!byCourt.has(courtId)) byCourt.set(courtId, []);
      byCourt.get(courtId)!.push(slotStart);
    });
    return Array.from(byCourt.entries())
      .map(([courtId, slots]) => {
        const court = courts.find((c) => c.id === courtId);
        if (!court) return null;
        return {
          courtId,
          courtName: court.name,
          pricePerHour: Number(court.price_per_hour),
          slots: slots.sort(),
        };
      })
      .filter(Boolean) as Array<{ courtId: string; courtName: string; pricePerHour: number; slots: string[] }>;
  }, [selected, courts]);

  const totalHours = selections.reduce((s, sel) => s + sel.slots.length, 0);
  const totalPrice = selections.reduce((s, sel) => s + sel.slots.length * sel.pricePerHour, 0);

  const handleProceed = () => {
    if (!user) {
      toast({ title: "Please sign in", description: "You need an account to book courts." });
      navigate("/auth");
      return;
    }
    if (selections.length === 0) return;
    navigate("/checkout", {
      state: {
        date: selectedDate.toISOString(),
        selections,
        totalPrice,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-32">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Book a Court
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Select time slots — click or drag to select multiple slots across courts.
            </p>
          </div>

          {/* Date picker + legend */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(selectedDate, "EEEE, MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                  disabled={(d) => d < startOfDay(new Date()) || d > addDays(new Date(), 60)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:ml-auto">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-border bg-background" />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-primary" />
                Selected
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-muted" />
                Reserved (pending)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-destructive/30" />
                Booked (paid)
              </div>
            </div>
          </div>

          {/* Grid */}
          {isLoading || !courts ? (
            <Skeleton className="h-[600px] w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden select-none">
              {/* Header row */}
              <div
                className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                style={{ gridTemplateColumns: `88px repeat(${courts.length}, minmax(0, 1fr))` }}
              >
                <div className="p-3">Time</div>
                {courts.map((court) => (
                  <div key={court.id} className="p-3 border-l border-border">
                    <div className="text-foreground text-sm normal-case tracking-normal">{court.name}</div>
                    <div className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                      ₱{court.price_per_hour}/hr
                    </div>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {TIME_SLOTS.map((slot) => (
                <div
                  key={slot.start}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `88px repeat(${courts.length}, minmax(0, 1fr))` }}
                >
                  <div className="p-3 text-xs font-medium text-muted-foreground flex items-center bg-muted/20">
                    {slot.label}
                  </div>
                  {courts.map((court) => {
                    const info = getBookedStatus(court.id, slot.start);
                    const booked = info !== null;
                    const isAdminBlock = info?.isAdmin === true;
                    const isPaid = info?.status === "paid";
                    const key = makeKey(court.id, slot.start);
                    const isSelected = selected.has(key);
                    return (
                      <button
                        key={court.id}
                        type="button"
                        disabled={booked}
                        onPointerDown={(e) => handlePointerDown(court.id, slot.start, e)}
                        onPointerEnter={() => handlePointerEnter(court.id, slot.start)}
                        className={cn(
                          "border-l border-border h-14 md:h-16 transition-colors text-xs font-medium touch-none",
                          booked && isAdminBlock && "bg-accent/50 cursor-not-allowed text-foreground",
                          booked && !isAdminBlock && !isPaid && "bg-muted/60 cursor-not-allowed text-muted-foreground",
                          booked && !isAdminBlock && isPaid && "bg-destructive/15 cursor-not-allowed text-destructive",
                          !booked && !isSelected && "bg-background hover:bg-primary/10 cursor-pointer",
                          !booked && isSelected && "bg-primary text-primary-foreground shadow-inner"
                        )}
                      >
                        {booked ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            {isAdminBlock ? "Admin Reserved" : isPaid ? "Booked" : "Reserved"}
                          </span>
                        ) : isSelected ? (
                          <span>✓</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Sticky checkout bar */}
      {selections.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md shadow-lg animate-slide-up">
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {totalHours} {totalHours === 1 ? "slot" : "slots"} · {selections.length} {selections.length === 1 ? "court" : "courts"}
                </span>
                <span className="text-lg font-bold text-primary">₱{totalPrice}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {selections.map((s) => `${s.courtName} (${s.slots.length}h)`).join(" · ")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button variant="hero" size="lg" onClick={handleProceed}>
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Checkout
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Courts;
