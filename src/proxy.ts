import { NextResponse, type NextRequest } from "next/server"
import { buildCsp, convexOrigins } from "./lib/security-headers"

/**
 * Sets the Content-Security-Policy with a fresh nonce per request
 * (CLAUDE.md "Security & ownership"). Next.js reads the nonce from the
 * request's CSP header and adds it to its own scripts. Headers only:
 * route protection stays client-side (AuthGate), the real boundary is
 * Convex. The other security headers are static (next.config.ts).
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    origins: convexOrigins(process.env),
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  matcher: [
    {
      // Pages only: not build assets, optimised images or files with an extension.
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
      // Router prefetches don't render a document.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
