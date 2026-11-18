import type { ProtectedField } from "../../../convex/lib/changeRequests"
import { formatWhatsapp } from "../../../convex/lib/phone"
import { displayShopUrl } from "@/lib/site"

/** How a protected value reads on screen: the short link, a spaced phone number. */
export function displayValue(field: ProtectedField, value: string): string {
  if (field === "slug") return displayShopUrl(value)
  if (field === "whatsapp") return formatWhatsapp(value)
  return value
}
