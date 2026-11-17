import { waDigits } from "../../convex/lib/phone"

/** Chat with a number, prefilled: https://wa.me/243812345678?text=… */
export function waChatLink(e164: string, text: string): string {
  return `https://wa.me/${waDigits(e164)}?text=${encodeURIComponent(text)}`
}

/** Share to any chat (the user picks the contact): https://wa.me/?text=… */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

type OrderT = (
  key: "orderGreeting" | "orderProduct" | "orderPrice" | "orderSize" | "orderColor" | "orderLink",
  values?: Record<string, string>,
) => string

/**
 * The prefilled order message, in the shop's language (pass a translator
 * for the `Public` namespace in that language).
 */
export function buildOrderMessage(
  t: OrderT,
  order: { product: string; price: string; url: string; size?: string; color?: string },
): string {
  return [
    t("orderGreeting"),
    t("orderProduct", { name: order.product }),
    t("orderPrice", { price: order.price }),
    order.size ? t("orderSize", { size: order.size }) : null,
    order.color ? t("orderColor", { color: order.color }) : null,
    t("orderLink", { url: order.url }),
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}
