import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Supabase origin for connect-src (HTTP + WebSocket for realtime/auth).
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://frmukrgjkhlpxplhzeqj.supabase.co";
const supabaseWs = supabaseUrl.replace(/^https/, "wss");

// Content-Security-Policy.
// - no 'unsafe-eval' in production. Dev adds it for React Fast Refresh/HMR only.
// - script-src/style-src need 'unsafe-inline': Next.js App Router injects inline
//   bootstrap/RSC scripts (no nonce without per-request middleware), and Tailwind
//   + Recharts emit inline styles. Documented & accepted (SEC-1).
const csp = [
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
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "browsing-topics=()",
      "payment=()",
      "usb=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
