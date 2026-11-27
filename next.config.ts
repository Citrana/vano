import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { staticSecurityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Don't advertise the framework (no "X-Powered-By: Next.js").
  poweredByHeader: false,
  /**
   * Security headers on every response (CLAUDE.md "Security & ownership"):
   * nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options and, in
   * production, HSTS. What each one protects is in src/lib/security-headers.ts.
   * The Content-Security-Policy needs a nonce per request, so src/proxy.ts sets it.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders({ isProd: process.env.NODE_ENV === "production" }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
