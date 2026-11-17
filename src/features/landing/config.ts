import { normalizeWhatsapp } from "../../../convex/lib/phone"
import { waChatLink } from "../../lib/whatsapp"

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

export type Contact = { kind: "email"; href: string; label: string } | { kind: "whatsapp"; href: string }

/**
 * NEXT_PUBLIC_CONTACT is one value: an email address, or a WhatsApp number
 * in international format (+243…). Anything else hides the contact link.
 */
export function parseContact(raw: string | undefined): Contact | null {
  const value = raw?.trim()
  if (!value) return null
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { kind: "email", href: `mailto:${value}`, label: value } : null
  }
  const e164 = normalizeWhatsapp(value)
  return e164 ? { kind: "whatsapp", href: waChatLink(e164, "") } : null
}

export const contact: Contact | null = parseContact(process.env.NEXT_PUBLIC_CONTACT)
