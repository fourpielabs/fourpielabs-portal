import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const isProd = process.env.NODE_ENV === "production";
// Supabase origin for connect-src (HTTP + WebSocket for realtime/auth).
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://frmukrgjkhlpxplhzeqj.supabase.co";
const supabaseWs = supabaseUrl.replace(/^https/, "wss");

/**
 * Content-Security-Policy, built per-request so `upgrade-insecure-requests` is sent
 * ONLY when the request is served over https.
 *
 * Why scoped: on http (local `next dev` / `next start` on localhost) the directive would
 * upgrade Next's same-origin RSC `fetch`es (e.g. /dashboard?_rsc=…) to https://localhost,
 * which the http dev server can't terminate → `net::ERR_SSL_PROTOCOL_ERROR` on every page.
 * In real production everything is https, so the directive — and its protection against a
 * stray http subresource — is preserved. Not weakened, just scoped.
 *
 * - no 'unsafe-eval' in production; dev adds it for React Fast Refresh/HMR only.
 * - 'unsafe-inline' on script/style: App Router injects inline bootstrap/RSC scripts (no
 *   nonce without per-request rewriting) and Tailwind/Recharts emit inline styles (SEC-1).
 */
function buildCsp(secure: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

// Next.js 16 renamed the "middleware" convention to "proxy".
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  // `x-forwarded-proto` is set to https by the prod proxy (Vercel); absent on localhost.
  const secure =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";
  response.headers.set("Content-Security-Policy", buildCsp(secure));
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico
     * - the PWA manifest (public static asset — must not be auth-gated/redirected)
     * - common static image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
