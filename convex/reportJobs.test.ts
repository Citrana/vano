import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { as, newTest, productArgs, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const DAY = 86_400_000;

async function shopWithSale(t: T, opts: { email: string; slug: string; zone: string; soldAt: number; plan?: "business" | "pro" }) {
  const { userId, shopId } = await sellerWithShop(t, opts.email, { slug: opts.slug });
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: Date.UTC(2027, 0, 1) });
  const me = as(t, userId);
  const bag = await me.mutation(api.products.create, await productArgs(t, { sizes: [], colors: [] }));
  await me.mutation(api.salesRecords.record, {
    productId: bag,
    quantity: 1,
    finalUnitPrice: 2500,
    source: "whatsapp",
    soldAt: opts.soldAt,
    timeZone: opts.zone,
  });
  if (opts.plan === "pro") await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: Date.UTC(2027, 0, 1) });
  return { userId, shopId, me };
}

/** The seller's report notifications (other types, e.g. about the plan, are left out). */
const inbox = async (t: T, me: ReturnType<typeof as>) =>
  (await me.query(api.notifications.inbox.latest, {})).filter((n) => n.data.type === "report.ready");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("monthly report notification", () => {
  test("on the shop's own 1st, once, linking last month", async () => {
    const t = newTest();
    vi.setSystemTime(Date.UTC(2026, 10, 15, 12));
    const kinshasa = await shopWithSale(t, { email: "a@shop.cd", slug: "chez-amani", zone: "Africa/Kinshasa", soldAt: Date.UTC(2026, 10, 10) });
    const losAngeles = await shopWithSale(t, { email: "n@shop.us", slug: "la-shop", zone: "America/Los_Angeles", soldAt: Date.UTC(2026, 10, 10) });

    // 1 Dec 06:00 UTC: 07:00 on the 1st in Kinshasa, still 22:00 on 30 Nov in Los Angeles.
    vi.setSystemTime(Date.UTC(2026, 11, 1, 6));
    await t.mutation(internal.reportJobs.monthly, {});
    const sent = await inbox(t, kinshasa.me);
    expect(sent.map((n) => n.data)).toEqual([{ type: "report.ready", month: "2026-11" }]);
    expect(await inbox(t, losAngeles.me)).toEqual([]);

    // A rerun the same day sends nothing new; the next day reaches Los Angeles.
    await t.mutation(internal.reportJobs.monthly, {});
    expect(await inbox(t, kinshasa.me)).toHaveLength(1);
    vi.setSystemTime(Date.UTC(2026, 11, 2, 6));
    await t.mutation(internal.reportJobs.monthly, {});
    expect((await inbox(t, losAngeles.me)).map((n) => n.data)).toEqual([{ type: "report.ready", month: "2026-11" }]);
  });

  test("not without the plan or without confirmed sales", async () => {
    const t = newTest();
    vi.setSystemTime(Date.UTC(2026, 10, 15, 12));
    const pro = await shopWithSale(t, { email: "p@shop.cd", slug: "pro-shop", zone: "UTC", soldAt: Date.UTC(2026, 10, 10), plan: "pro" });
    const quiet = await shopWithSale(t, { email: "q@shop.cd", slug: "quiet-shop", zone: "UTC", soldAt: Date.UTC(2026, 9, 10) });
    vi.setSystemTime(Date.UTC(2026, 11, 1, 6));
    await t.mutation(internal.reportJobs.monthly, {});
    expect(await inbox(t, pro.me)).toEqual([]);
    expect(await inbox(t, quiet.me)).toEqual([]);
    expect(DAY).toBeGreaterThan(0);
  });
});
