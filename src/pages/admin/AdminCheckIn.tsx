import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminPagination } from "@/hooks/useAdminPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Loader2,
} from "lucide-react";
import {
  CheckinLookup,
  checkinErrorMessage,
  useLookupCheckin,
  usePerformCheckin,
} from "@/hooks/useCheckIn";

const SCANNER_ID = "checkin-scanner";

interface RecentEntry {
  name: string;
  title: string;
  at: string;
}

const AdminCheckIn = () => {
  const { toast } = useToast();
  const lookup = useLookupCheckin();
  const perform = usePerformCheckin();

  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<CheckinLookup | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const recentPagination = useAdminPagination(recent, String(recent.length));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Keep the last scanned/typed token so Confirm uses exactly what was looked up.
  const lastTokenRef = useRef<string | null>(null);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* scanner already stopped */
      }
    }
  };

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const handleToken = async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    lastTokenRef.current = trimmed;
    setErrorMsg(null);
    setResult(null);
    try {
      const data = await lookup.mutateAsync(trimmed);
      setResult(data);
    } catch (err) {
      setErrorMsg(checkinErrorMessage(err));
    }
  };

  const startScanner = async () => {
    setErrorMsg(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await stopScanner();
          await handleToken(decoded);
        },
        () => {
          /* ignore per-frame decode misses */
        }
      );
    } catch (err) {
      await stopScanner();
      setErrorMsg(
        "Camera unavailable — allow camera access or enter the code manually. " +
          ((err as Error)?.message ?? "")
      );
    }
  };

  const confirmCheckIn = async () => {
    if (!result) return;
    try {
      const res = await perform.mutateAsync(lastTokenRef.current ?? "");
      if (res.already) {
        toast({
          title: "Already checked in",
          description: `${result.player_name} arrived at ${format(new Date(res.checked_in_at), "p")}`,
        });
      } else {
        toast({ title: "Checked in", description: `${result.player_name} is good to play.` });
        setRecent((prev) => [
          { name: result.player_name, title: result.title, at: res.checked_in_at },
          ...prev,
        ]);
      }
      setResult({ ...result, checked_in_at: res.checked_in_at });
    } catch (err) {
      setErrorMsg(checkinErrorMessage(err));
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleToken(manualCode);
  };

  const isToday = result ? result.event_date === format(new Date(), "yyyy-MM-dd") : false;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Check-In</h1>
          <p className="text-muted-foreground">
            Scan a player's QR pass to verify their booking or Open Play spot.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4" /> Scanner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                id={SCANNER_ID}
                className="w-full overflow-hidden rounded-xl bg-muted/40 aspect-square flex items-center justify-center"
              >
                {!scanning && (
                  <p className="text-sm text-muted-foreground">Camera is off</p>
                )}
              </div>

              {scanning ? (
                <Button variant="outline" className="w-full" onClick={() => void stopScanner()}>
                  <CameraOff className="h-4 w-4 mr-2" /> Stop camera
                </Button>
              ) : (
                <Button className="w-full" onClick={() => void startScanner()}>
                  <Camera className="h-4 w-4 mr-2" /> Start camera
                </Button>
              )}

              <form onSubmit={submitManual} className="space-y-2">
                <Label htmlFor="manual-code">Or enter the code manually</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-code"
                    value={manualCode}
                    maxLength={64}
                    placeholder="Paste the code shown under the QR"
                    onChange={(e) => setManualCode(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={lookup.isPending}>
                    {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                    <span className="text-foreground">{errorMsg}</span>
                  </div>
                )}

                {!result && !errorMsg && (
                  <p className="text-sm text-muted-foreground">
                    Nothing scanned yet.
                  </p>
                )}

                {result && (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {result.player_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {result.kind === "booking" ? "Court booking" : "Open Play"} ·{" "}
                          {result.title}
                        </p>
                      </div>
                      <Badge variant={result.payment_ok ? "default" : "destructive"}>
                        {result.payment_ok ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-3 text-sm">
                      <p className="text-foreground">
                        {format(new Date(result.event_date), "EEE, MMM d, yyyy")}
                      </p>
                      <p className="text-muted-foreground">
                        {result.start_time} – {result.end_time}
                      </p>
                      {result.reference_code && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Ref: {result.reference_code}
                        </p>
                      )}
                    </div>

                    {!isToday && (
                      <p className="text-sm text-accent-foreground">
                        Heads up: this pass is not for today.
                      </p>
                    )}

                    {result.checked_in_at ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Checked in at {format(new Date(result.checked_in_at), "PPp")}
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={!result.payment_ok || perform.isPending}
                        onClick={() => void confirmCheckIn()}
                      >
                        {perform.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Confirm Check-In
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No check-ins this session.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentPagination.rows.map((r, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{r.name}</span>
                        <span className="text-muted-foreground">
                          {r.title} · {format(new Date(r.at), "p")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <AdminPagination label="Recent check-ins" pagination={recentPagination} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCheckIn;
