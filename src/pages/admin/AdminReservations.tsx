import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Lock, Ban, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useCourts } from "@/hooks/useCourts";
import { useBookedSlotsAllCourts } from "@/hooks/useBookings";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const TIME_SLOTS = [
  "07:00:00", "08:00:00", "09:00:00", "10:00:00", "11:00:00", "12:00:00",
  "13:00:00", "14:00:00", "15:00:00", "16:00:00", "17:00:00", "18:00:00",
  "19:00:00", "20:00:00", "21:00:00",
];

const slotLabel = (start: string) => {
  const h = Number(start.slice(0, 2));
  const fmt = (n: number) => `${((n + 11) % 12) + 1}${n >= 12 ? "PM" : "AM"}`;
  return `${fmt(h)}–${fmt((h + 1) % 24)}`;
};

const makeKey = (courtId: string, slotStart: string) => `${courtId}::${slotStart}`;

const AdminReservations = () => {
  const { data: courts } = useCourts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: bookedRows } = useBookedSlotsAllCourts(dateStr);

  useEffect(() => {
    setSelected(new Set());
  }, [dateStr]);

  const { data: blocks } = useQuery({
    queryKey: ["admin", "court-blocks", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, court_id, start_time, end_time, admin_note, status, courts(name)")
        .eq("booking_date", dateStr)
        .eq("is_admin_block", true)
        .in("status", ["pending", "paid"])
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const slotInfo = useMemo(() => {
    const map = new Map<string, { status: "pending" | "paid"; isAdmin: boolean }>();
    (bookedRows || []).forEach((b) => {
      map.set(makeKey(b.court_id, b.start_time), {
        status: b.status,
        isAdmin: Boolean(b.is_admin_block),
      });
    });
    return map;
  }, [bookedRows]);

  const createBlocks = useMutation({
    mutationFn: async () => {
      const byCourt = new Map<string, string[]>();
      selected.forEach((k) => {
        const [courtId, slot] = k.split("::");
        if (!byCourt.has(courtId)) byCourt.set(courtId, []);
        byCourt.get(courtId)!.push(slot);
      });
      for (const [courtId, slots] of byCourt) {
        const { error } = await supabase.rpc("admin_create_court_block", {
          p_court_id: courtId,
          p_booking_date: dateStr,
          p_slot_start_times: slots.sort(),
          p_note: note,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["booked-slots-all", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["admin", "court-blocks", dateStr] });
      toast({ title: "Court time reserved" });
    },
    onError: (e: any) => toast({ title: "Could not reserve", description: e.message, variant: "destructive" }),
  });

  const releaseBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_release_court_block", { p_booking_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booked-slots-all", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["admin", "court-blocks", dateStr] });
      toast({ title: "Reservation released" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggle = (courtId: string, slot: string) => {
    if (slotInfo.has(makeKey(courtId, slot))) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const key = makeKey(courtId, slot);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Court Reservations</h1>
          <p className="text-muted-foreground">Hold court time for events, maintenance or walk-ins</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start w-full sm:w-auto">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(selectedDate, "EEEE, MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                  disabled={(d) => d < startOfDay(new Date()) || d > addDays(new Date(), 90)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2 flex-1">
            <Label htmlFor="note">Reason (optional)</Label>
            <Input
              id="note"
              placeholder="e.g. Tournament, maintenance, walk-in"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {courts && (
          <div className="rounded-xl border border-border bg-card overflow-hidden select-none">
            <div
              className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              style={{ gridTemplateColumns: `96px repeat(${courts.length}, minmax(0, 1fr))` }}
            >
              <div className="p-3">Time</div>
              {courts.map((c) => (
                <div key={c.id} className="p-3 border-l border-border text-foreground text-sm normal-case tracking-normal">
                  {c.name}
                </div>
              ))}
            </div>
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot}
                className="grid border-b border-border last:border-b-0"
                style={{ gridTemplateColumns: `96px repeat(${courts.length}, minmax(0, 1fr))` }}
              >
                <div className="p-3 text-xs font-medium text-muted-foreground flex items-center bg-muted/20">
                  {slotLabel(slot)}
                </div>
                {courts.map((court) => {
                  const info = slotInfo.get(makeKey(court.id, slot));
                  const key = makeKey(court.id, slot);
                  const isSelected = selected.has(key);
                  return (
                    <button
                      key={court.id}
                      type="button"
                      disabled={!!info}
                      onClick={() => toggle(court.id, slot)}
                      className={cn(
                        "border-l border-border h-12 md:h-14 text-xs font-medium transition-colors",
                        info?.isAdmin && "bg-accent/40 text-foreground cursor-not-allowed",
                        info && !info.isAdmin && "bg-muted/60 text-muted-foreground cursor-not-allowed",
                        !info && !isSelected && "bg-background hover:bg-primary/10 cursor-pointer",
                        !info && isSelected && "bg-primary text-primary-foreground"
                      )}
                    >
                      {info ? (
                        <span className="inline-flex items-center gap-1">
                          {info.isAdmin ? <Ban className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {info.isAdmin ? "Admin" : info.status === "paid" ? "Booked" : "Reserved"}
                        </span>
                      ) : isSelected ? (
                        "✓"
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selected.size} slot{selected.size > 1 ? "s" : ""} selected
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button onClick={() => createBlocks.mutate()} disabled={createBlocks.isPending}>
              {createBlocks.isPending ? "Reserving..." : "Reserve selected"}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin reservations on {format(selectedDate, "MMM d, yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!blocks?.length && (
              <p className="text-sm text-muted-foreground">No admin reservations for this date.</p>
            )}
            {blocks?.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">
                    {b.courts?.name} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{b.admin_note || "No reason given"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Admin</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => releaseBlock.mutate(b.id)}
                    disabled={releaseBlock.isPending}
                  >
                    Release
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReservations;
