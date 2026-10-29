import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUserBookings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name, description)")
        .eq("user_id", user.id)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useBooking(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name, description, price_per_hour), payments(*)")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });
}

export function useBookedSlots(courtId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ["booked-slots", courtId, date],
    queryFn: async () => {
      if (!courtId || !date) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("court_id", courtId)
        .eq("booking_date", date)
        .in("status", ["pending", "paid"]);
      if (error) throw error;
      return data;
    },
    enabled: !!courtId && !!date,
  });
}

export function useBookedSlotsAllCourts(date: string | undefined) {
  return useQuery({
    queryKey: ["booked-slots-all", date],
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase.rpc("get_reserved_slots", { p_date: date });
      if (error) throw error;
      return (data || []).map((s) => {
        const [h, m] = String(s.start_time).split(":").map(Number);
        const end = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        return {
          court_id: s.court_id,
          start_time: s.start_time,
          end_time: end,
          status: s.status as "pending" | "paid",
          is_admin_block: Boolean(s.is_admin_block),
          admin_note: (s.admin_note ?? null) as string | null,
        };
      }) as Array<{
        court_id: string;
        start_time: string;
        end_time: string;
        status: "pending" | "paid";
        is_admin_block: boolean;
        admin_note: string | null;
      }>;
    },
    enabled: !!date,
  });
}

export function useBookingsByIds(ids: string[] | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings-by-ids", ids?.join(",")],
    queryFn: async () => {
      if (!ids?.length || !user) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name, description, price_per_hour), payments(*)")
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!ids?.length && !!user,
  });
}
