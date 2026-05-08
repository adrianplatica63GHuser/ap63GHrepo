/**
 * Next.js middleware — authentication gate.
 *
 * Every request passes through here. The middleware:
 *   1. Refreshes the Supabase session token (keeps cookies fresh).
 *   2. Redirects unauthenticated users to /login for any protected route.
 *   3. Redirects authenticated users away from /login and /signup to /.
 *
 * Public routes (no login required): /login, /signup, plus Next.js internals.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Routes that do not require authentication.
// Covers both pages and API routes that must be reachable when logged out.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth", // /api/auth/signup-request, /api/auth/lookup-email, /api/auth/me, …
];

// Page routes where an already-authenticated user should be bounced to home.
// Intentionally does NOT include API routes — those must always pass through.
const AUTH_PAGE_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Build a Supabase client that can read + refresh the session from cookies.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Write updated cookies back to both the request and the response
          // so the refreshed token propagates correctly.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do NOT run any logic between createServerClient and getUser()
  // that could invalidate the session-refresh flow above.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAuthPagePath = AUTH_PAGE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // Unauthenticated → redirect to /login (except for public paths)
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated + on a login/signup PAGE → redirect to home.
  // API routes under /api/auth are deliberately excluded: the sidebar's
  // /api/auth/me fetch must reach the route handler, not get redirected.
  if (user && isAuthPagePath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
