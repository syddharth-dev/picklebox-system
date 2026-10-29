import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invalidateOpenPlayQueries } from "@/hooks/useOpenPlay";

export type QrKind = "booking" | "open_play";

export interface CheckinLookup {
  kind: QrKind;
  id: string;
  player_name: string;
  title: string;
  reference_code: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  payment_ok: boolean;
  status: string;
  checked_in_at: string | null;
}

/** Fetches the caller's own QR token. The RPC only returns it when payment is settled. */
export function useMyQrToken(kind: QrKind, id: string | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["qr-token", kind, id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_qr_token", {
        p_kind: kind,
        p_id: id!,
      });
      if (error) throw error;
      return data as string;
    },
    enabled: !!id && !!user && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useLookupCheckin() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("lookup_checkin", { p_token: token });
      if (error) throw error;
      return data as unknown as CheckinLookup;
    },
  });
}

export function usePerformCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("perform_checkin", { p_token: token });
      if (error) throw error;
      return data as unknown as { already: boolean; checked_in_at: string; kind: QrKind };
    },
    onSuccess: () => {
      return Promise.all([
        invalidateOpenPlayQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "today", "bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "attendance", "bookings"] }),
      ]);
    },
  });
}

/** Maps Postgres error messages from the check-in RPCs to friendly copy. */
export function checkinErrorMessage(error: unknown): string {
  const raw = (error as { message?: string })?.message ?? "";
  if (raw.includes("QR_NOT_FOUND")) return "Unknown QR code — nothing matches this pass.";
  if (raw.includes("PAYMENT_NOT_APPROVED")) return "Payment is not approved yet.";
  if (raw.includes("REGISTRATION_NOT_ACTIVE")) return "This registration is no longer active.";
  if (raw.includes("SESSION_NOT_OPEN")) return "This Open Play session has been cancelled or closed.";
  if (raw.includes("QR_NOT_AVAILABLE")) return "QR code unlocks once your payment is approved.";
  if (raw.includes("ADMIN_REQUIRED")) return "Admin access required.";
  if (raw.includes("AUTHENTICATION_REQUIRED")) return "Please sign in again.";
  return raw || "Something went wrong.";
}
