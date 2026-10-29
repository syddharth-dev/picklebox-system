import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { validateOpenPlaySession } from "@/lib/openPlay";

export type OpenPlaySkill = "all" | "2.5-3.0" | "3.5" | "4.0+";
export type OpenPlayRegistrationStatus =
  | "registered"
  | "waitlisted"
  | "cancelled"
  | "checked_in"
  | "no_show";

export interface OpenPlaySessionRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court_ids: string[];
  skill: OpenPlaySkill;
  max_players: number;
  price_php: number;
  cancel_cutoff_hours: number;
  status: string;
  title: string | null;
  notes: string | null;
  registered_count: number;
  waitlist_count: number;
  my_status: OpenPlayRegistrationStatus | null;
  my_waitlist_position: number | null;
}

export interface OpenPlayRosterRow {
  registration_id: string;
  user_id: string;
  status: OpenPlayRegistrationStatus;
  waitlist_position: number | null;
  payment_status: "pending" | "completed" | "failed" | "refunded";
  payment_reference: string | null;
  full_name: string | null;
  registered_at: string;
  checked_in_at: string | null;
}

export function invalidateOpenPlayQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => queryKey.includes("open-play")
      || (queryKey[0] === "admin" && queryKey[1] === "attendance" && queryKey[2] === "session")
      || (queryKey[0] === "qr-token" && queryKey[1] === "open_play")
      || queryKey[0] === "booked-slots-all" || queryKey[0] === "booked-slots",
  });
}

function useOpenPlayUpdates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`open-play-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_play_sessions" },
        () => void invalidateOpenPlayQueries(queryClient)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_play_registrations" },
        () => void invalidateOpenPlayQueries(queryClient)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

export function useOpenPlaySessions() {
  const { user } = useAuth();
  useOpenPlayUpdates();
  return useQuery({
    queryKey: ["open-play", "sessions", user?.id],
    enabled: !!user,
    // RLS intentionally hides other players' registration events.
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_open_play_sessions");
      if (error) throw error;
      return (data ?? []) as unknown as OpenPlaySessionRow[];
    },
  });
}

export function useOpenPlayRoster(sessionId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["open-play", "roster", sessionId, user?.id],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase.rpc("get_open_play_roster", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return (data ?? []) as unknown as OpenPlayRosterRow[];
    },
    enabled: !!sessionId && !!user,
    refetchInterval: 15_000,
  });
}

export function useRegisterOpenPlay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { sessionId: string; paymentReference?: string }) => {
      const { data, error } = await supabase.rpc("register_for_open_play", {
        p_session_id: args.sessionId,
        p_payment_reference: args.paymentReference ?? null,
      });
      if (error) throw error;
      return data as { registration_id: string; status: string; waitlist_position: number | null };
    },
    onSuccess: () => {
      return invalidateOpenPlayQueries(queryClient);
    },
  });
}

export function useCancelOpenPlayRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { data, error } = await supabase.rpc("cancel_open_play_registration", {
        p_registration_id: registrationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      return invalidateOpenPlayQueries(queryClient);
    },
  });
}

export function useMyOpenPlayRegistrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["open-play", "mine", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("open_play_registrations")
        .select("*, open_play_sessions(*)")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useAdminOpenPlaySessions() {
  const { user } = useAuth();
  useOpenPlayUpdates();
  return useQuery({
    queryKey: ["admin", "open-play", "sessions", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_play_sessions")
        .select("*")
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOpenPlaySession() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (session: {
      session_date: string;
      start_time: string;
      end_time: string;
      court_ids: string[];
      skill: OpenPlaySkill;
      max_players: number;
      price_php: number;
      cancel_cutoff_hours: number;
      title?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const validation = validateOpenPlaySession(session);
      if (validation) throw new Error(validation);
      const { data, error } = await supabase
        .from("open_play_sessions")
        .insert({ ...session, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      return invalidateOpenPlayQueries(queryClient);
    },
  });
}

export function useCancelOpenPlaySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from("open_play_sessions")
        .update({ status: "cancelled" })
        .eq("id", sessionId)
        .eq("status", "scheduled")
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("SESSION_NOT_OPEN");
    },
    onSuccess: () => {
      return invalidateOpenPlayQueries(queryClient);
    },
  });
}

export function useAdminUpdateRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      registrationId: string;
      status?: OpenPlayRegistrationStatus;
      paymentStatus?: "pending" | "completed" | "failed" | "refunded";
    }) => {
      const { error } = await supabase.rpc("admin_update_open_play_registration", {
        p_registration_id: args.registrationId,
        p_status: args.status ?? null,
        p_payment_status: args.paymentStatus ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      return invalidateOpenPlayQueries(queryClient);
    },
  });
}
