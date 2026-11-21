import type { Category } from "../catalog";
import type { Currency } from "../money";
import { promoLiveAt } from "../looks/schedule";
import { discountedPrice, percentOff } from "./discount";
import type { SaleDiscount, SaleDisplay, SaleTarget } from "./validators";

/**
 * Which sale applies to a product and what it costs (CLAUDE.md "Sales").
 * Pure. Queries never read the clock: whether a sale is live is stored on
 * the row (`sales.live`, kept by `saleJobs.sync` at its start and end) and
 * the server passes only live sales here; `saleLiveAt` is the rule that
 * flag follows.
 */

export type SaleLike = {
  _id: string;
  name: string;
  discount: SaleDiscount;
  target: SaleTarget;
  startsAt: number;
  endsAt: number;
  paused: boolean;
  /** Server rows: missing; client copies: null. */
  adminPause?: { at: number; reason: string } | null;
  display: SaleDisplay;
};

export type ProductLike = { _id: string; price: number; category: Category };

/** Whether a sale covers a product (exclusions included). */
export function saleAppliesTo(target: SaleTarget, product: Pick<ProductLike, "_id" | "category">): boolean {
  switch (target.kind) {
    case "products":
      return (target.productIds as readonly string[]).includes(product._id);
    case "category":
      return target.category === product.category && !(target.excludedIds as readonly string[]).includes(product._id);
    case "shop":
      return !(target.excludedIds as readonly string[]).includes(product._id);
  }
}

export function isPaused(sale: Pick<SaleLike, "paused" | "adminPause">): boolean {
  return sale.paused || (sale.adminPause !== undefined && sale.adminPause !== null);
}

/** In its dates and not paused (by the seller or an admin). */
export function saleLiveAt(sale: Pick<SaleLike, "startsAt" | "endsAt" | "paused" | "adminPause">, now: number): boolean {
  return !isPaused(sale) && promoLiveAt(sale, now);
}

export type SaleStatus = "scheduled" | "running" | "paused" | "ended";
export const SALE_STATUSES = ["running", "scheduled", "paused", "ended"] as const satisfies readonly SaleStatus[];

/** For lists and badges. An ended sale is "ended" even if it was paused. */
export function saleStatusAt(sale: Pick<SaleLike, "startsAt" | "endsAt" | "paused" | "adminPause">, now: number): SaleStatus {
  if (now >= sale.endsAt) return "ended";
  if (isPaused(sale)) return "paused";
  return now < sale.startsAt ? "scheduled" : "running";
}

export type AppliedSale = {
  saleId: string;
  /** What the customer pays. */
  price: number;
  /** The product's real normal price (the crossed-out one). */
  original: number;
  percent: number;
  endsAt: number;
  display: SaleDisplay;
};

/**
 * The best price for the customer among the given (live) sales: the
 * lowest sale price wins; on a tie, the sale ending first (its countdown
 * is the honest one), then the lowest id. Null when no sale lowers it.
 */
export function bestSaleFor(
  product: ProductLike,
  sales: readonly SaleLike[],
  currency: Currency,
): AppliedSale | null {
  let best: AppliedSale | null = null;
  for (const sale of sales) {
    if (!saleAppliesTo(sale.target, product)) continue;
    const price = discountedPrice(product.price, sale.discount, currency);
    if (price === null) continue;
    const better =
      best === null ||
      price < best.price ||
      (price === best.price && (sale.endsAt < best.endsAt || (sale.endsAt === best.endsAt && sale._id < best.saleId)));
    if (better) {
      best = {
        saleId: sale._id,
        price,
        original: product.price,
        percent: percentOff(product.price, price),
        endsAt: sale.endsAt,
        display: sale.display,
      };
    }
  }
  return best;
}

/**
 * A product's live sale as visitors get it (CLAUDE.md "Sales"): what they
 * pay, the real normal price (crossed out) and what to show. Null = no
 * sale. Public queries, previews and the demo all use this shape.
 */
export function publicSale(applied: AppliedSale | null) {
  if (!applied) return null;
  return {
    price: applied.price,
    original: applied.original,
    percent: applied.percent,
    endsAt: applied.endsAt,
    countdown: applied.display.countdown,
    badge: applied.display.badge,
    label: applied.display.label,
  };
}
export type PublicSale = NonNullable<ReturnType<typeof publicSale>>;

/** Products a sale lowers, with their sale price (for previews and counts). */
export function affectedProducts<P extends ProductLike>(
  sale: Pick<SaleLike, "discount" | "target">,
  products: readonly P[],
  currency: Currency,
): { product: P; price: number }[] {
  const out: { product: P; price: number }[] = [];
  for (const product of products) {
    if (!saleAppliesTo(sale.target, product)) continue;
    const price = discountedPrice(product.price, sale.discount, currency);
    if (price !== null) out.push({ product, price });
  }
  return out;
}

/**
 * Other sales running at the same time as `sale` on at least one of the
 * same products (the customer gets the best price; the seller is told).
 */
export function overlappingSales<S extends SaleLike>(
  sale: Pick<SaleLike, "discount" | "target" | "startsAt" | "endsAt"> & { _id?: string },
  others: readonly S[],
  products: readonly ProductLike[],
  currency: Currency,
): { sale: S; products: number }[] {
  const mine = affectedProducts(sale, products, currency).map((a) => a.product);
  if (mine.length === 0) return [];
  const out: { sale: S; products: number }[] = [];
  for (const other of others) {
    if (other._id === sale._id) continue;
    if (!(other.startsAt < sale.endsAt && sale.startsAt < other.endsAt)) continue;
    const shared = affectedProducts(other, mine, currency).length;
    if (shared > 0) out.push({ sale: other, products: shared });
  }
  return out;
}
