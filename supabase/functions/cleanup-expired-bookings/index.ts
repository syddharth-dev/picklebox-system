import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = claimsData.claims.sub as string;
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
      console.error("Error cancelling expired bookings:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process expired bookings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cancelledCount = data?.length || 0;
    console.log(`Cancelled ${cancelledCount} expired bookings`);

    return new Response(
      JSON.stringify({ cancelled: cancelledCount, bookings: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
