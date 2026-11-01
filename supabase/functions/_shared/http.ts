// Shared boundaries for authenticated JSON endpoints. CORS is not authentication.
export const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return {
    ...responseHeaders,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...(origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

export function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean).includes(origin);
}

export async function readBoundedJson(source: Request | Response, maxBytes: number, timeoutMs = 5000): Promise<unknown> {
  const declared = Number(source.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "Request too large");
  if (!source.body) throw new HttpError(400, "Invalid JSON");
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HttpError(408, "Body read timed out")), timeoutMs);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request too large");
      }
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { clearTimeout(timer!); reader.releaseLock(); }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(result)); }
  catch { throw new HttpError(400, "Invalid JSON"); }
}
