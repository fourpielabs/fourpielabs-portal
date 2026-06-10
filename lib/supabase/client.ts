import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (browser). Anon key + session cookies,
 * so Postgres RLS applies. Used for interactive bits like the client checklist
 * toggle (toggle_checklist_item RPC).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
