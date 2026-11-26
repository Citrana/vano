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
  key:
    | "orderGreeting"
    | "orderProduct"
    | "orderPrice"
    | "orderSalePrice"
    | "orderSaleNote"
    | "orderCode"
    | "orderCodePrice"
    | "orderSize"
    | "orderColor"
    | "orderLink"
    | "orderRef",
  values?: Record<string, string>,
) => string

type OrderLines = {
  product: string
  /** What the customer pays (sale or code price when there is one). */
  price: string
  url: string
  size?: string
  color?: string
  /** The real normal price, when a sale or a code lowers it. */
  normalPrice?: string
  /** The discount code applied (CLAUDE.md "Discount codes"). */
  code?: string
  /** The seller's product code ("CLO-001"), so they know which item it is. */
  productCode?: string | null
}

/**
 * The prefilled order message, in the shop's language (pass a translator
 * for the `Public` namespace in that language). On sale, it states the
 * sale price, the normal price and a "Sale" note; with a discount code,
 * the code, the price with it and the normal price, so the price agreed
 * is clear later (CLAUDE.md "Sales", "Discount codes").
 */
export function buildOrderMessage(t: OrderT, order: OrderLines): string {
  const priceLines =
    order.code && order.normalPrice
      ? [t("orderCode", { code: order.code }), t("orderCodePrice", { price: order.price, normal: order.normalPrice })]
      : order.normalPrice
        ? [t("orderSalePrice", { price: order.price, normal: order.normalPrice }), t("orderSaleNote")]
        : [t("orderPrice", { price: order.price })]
  return [
    t("orderGreeting"),
    t("orderProduct", { name: order.product }),
    order.productCode ? t("orderRef", { code: order.productCode }) : null,
    ...priceLines,
    order.size ? t("orderSize", { size: order.size }) : null,
    order.color ? t("orderColor", { color: order.color }) : null,
    t("orderLink", { url: order.url }),
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

/**
 * The "Order on WhatsApp" link for a product, used by the product page and
 * the product cards (one message builder). On sale it carries the sale
 * price and the normal one; with a code, the code and both prices. `demo` (marketing demo shop) or no number:
 * a share link with the demo note, for any contact.
 */
export function orderHref(
  t: OrderT,
  order: OrderLines & {
    whatsappNumber?: string
    demo?: boolean
    demoNote: string
  },
): string {
  const message = buildOrderMessage(t, order)
  return order.demo || !order.whatsappNumber ? waShareLink(`${order.demoNote}\n\n${message}`) : waChatLink(order.whatsappNumber, message)
}
