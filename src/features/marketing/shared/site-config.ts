import { normalizeWhatsapp } from "../../../../convex/lib/phone"
import { waChatLink } from "../../../lib/whatsapp"

/**
 * Marketing site contact settings, from public env vars (inlined at build
 * time). Unset or invalid values hide the matching links.
 *   NEXT_PUBLIC_CONTACT_WHATSAPP  WhatsApp number, international format (+254…)
 *   NEXT_PUBLIC_CONTACT_EMAIL     support email address
 */
export function parseWhatsapp(raw: string | undefined): string | null {
  const value = raw?.trim()
  return value ? normalizeWhatsapp(value) : null
}

export function parseEmail(raw: string | undefined): string | null {
  const value = raw?.trim()
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null
}

/** E.164, e.g. +254712345678, or null. */
export const contactWhatsapp: string | null = parseWhatsapp(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP)

export const contactEmail: string | null = parseEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL)

/** wa.me link to Vano's WhatsApp with a prefilled message, or null when unset. */
export function whatsappHref(message = ""): string | null {
  return contactWhatsapp ? waChatLink(contactWhatsapp, message) : null
}
