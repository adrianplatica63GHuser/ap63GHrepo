/**
 * Server-side Supabase clients.
 *
 * createServerClient() — uses the anon key + cookies for the current request.
 *   Use this in Server Components, Route Handlers, and Server Actions to read
 *   the session of the logged-in user.
 *
 * createAdminClient() — uses the service-role key (bypasses RLS).
 *   Use this ONLY in Route Handlers for admin operations:
 *   creating users, listing auth.users, etc.
 *   NEVER import in Client Components or expose to the browser.
 */
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient as _createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Components where cookies cannot be
            // mutated. The middleware handles token refresh, so this is safe
            // to ignore here.
          }
        },
      },
    },
  );
}

export function createAdminClient() {
  return _createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
