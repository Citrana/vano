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

export function productUrl(slug: string, productId: string): string {
  return `${siteUrl()}/${slug}/${productId}`
}
