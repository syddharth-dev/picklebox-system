import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

import { corsHeaders, isAllowedBrowserOrigin, readBoundedJson, HttpError } from "../_shared/http.ts";

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
- Payment: choose court hours, send payment with the venue's GCash QR, and enter the transaction reference. Staff manually verify payment.
- Court bookings remain pending with reserved time slots during staff verification. There is no automatic 30-minute expiry in the current booking flow.
- A check-in QR pass becomes available after payment approval. It is found in My bookings, or in the registered Open Play session.
- Pending court bookings can be cancelled from My bookings. Open Play cancellation deadlines are shown on each session.
- The Help page at /help explains bookings and payments and links to directions. No verified phone number or support email is configured; do not invent either.
- Court rates, available hours, Open Play fees, capacity and skill levels must be checked on the Courts and Open Play pages. Do not invent prices, opening hours, or availability, and do not claim access to a player's private bookings or account.
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
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
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

    const payload = await readBoundedJson(req, 65536);
    const messages = typeof payload === "object" && payload !== null && "messages" in payload ? payload.messages : null;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20
      || !messages.every((message: unknown) => typeof message === "object" && message !== null
        && "role" in message && (message.role === "user" || message.role === "assistant")
        && "content" in message && typeof message.content === "string"
        && message.content.trim().length > 0 && message.content.length <= 2000)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (messages.reduce((total, m) => total + m.content.length, 0) > 12000) {
      throw new HttpError(400, "Conversation too long");
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        max_tokens: 512,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m: { role: "user" | "assistant"; content: string }) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content ?? "").slice(0, 2000),
          })),
        ],
      }),
    });

    if (!resp.ok) {
      await resp.body?.cancel();
      console.error("AI gateway failure", resp.status);
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

    const data = await readBoundedJson(resp, 65536) as { choices?: { message?: { content?: unknown } }[] };
    const content = data?.choices?.[0]?.message?.content;
    const reply = typeof content === "string" ? content.slice(0, 8000) : "Sorry, I couldn't generate a reply.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("faq-chat request failed");
    return new Response(JSON.stringify({ error: err instanceof HttpError ? err.message : "Internal server error" }), {
      status: err instanceof HttpError ? err.status : 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
