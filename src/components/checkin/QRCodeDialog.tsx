import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { QrKind, useMyQrToken, checkinErrorMessage } from "@/hooks/useCheckIn";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: QrKind;
  id: string | undefined;
  title: string;
  subtitle?: string;
  referenceCode?: string | null;
  checkedInAt?: string | null;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  kind,
  id,
  title,
  subtitle,
  referenceCode,
  checkedInAt,
}: QRCodeDialogProps) {
  const { data: token, isLoading, isFetching, error } = useMyQrToken(kind, id, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check-in QR code</DialogTitle>
          <DialogDescription>
            Show this at the court so staff can verify your {kind === "booking" ? "booking" : "spot"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {(isLoading || isFetching) && <Skeleton className="h-56 w-56 rounded-xl" />}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <span>{checkinErrorMessage(error)}</span>
            </div>
          )}

          {token && !error && !isFetching && (
            <>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <QRCodeSVG value={token} size={208} level="M" marginSize={0} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{title}</p>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                {referenceCode && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Ref: {referenceCode}
                  </p>
                )}
              </div>
              {checkedInAt ? (
                <Badge className="bg-muted text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Already checked in
                </Badge>
              ) : (
                <Badge variant="outline">Valid — not yet checked in</Badge>
              )}
              <p className="text-center text-xs text-muted-foreground break-all">
                Code: <span className="font-mono">{token}</span> — staff can type this if
                scanning fails.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
