import type { NextConfig } from "next";

// The Content-Security-Policy is built per-request in proxy.ts (middleware) so that
// `upgrade-insecure-requests` is sent ONLY over https. On http://localhost that directive
// upgrades Next's same-origin RSC `fetch`es to https://localhost — which the http dev
// server can't answer → ERR_SSL_PROTOCOL_ERROR. Real prod is https, where the directive
// (and its protection) is preserved. The headers below are scheme-independent.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
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
