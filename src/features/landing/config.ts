/**
 * Landing page settings from public env vars (inlined at build time).
 * Unset values hide the matching links.
 */
function slugFromEnv(): string | null {
  const slug = process.env.NEXT_PUBLIC_DEMO_SHOP_SLUG?.trim()
  return slug ? slug : null
}

/** Path of the demo shop (a normal shop created through sign-up), or null. */
export const demoShopPath: string | null = slugFromEnv() ? `/${slugFromEnv()}` : null

export const contactEmail: string | null = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null

/** E.164 number, e.g. +243812345678. */
export const contactWhatsapp: string | null = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.trim() || null
