import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

import { corsHeaders, isAllowedBrowserOrigin, readBoundedJson, HttpError } from "../_shared/http.ts";

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
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }


    const payload = await readBoundedJson(req, 2048);
    const { bookingId, type } = (payload && typeof payload === "object" ? payload : {}) as { bookingId?: unknown; type?: unknown };

    if (typeof bookingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId) || typeof type !== "string" || !type) {
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

    const { data: allowed, error: quotaError } = await userClient.rpc("consume_user_api_quota", { p_bucket: "notification" });
    if (quotaError || !allowed) throw new HttpError(429, "Too many requests");

    // Fetch booking details with court info
    const { data: booking, error: bookingError } = await userClient
      .from("bookings")
      .select("user_id, status, reference_code, booking_date, start_time, end_time, total_amount, courts(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking inaccessible or missing");
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // The user-scoped query applies owner/admin RLS before returning a booking.
    // Missing and inaccessible identifiers have the same response. No service-role
    // client or auth-directory lookup is needed while delivery is unconfigured.
    if ((type === "cancellation" && booking.status !== "cancelled")
      || (type === "confirmation" && booking.status === "cancelled")) {
      return new Response(JSON.stringify({ error: "Notification does not match the booking status" }), {
        status: 409, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const court = Array.isArray(booking.courts) ? booking.courts[0] : booking.courts;
    const courtName = escapeHtml(court?.name || "Court");
    const refCode = escapeHtml(booking.reference_code || "N/A");

    // Build email content
    let subject: string;
    let body: string;

    if (type === "confirmation") {
      subject = `Booking Submitted - ${refCode}`;
      body = `
        <h2>Booking Submitted</h2>
        <p>Your court reservation has been successfully created.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Reference:</td><td style="padding: 8px;">${refCode}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Court:</td><td style="padding: 8px;">${courtName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${booking.booking_date}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${booking.start_time} - ${booking.end_time}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">₱${booking.total_amount}</td></tr>
        </table>
        <p>Check My bookings for the latest payment status. Submitted GCash payments require staff verification before a check-in QR pass becomes available.</p>
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

    // Do not log customer addresses, references or message bodies.
    void subject; void body;

    return new Response(
      JSON.stringify({ 
        success: true,
        emailSent: false,
        message: `${type} notification prepared`,
        note: "To send real emails, add RESEND_API_KEY secret and configure Resend"
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notification request failed");
    return new Response(
      JSON.stringify({ error: err instanceof HttpError ? err.message : "Internal server error" }),
      { status: err instanceof HttpError ? err.status : 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
