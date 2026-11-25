import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { avatarOverflow, cornerBox, decorationBox, decorationEntry, PROFILE_DECORATION_IDS, PROFILE_SHAPES, PROFILE_SIZES } from "./lib/looks/profile";
import { as, newTest, productArgs, sellerWithShop, setSubscription } from "./lib/test.utils";

/**
 * The public shop page polish (CLAUDE.md "Shop looks"): live card prices,
 * and the room left for profile decorations.
 */

const NOW = Date.UTC(2026, 10, 22, 12);
const DAY = 86_400_000;

describe("public.shopPrices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("visible products with their live sale price, nothing else", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    const dress = await me.mutation(api.products.create, await productArgs(t, { name: "Robe", price: 2500 }));
    const hidden = await me.mutation(api.products.create, await productArgs(t, { name: "Cachée", price: 900 }));
    await t.run((ctx) => ctx.db.patch("products", hidden, { hidden: true }));

    expect(await t.query(api.public.shopPrices, { slug: "chez-amani" })).toEqual([{ _id: dress, price: 2500, soldOut: false, sale: null }]);

    await me.mutation(api.sales.create, {
      name: "Black Friday",
      discount: { kind: "percent", value: 30 },
      target: { kind: "shop", excludedIds: [] as Id<"products">[] },
      endsAt: NOW + 2 * DAY,
      display: { countdown: true, badge: true, label: true },
      steepConfirmed: false,
    });
    const [row] = (await t.query(api.public.shopPrices, { slug: "chez-amani" }))!;
    expect(row).toMatchObject({ _id: dress, price: 2500, sale: { price: 1750, original: 2500 } });
    expect(JSON.stringify(row)).not.toContain(userId);

    // Without the plan feature, no sale price (same rule as the page).
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    expect((await t.query(api.public.shopPrices, { slug: "chez-amani" }))![0].sale).toBeNull();
  });

  test("null for an unknown or suspended shop", async () => {
    const t = newTest();
    const { shopId } = await sellerWithShop(t);
    expect(await t.query(api.public.shopPrices, { slug: "nope" })).toBeNull();
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    expect(await t.query(api.public.shopPrices, { slug: "chez-amani" })).toBeNull();
  });
});

describe("card text", () => {
  test("up to 4 colours and sizes, the count of the rest and createdAt; never the description", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const long = "Belle robe en wax. ".repeat(30);
    await as(t, userId).mutation(api.products.create, {
      ...(await productArgs(t)),
      description: long,
      colors: ["Rouge", "Bleu", "Vert", "Noir", "Blanc", "Or"],
      sizes: ["S", "M", "L", "XL", "XXL"],
    });
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    if (!page || page.suspended) throw new Error("no page");
    const [card] = page.products;
    // Every colour and size (the shop's filters); the card shows the first CARD_TAGS_MAX.
    expect(card.colors).toEqual(["Rouge", "Bleu", "Vert", "Noir", "Blanc", "Or"]);
    expect(card.sizes).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(card).not.toHaveProperty("moreColors");
    expect(typeof card.createdAt).toBe("number");
    expect(card).not.toHaveProperty("description");
    expect(JSON.stringify(page.products)).not.toContain("Belle robe");
    expect(JSON.stringify(page)).not.toContain(userId);
  });
});

describe("avatarOverflow", () => {
  test("none for a plain photo; glow reaches a little on every side", () => {
    expect(avatarOverflow({ shape: "circle", size: "md", decoration: null, corner: "none" })).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    const glow = avatarOverflow({ shape: "circle", size: "md", decoration: null, corner: "none", glow: true });
    expect(Math.min(glow.left, glow.top, glow.right, glow.bottom)).toBeGreaterThan(0);
  });

  test("covers every decoration and corner, for every shape and size, and is never negative", () => {
    for (const shape of PROFILE_SHAPES) {
      for (const size of PROFILE_SIZES) {
        for (const decoration of [null, ...PROFILE_DECORATION_IDS]) {
          const ov = avatarOverflow({ shape, size, decoration, corner: "star" });
          for (const v of Object.values(ov)) expect(v).toBeGreaterThanOrEqual(0);
          const boxes = [cornerBox(shape, size, decoration), ...(decoration ? [decorationBox(decorationEntry(decoration), shape, size)] : [])];
          for (const box of boxes) {
            // The unrotated box is inside the room (rotation only adds to it).
            const slack = box.rotate ? Math.max(box.w, box.h) : 0.001;
            expect(box.x, `${shape} ${size} ${decoration}`).toBeGreaterThanOrEqual(-ov.left - slack);
            expect(box.y).toBeGreaterThanOrEqual(-ov.top - slack);
            expect(box.x + box.w).toBeLessThanOrEqual(100 + ov.right + slack);
            expect(box.y + box.h).toBeLessThanOrEqual(100 + ov.bottom + slack);
          }
        }
      }
    }
  });

  test("a sticker at the bottom-left needs room on the left (the overflow in the screenshot)", () => {
    expect(avatarOverflow({ shape: "arch", size: "md", decoration: "saleSticker", corner: "none" }).left).toBeGreaterThan(0);
  });
});
