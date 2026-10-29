import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { venueDate } from "@/lib/openPlay";

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });
}

export function useAdminBookings() {
  return useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name), payments(id, transaction_reference, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profile names for all unique user_ids
      const userIds = [...new Set((data || []).map((b: any) => b.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((b: any) => ({ ...b, profiles: profileMap.get(b.user_id) || null }));
    },
  });
}

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, bookings(reference_code, courts(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export interface TodayOpenPlaySession {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  skill: string;
  max_players: number;
  status: string;
  registered: number;
  waitlisted: number;
  checked_in: number;
}

/** Today's open play sessions with live roster counts. */
export function useTodayOpenPlay() {
  return useQuery({
    queryKey: ["admin", "today", "open-play"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<TodayOpenPlaySession[]> => {
      const today = venueDate();
      const { data: sessions, error } = await supabase
        .from("open_play_sessions")
        .select("*")
        .eq("session_date", today)
        .order("start_time", { ascending: true });
      if (error) throw error;
      const rows = sessions ?? [];
      if (rows.length === 0) return [];
      const { data: regs, error: registrationsError } = await supabase
        .from("open_play_registrations")
        .select("session_id, status, checked_in_at")
        .in("session_id", rows.map((s) => s.id));
      if (registrationsError) throw registrationsError;
      return rows.map((s) => {
        const mine = (regs ?? []).filter((r) => r.session_id === s.id);
        return {
          id: s.id,
          title: s.title,
          start_time: s.start_time,
          end_time: s.end_time,
          skill: s.skill,
          max_players: s.max_players,
          status: s.status,
          registered: mine.filter((r) => r.status === "registered" || r.status === "checked_in").length,
          waitlisted: mine.filter((r) => r.status === "waitlisted").length,
          checked_in: mine.filter((r) => r.status === "checked_in" && !!r.checked_in_at).length,
        };
      });
    },
  });
}

/** Today's court bookings including check-in state and player name. */
export function useTodayBookings() {
  return useQuery({
    queryKey: ["admin", "today", "bookings"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name)")
        .eq("booking_date", today)
        .order("start_time", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((b: any) => b.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] as any[] };
      const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return rows.map((b: any) => ({ ...b, full_name: map.get(b.user_id)?.full_name || "Unknown" }));
    },
  });
}
