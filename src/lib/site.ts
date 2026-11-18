/** Absolute site origin for share links and OG metadata. */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost:3000"
}

export function shopUrl(slug: string): string {
  return `${siteUrl()}/${slug}`
}

/**
 * The shop link as shown on screen: `vano.app/shop-name` on a real domain,
 * the full local address in development. Copy and share use `shopUrl`.
 */
export function displayShopUrl(slug: string, origin: string = siteUrl()): string {
  const url = `${origin.replace(/\/+$/, "")}/${slug}`
  let host: string
  try {
    host = new URL(origin).hostname
  } catch {
    return url
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local")
  if (local) return url
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "")
}

export function productUrl(slug: string, productId: string): string {
  return `${siteUrl()}/${slug}/${productId}`
}
