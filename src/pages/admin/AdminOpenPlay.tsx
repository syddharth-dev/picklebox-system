import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, X, Check, UserX, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAllCourts } from "@/hooks/useCourts";
import { useToast } from "@/hooks/use-toast";
import { openPlayErrorMessage, validateOpenPlaySession, venueDate } from "@/lib/openPlay";
import {
  useAdminOpenPlaySessions,
  useCreateOpenPlaySession,
  useCancelOpenPlaySession,
  useOpenPlayRoster,
  useAdminUpdateRegistration,
  type OpenPlaySkill,
} from "@/hooks/useOpenPlay";

const SKILLS: OpenPlaySkill[] = ["all", "2.5-3.0", "3.5", "4.0+"];

const AdminOpenPlay = () => {
  const { data: sessions, isLoading, error, refetch } = useAdminOpenPlaySessions();
  const { data: courts, error: courtsError, refetch: refetchCourts } = useAllCourts();
  const createSession = useCreateOpenPlaySession();
  const cancelSession = useCancelOpenPlaySession();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    session_date: "",
    start_time: "18:00",
    end_time: "20:00",
    court_ids: [] as string[],
    skill: "all" as OpenPlaySkill,
    max_players: 16,
    price_php: 150,
    cancel_cutoff_hours: 2,
    title: "",
    notes: "",
  });

  const courtNameMap = useMemo(() => {
    const m = new Map<string, string>();
    courts?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [courts]);

  const submit = async () => {
    const validation = validateOpenPlaySession(form);
    if (validation) {
      toast({ title: "Check session details", description: validation, variant: "destructive" });
      return;
    }
    try {
      await createSession.mutateAsync(form);
      toast({ title: "Session created" });
      setOpen(false);
      setForm({ ...form, session_date: "", court_ids: [], title: "", notes: "" });
    } catch (e: unknown) {
      toast({ title: "Session creation failed", description: openPlayErrorMessage(e), variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Open Play</h1>
            <p className="text-muted-foreground">
              Schedule drop-in sessions and manage rosters
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Open Play Session</DialogTitle>
                <DialogDescription>All session times use Philippine time.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="session-title">Title (optional)</Label>
                  <Input
                    id="session-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Friday Night Open Play"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label htmlFor="session-date">Date</Label>
                    <Input
                      id="session-date"
                      type="date"
                      min={venueDate()}
                      required
                      value={form.session_date}
                      onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="session-start">Start</Label>
                    <Input
                      id="session-start"
                      type="time"
                      required
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="session-end">End</Label>
                    <Input
                      id="session-end"
                      type="time"
                      required
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Courts</Label>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {courtsError ? (
                      <div role="alert">Could not load courts. <Button type="button" variant="link" onClick={() => void refetchCourts()}>Try again</Button></div>
                    ) : courts?.filter((court) => court.is_active).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.court_ids.includes(c.id)}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              court_ids: v
                                ? [...form.court_ids, c.id]
                                : form.court_ids.filter((id) => id !== c.id),
                            })
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Skill</Label>
                    <Select
                      value={form.skill}
                      onValueChange={(v) => setForm({ ...form, skill: v as OpenPlaySkill })}
                    >
                      <SelectTrigger aria-label="Skill level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILLS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="session-capacity">Max Players</Label>
                    <Input
                      id="session-capacity"
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={form.max_players}
                      onChange={(e) =>
                        setForm({ ...form, max_players: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="session-price">Price (₱)</Label>
                    <Input
                      id="session-price"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={form.price_php}
                      onChange={(e) =>
                        setForm({ ...form, price_php: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="session-cutoff">Cancellation cutoff (hours before start)</Label>
                  <Input id="session-cutoff" type="number" min={0} step={1} required value={form.cancel_cutoff_hours}
                    onChange={(event) => setForm({ ...form, cancel_cutoff_hours: Number(event.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="session-notes">Notes (optional)</Label>
                  <Textarea
                    id="session-notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createSession.isPending || !!courtsError}>
                  Create
                </Button>
              </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 p-6">
            Could not load Open Play sessions.
            <Button variant="outline" className="ml-3" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (sessions ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No sessions yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <Accordion type="multiple">
                {sessions!.map((s) => (
                  <AccordionItem key={s.id} value={s.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex-1 flex items-center justify-between pr-4">
                        <div className="text-left">
                          <p className="font-medium text-foreground">
                            {s.title || "Open Play"}{" "}
                            <span className="text-muted-foreground text-sm font-normal">
                              · {format(parseISO(s.session_date), "MMM d")} ·{" "}
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.court_ids
                              .map((id: string) => courtNameMap.get(id) ?? "Court")
                              .join(", ")}{" "}
                            · Max {s.max_players} · ₱{s.price_php} · {s.skill}
                          </p>
                        </div>
                        <Badge variant={s.status === "cancelled" ? "destructive" : "outline"}>
                          {s.status}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <SessionRoster
                        sessionId={s.id}
                        isCancelling={cancelSession.isPending}
                        onCancelSession={async () => {
                          await cancelSession.mutateAsync(s.id);
                          toast({ title: "Session cancelled" });
                        }}
                        canCancel={s.status === "scheduled"}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

function SessionRoster({
  sessionId,
  onCancelSession,
  canCancel,
  isCancelling,
}: {
  sessionId: string;
  onCancelSession: () => Promise<void>;
  canCancel: boolean;
  isCancelling: boolean;
}) {
  const { data: roster, isLoading, error, refetch } = useOpenPlayRoster(sessionId);
  const update = useAdminUpdateRegistration();
  const { toast } = useToast();

  const act = async (
    args: Parameters<typeof update.mutateAsync>[0]
  ) => {
    try {
      await update.mutateAsync(args);
      toast({ title: "Updated" });
    } catch (e: unknown) {
      toast({ title: "Update failed", description: openPlayErrorMessage(e), variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground p-2">Loading roster...</p>;
  if (error) return <div role="alert">Could not load the roster. <Button variant="link" onClick={() => void refetch()}>Try again</Button></div>;
  const list = roster ?? [];

  return (
    <div className="space-y-3 p-2">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No registrations yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <div
              key={r.registration_id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{r.full_name || "Player"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.status === "waitlisted"
                    ? `Waitlist #${r.waitlist_position}`
                    : r.status.replace("_", " ")}
                  {" · "}Payment: {r.payment_status}
                  {r.payment_reference ? ` · ${r.payment_reference}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {canCancel && r.payment_status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() =>
                      act({
                        registrationId: r.registration_id,
                        paymentStatus: "completed",
                      })
                    }
                  >
                    <Check className="h-4 w-4 mr-1" /> Verify
                  </Button>
                )}
                {canCancel && r.status === "registered" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending || r.payment_status !== "completed"}
                    title={r.payment_status !== "completed" ? "Verify payment before check-in" : undefined}
                    onClick={() =>
                      act({
                        registrationId: r.registration_id,
                        status: "checked_in",
                      })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Check in
                  </Button>
                )}
                {canCancel && (r.status === "registered" || r.status === "waitlisted") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={update.isPending}
                    aria-label={`Mark ${r.full_name || "player"} as no-show`}
                    onClick={() =>
                      act({
                        registrationId: r.registration_id,
                        status: "no_show",
                      })
                    }
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {canCancel && (
        <Button size="sm" variant="destructive" disabled={isCancelling} onClick={async () => {
          try { await onCancelSession(); }
          catch (error: unknown) { toast({ title: "Session cancellation failed", description: openPlayErrorMessage(error), variant: "destructive" }); }
        }}>
          <X className="h-4 w-4 mr-1" /> Cancel Session
        </Button>
      )}
    </div>
  );
}

export default AdminOpenPlay;
