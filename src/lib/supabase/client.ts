/**
 * Browser-side Supabase client.
 * Import this in Client Components ("use client") that need to talk to
 * Supabase directly (e.g. calling auth.signInWithPassword).
 *
 * Do NOT import the service-role client here — it must stay server-side only.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
