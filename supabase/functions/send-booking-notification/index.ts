import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) return baseCorsHeaders;
  return { ...baseCorsHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).includes(origin);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]!));
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return isAllowedBrowserOrigin(req)
      ? new Response(null, { headers })
      : new Response(null, { status: 403 });
  }
  if (req.method !== "POST" || !isAllowedBrowserOrigin(req)) {
    return new Response(JSON.stringify({ error: "Method or origin not allowed" }), {
      status: req.method === "POST" ? 403 : 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const callerId = claimsData.claims.sub as string;

    const { bookingId, type } = await req.json();

    if (!bookingId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing bookingId or type" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (!["confirmation", "cancellation"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid notification type" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch booking details with court info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, courts(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Authorize: caller must own the booking or be an admin
    if (booking.user_id !== callerId) {
      const { data: adminRole, error: adminRoleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRoleError || !adminRole) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      booking.user_id
    );

    if (userError || !userData?.user?.email) {
      console.error("User not found:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const email = userData.user.email;
    const courtName = escapeHtml((booking as any).courts?.name || "Court");
    const refCode = escapeHtml(booking.reference_code || "N/A");

    // Build email content
    let subject: string;
    let body: string;

    if (type === "confirmation") {
      subject = `Booking Confirmed - ${refCode}`;
      body = `
        <h2>Booking Confirmed! 🎉</h2>
        <p>Your court reservation has been successfully created.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Reference:</td><td style="padding: 8px;">${refCode}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Court:</td><td style="padding: 8px;">${courtName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${booking.booking_date}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${booking.start_time} - ${booking.end_time}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">₱${booking.total_amount}</td></tr>
        </table>
        <p>Please complete payment within 30 minutes to secure your reservation.</p>
        <p>Thank you for booking with The Pickle Box!</p>
      `;
    } else {
      subject = `Booking Cancelled - ${refCode}`;
      body = `
        <h2>Booking Cancelled</h2>
        <p>Your court reservation has been cancelled.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Reference:</td><td style="padding: 8px;">${refCode}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Court:</td><td style="padding: 8px;">${courtName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${booking.booking_date}</td></tr>
        </table>
        <p>If this was a mistake, you can create a new booking at any time.</p>
        <p>Thank you, The Pickle Box Team</p>
      `;
    }

    console.log(`Email notification [${type}] to ${email}: ${subject}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${type} notification prepared`,
        note: "To send real emails, add RESEND_API_KEY secret and configure Resend"
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
