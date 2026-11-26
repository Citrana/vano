/**
 * The one badge a product card shows (CLAUDE.md "Shop looks"), in order:
 * Sold out, then the sale (the "-30%" badge, else the "Sale" label, as
 * the seller chose), then New (NEW_BADGE_DAYS), then the section's own
 * label, then Few left, then Thrift (the product's condition; "Brand
 * new" isn't shown on cards, it would read like the New badge). Pure, so
 * the order is tested.
 */
export type CardBadge =
  | { kind: "soldOut" }
  | { kind: "salePercent"; percent: number }
  | { kind: "saleLabel" }
  | { kind: "new" }
  | { kind: "highlight"; label: string }
  | { kind: "fewLeft" }
  | { kind: "thrift" }

export function cardBadge(card: {
  soldOut: boolean
  sale: { percent: number; badge: boolean; label: boolean } | null | undefined
  isNew: boolean
  highlight: string | null
  fewLeft: boolean
  condition?: "new" | "thrift" | null
}): CardBadge | null {
  if (card.soldOut) return { kind: "soldOut" }
  if (card.sale?.badge) return { kind: "salePercent", percent: card.sale.percent }
  if (card.sale?.label) return { kind: "saleLabel" }
  if (card.isNew) return { kind: "new" }
  if (card.highlight) return { kind: "highlight", label: card.highlight }
  if (card.fewLeft) return { kind: "fewLeft" }
  if (card.condition === "thrift") return { kind: "thrift" }
  return null
}
