declare namespace Deno {
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Promise<Response>): void;
}
declare module "https://esm.sh/@supabase/supabase-js@2.93.3" {
  const createClient: typeof import("@supabase/supabase-js").createClient;
  export { createClient };
}
