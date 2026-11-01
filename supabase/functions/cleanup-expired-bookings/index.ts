import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

import { responseHeaders as corsHeaders } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.headers.has("Origin")) return new Response(null, { status: 403, headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: "POST" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate: only allow requests with the service role key (from cron)
    // or from an admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // If the token is the service role key (cron job), allow
    if (token !== supabaseServiceKey) {
      // Otherwise check if it's an admin user
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = userData.user.id;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: adminRole, error: adminRoleError } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRoleError || !adminRole) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Cancel all pending bookings that have expired
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id, reference_code");

    if (error) {
      console.error("Expired-booking update failed");
      return new Response(
        JSON.stringify({ error: "Failed to process expired bookings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cancelledCount = data?.length || 0;
    console.log(`Cancelled ${cancelledCount} expired bookings`);

    return new Response(
      JSON.stringify({ cancelled: cancelledCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cleanup request failed");
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
