import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that an unauthenticated visitor is allowed to reach. */
const AUTH_ROUTES = ["/login", "/accept-invite", "/forgot-password"];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function isPublic(pathname: string) {
  // "/" landing, the auth pages, and the /auth/* confirm+signout handlers.
  return pathname === "/" || pathname.startsWith("/auth") || isAuthRoute(pathname);
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
  if (user && (isAuthRoute(pathname) || pathname === "/")) {
    return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
