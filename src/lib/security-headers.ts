/**
 * Security headers (CLAUDE.md "Security & ownership"). Pure: used by
 * `next.config.ts` (the static headers), `src/proxy.ts` (the CSP, which
 * needs a fresh nonce per request) and the tests. Relative imports only.
 *
 * A new external origin the browser loads (script, image, fetch /
 * websocket) must be added here, or the CSP blocks it.
 */

type Env = Record<string, string | undefined>

export type SecurityOrigins = {
  /** Convex HTTPS origin (queries / mutations over HTTP, uploads). */
  http: string | null
  /** Convex WebSocket origin (live queries). */
  ws: string | null
  /** Where `storage.getUrl()` files are served from (images). */
  storage: string | null
}

function originOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null
  } catch {
    return null
  }
}

/**
 * The Convex origins, from env (never hard-coded): `NEXT_PUBLIC_CONVEX_URL`
 * (e.g. https://x.convex.cloud → wss://x.convex.cloud). Storage files are
 * served from that same origin unless `CONVEX_STORAGE_ORIGIN` says
 * otherwise (e.g. a custom domain). A missing or invalid URL is left out.
 */
export function convexOrigins(env: Env): SecurityOrigins {
  const http = originOf(env.NEXT_PUBLIC_CONVEX_URL)
  const ws = http ? http.replace(/^http/, "ws") : null
  const storage = originOf(env.CONVEX_STORAGE_ORIGIN) ?? http
  return { http, ws, storage }
}

/** Joins sources, dropping empty ones and duplicates. */
function sources(...values: (string | null | false)[]): string {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].join(" ")
}

/**
 * The Content-Security-Policy, with this request's nonce. Next.js reads the
 * nonce from the request's CSP header and adds it to its own scripts, so no
 * inline script runs without it.
 */
export function buildCsp({ nonce, isDev, origins }: { nonce: string; isDev: boolean; origins: SecurityOrigins }): string {
  const directives: [string, string][] = [
    // Anything not listed below: this site only.
    ["default-src", "'self'"],
    // Scripts: only those carrying this request's nonce, and what they load
    // ('strict-dynamic'). No 'unsafe-inline', so injected <script> tags and
    // inline handlers never run. React needs eval in development only.
    ["script-src", sources("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev && "'unsafe-eval'")],
    // Styles: inline style attributes (shop looks) and sonner's injected
    // <style> can't carry a nonce. No nonce here on purpose: browsers ignore
    // 'unsafe-inline' when a nonce is present.
    ["style-src", "'self' 'unsafe-inline'"],
    // Images: our files, generated previews (banner downloads) and Convex storage.
    ["img-src", sources("'self'", "data:", "blob:", origins.storage)],
    // Fonts: self-hosted by next/font.
    ["font-src", "'self' data:"],
    // Network: Convex (HTTP + WebSocket) and storage; dev adds the hot-reload socket.
    ["connect-src", sources("'self'", origins.http, origins.ws, origins.storage, isDev && "ws:")],
    // No plugins (<object>, <embed>).
    ["object-src", "'none'"],
    // An injected <base> tag can't redirect relative URLs elsewhere.
    ["base-uri", "'self'"],
    // Forms can only submit to this site.
    ["form-action", "'self'"],
    // No other site can frame us (clickjacking).
    ["frame-ancestors", "'none'"],
  ]
  return directives.map(([name, value]) => `${name} ${value}`).join("; ")
}

export type Header = { key: string; value: string }

/** Headers that are the same on every response (set in next.config.ts). */
export function staticSecurityHeaders({ isProd }: { isProd: boolean }): Header[] {
  const headers: Header[] = [
    // Browsers never guess a file's type (an upload served as HTML or script).
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Other sites see only our origin, never full paths (e.g. invite links).
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Camera, microphone and location are off for this site and any frame.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // Older browsers' version of frame-ancestors 'none'.
    { key: "X-Frame-Options", value: "DENY" },
  ]
  // HTTPS only, for two years, subdomains included (production only, no
  // "preload" yet: it's hard to undo).
  if (isProd) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" })
  return headers
}
