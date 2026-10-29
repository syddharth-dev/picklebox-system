import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) return baseCorsHeaders;
  return { ...baseCorsHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .includes(origin);
}

const SYSTEM_PROMPT = `You are "PickleBot", the friendly FAQ assistant for **The Pickle Box** — a pickleball court booking website located at Endrina St., San Carlos City, Negros Occidental, Philippines.

You ONLY answer questions related to The Pickle Box website and its services, including:
- Booking courts (availability, dates, times, how to reserve)
- Court information, pricing, and amenities
- GCash payment process (manual verification by admins)
- Account/profile management, sign-up, login
- Cancellations, refunds, booking status (pending / paid / confirmed)
- Location, contact, and operating hours
- Pickleball basics *only* if directly tied to using our courts

Key facts you can share:
- Location: Endrina St., San Carlos City, Negros Occidental
- Contact: hello@picklecourt.ph  |  +63 912 345 6789
- Payment: GCash — upload proof after booking; admin manually verifies
- Bookings must be paid within 30 minutes or the reservation is released
- Users can view bookings under "My Bookings" once signed in

STRICT RULE — Off-topic guard:
If the user's question is NOT related to The Pickle Box, its website, bookings, courts, payments, or pickleball-at-our-venue, you MUST refuse politely with EXACTLY this response (do not answer the question):

"⚠️ Sorry, I can only answer questions about **The Pickle Box** — our courts, bookings, payments, and account help. Please ask me something related to our website. 🎾"

Do not answer general knowledge, coding, math, other businesses, personal advice, or anything unrelated — always use the refusal above.

Keep answers concise, warm, and use markdown (bold, bullet lists) when helpful.`;

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
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: quotaAllowed, error: quotaError } = await userClient.rpc("consume_faq_chat_quota");
    if (quotaError || !quotaAllowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), {
        status: 429,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-20).map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content ?? "").slice(0, 2000),
          })),
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Gateway error:", resp.status, text);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact the site owner." }), {
          status: 402,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("faq-chat error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
