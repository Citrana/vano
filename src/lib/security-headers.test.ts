import { describe, expect, it } from "vitest"
import { buildCsp, convexOrigins, staticSecurityHeaders } from "./security-headers"

const CONVEX = "https://happy-otter-123.convex.cloud"

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((d) => d.startsWith(`${name} `))
  if (!found) throw new Error(`missing ${name}`)
  return found.slice(name.length + 1)
}

describe("convexOrigins", () => {
  it("derives the HTTPS, WebSocket and storage origins from the env", () => {
    expect(convexOrigins({ NEXT_PUBLIC_CONVEX_URL: `${CONVEX}/` })).toEqual({
      http: CONVEX,
      ws: "wss://happy-otter-123.convex.cloud",
      storage: CONVEX,
    })
  })

  it("uses CONVEX_STORAGE_ORIGIN for storage when set", () => {
    const origins = convexOrigins({ NEXT_PUBLIC_CONVEX_URL: CONVEX, CONVEX_STORAGE_ORIGIN: "https://files.example.com/x" })
    expect(origins.storage).toBe("https://files.example.com")
  })

  it("leaves out a missing or invalid URL", () => {
    expect(convexOrigins({})).toEqual({ http: null, ws: null, storage: null })
    expect(convexOrigins({ NEXT_PUBLIC_CONVEX_URL: "not a url" }).http).toBeNull()
    expect(convexOrigins({ NEXT_PUBLIC_CONVEX_URL: "javascript:alert(1)" }).http).toBeNull()
  })

  it("maps a local http deployment to ws", () => {
    expect(convexOrigins({ NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210" }).ws).toBe("ws://127.0.0.1:3210")
  })
})

describe("buildCsp", () => {
  const origins = convexOrigins({ NEXT_PUBLIC_CONVEX_URL: CONVEX })
  const prod = buildCsp({ nonce: "abc123", isDev: false, origins })
  const dev = buildCsp({ nonce: "abc123", isDev: true, origins })

  it("allows scripts only by nonce, never inline or eval in production", () => {
    const scripts = directive(prod, "script-src")
    expect(scripts).toContain("'nonce-abc123'")
    expect(scripts).toContain("'strict-dynamic'")
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
  })

  it("adds eval and the hot-reload socket in development only", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'")
    expect(directive(dev, "connect-src").split(" ")).toContain("ws:")
    expect(directive(prod, "connect-src").split(" ")).not.toContain("ws:")
  })

  it("never puts the nonce in style-src (it would disable 'unsafe-inline')", () => {
    expect(directive(prod, "style-src")).toBe("'self' 'unsafe-inline'")
  })

  it("lets the browser reach Convex and its storage", () => {
    expect(directive(prod, "connect-src")).toBe(`'self' ${CONVEX} wss://happy-otter-123.convex.cloud`)
    expect(directive(prod, "img-src")).toBe(`'self' data: blob: ${CONVEX}`)
  })

  it("blocks framing, plugins, base and off-site forms", () => {
    expect(directive(prod, "frame-ancestors")).toBe("'none'")
    expect(directive(prod, "object-src")).toBe("'none'")
    expect(directive(prod, "base-uri")).toBe("'self'")
    expect(directive(prod, "form-action")).toBe("'self'")
    expect(directive(prod, "default-src")).toBe("'self'")
  })

  it("still builds without a Convex URL", () => {
    const csp = buildCsp({ nonce: "n", isDev: false, origins: convexOrigins({}) })
    expect(directive(csp, "connect-src")).toBe("'self'")
  })
})

describe("staticSecurityHeaders", () => {
  const keys = (isProd: boolean) => staticSecurityHeaders({ isProd }).map((h) => h.key)
  const value = (key: string) => staticSecurityHeaders({ isProd: true }).find((h) => h.key === key)?.value

  it("sets HSTS in production only, without preload", () => {
    expect(keys(false)).not.toContain("Strict-Transport-Security")
    expect(value("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains")
  })

  it("sets nosniff, the referrer and permissions policies and frame denial", () => {
    expect(value("X-Content-Type-Options")).toBe("nosniff")
    expect(value("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(value("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()")
    expect(value("X-Frame-Options")).toBe("DENY")
  })
})
