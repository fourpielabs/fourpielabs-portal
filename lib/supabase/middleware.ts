import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes an unauthenticated visitor is allowed to reach. */
const PUBLIC_ROUTES = ["/login", "/accept-invite", "/forgot-password"];

/**
 * Auth routes an ALREADY-authed user is bounced OFF (back to /dashboard).
 *
 * `/accept-invite` is intentionally NOT here. A recovery/invite link verifies
 * the token and establishes a session BEFORE the set-password form renders, so
 * the user is authed by the time they reach `/accept-invite` — bouncing them was
 * the original "set new password is unreachable" bug. Accepted tradeoff: any
 * authed user can reach `/accept-invite` and set their OWN password (equivalent
 * to the Settings reset path; it only mutates the caller's own session, no
 * cross-user risk). This is intended — not a bug.
 */
const BOUNCE_ROUTES = ["/login", "/forgot-password"];

const matchesRoute = (routes: string[], p: string) =>
  routes.some((r) => p === r || p.startsWith(`${r}/`));

function isPublic(pathname: string) {
  // "/" landing, the /auth/* confirm+signout handlers, and the public auth pages.
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    matchesRoute(PUBLIC_ROUTES, pathname)
  );
}

/**
 * Refresh the Supabase session on every request, then apply coarse auth gating:
 *   - unauthenticated + protected route  -> /login
 *   - authenticated + auth route or "/"  -> /dashboard
 * Fine-grained role enforcement still happens server-side (layouts/guards) and
 * in Postgres RLS; this is the fast edge gate.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  // Do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // carry over any refreshed auth cookies so we don't bounce the session
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  };

  if (!user && !isPublic(pathname)) {
    return redirectTo("/login");
  }
  if (user && (matchesRoute(BOUNCE_ROUTES, pathname) || pathname === "/")) {
    return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
