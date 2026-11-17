import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { AUDIT_ACTIONS } from "../lib/audit";
import { dayStartMs } from "../lib/days";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  type T,
} from "../lib/test.utils";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

afterEach(() => vi.useRealTimers());

const page = { numItems: 50, cursor: null };

async function userId(t: T, email: string): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    (await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique())!._id,
  );
}

/** Real admin actions on three different days (2026-11-01, 02, 03 UTC). */
async function history(t: T) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
  await t.action(internal.seed.superAdmin, { email: "boss@vano.app", password: "password1" });
  const boss = await userId(t, "boss@vano.app");
  const ids = await builtInRoles(t);
  const support = await insertRole(t, "Support", ["users.view", "users.suspend", "audit.view"]);
  const agent = await insertUserWithRole(t, "agent@vano.app", support);
  const { userId: seller } = await sellerWithShop(t, "amani@shop.cd");
  const productId = await as(t, seller).mutation(api.products.create, await productArgs(t, { name: "Robe" }));

  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  await as(t, boss).mutation(api.admin.users.assignRole, { userId: seller, roleId: support });
  await as(t, boss).mutation(api.admin.users.assignRole, { userId: seller, roleId: ids.seller });

  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  await as(t, agent).mutation(api.admin.users.setStatus, { userId: seller, status: "suspended" });
  await as(t, boss).mutation(api.admin.products.setHidden, { productId, hidden: true });
  vi.useRealTimers();
  return { boss, agent, seller, productId };
}

describe("admin.audit.list", () => {
  test("every admin action, newest first, with actor, target and details", async () => {
    const t = newTest();
    const w = await history(t);
    const { page: rows } = await as(t, w.boss).query(api.admin.audit.list, { paginationOpts: page });
    expect(rows.map((r) => r.action)).toEqual([
      "product.hide",
      "user.suspend",
      "user.assignRole",
      "user.assignRole",
      "superAdmin.seed",
    ]);
    expect(rows[0]).toMatchObject({
      actorId: w.boss,
      actorEmail: "boss@vano.app",
      targetType: "product",
      targetId: w.productId,
      targetLabel: "Robe — Chez Amani (/chez-amani)",
      details: null,
    });
    expect(rows[2]).toMatchObject({ details: { from: "Support", to: "Seller" } });
    expect(rows[4]).toMatchObject({ actorId: null, actorEmail: "system", targetLabel: "boss@vano.app" });
  });

  test("filters by person, system, action, and both", async () => {
    const t = newTest();
    const w = await history(t);
    const q = async (args: { actor?: Id<"users"> | "system"; action?: (typeof AUDIT_ACTIONS)[number] }) =>
      (await as(t, w.boss).query(api.admin.audit.list, { paginationOpts: page, ...args })).page.map((r) => r.action);
    expect(await q({ actor: w.agent })).toEqual(["user.suspend"]);
    expect(await q({ actor: "system" })).toEqual(["superAdmin.seed"]);
    expect(await q({ action: "user.assignRole" })).toEqual(["user.assignRole", "user.assignRole"]);
    expect(await q({ actor: w.boss, action: "product.hide" })).toEqual(["product.hide"]);
    expect(await q({ actor: w.agent, action: "product.hide" })).toEqual([]);
  });

  test("filters by date range ([from, to), UTC days)", async () => {
    const t = newTest();
    const w = await history(t);
    const range = async (from: string, toExclusive: string, actor?: Id<"users">) =>
      (
        await as(t, w.boss).query(api.admin.audit.list, {
          paginationOpts: page,
          from: dayStartMs(from),
          to: dayStartMs(toExclusive),
          ...(actor ? { actor } : {}),
        })
      ).page.map((r) => r.action);
    expect(await range("2026-11-02", "2026-11-03")).toEqual(["user.assignRole", "user.assignRole"]);
    expect(await range("2026-11-03", "2026-11-04")).toEqual(["product.hide", "user.suspend"]);
    expect(await range("2026-11-03", "2026-11-04", w.agent)).toEqual(["user.suspend"]);
    expect(await range("2026-11-04", "2026-11-05")).toEqual([]);
  });

  test("paginates", async () => {
    const t = newTest();
    const w = await history(t);
    const first = await as(t, w.boss).query(api.admin.audit.list, { paginationOpts: { numItems: 3, cursor: null } });
    expect(first.page).toHaveLength(3);
    const rest = await as(t, w.boss).query(api.admin.audit.list, {
      paginationOpts: { numItems: 3, cursor: first.continueCursor },
    });
    expect(rest.page.map((r) => r.action)).toEqual(["user.assignRole", "superAdmin.seed"]);
  });

  test("needs audit.view; suspended and signed-out callers are refused", async () => {
    const t = newTest();
    const w = await history(t);
    const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["users.view"]));
    await expect(as(t, viewer).query(api.admin.audit.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    // The agent's Support role includes audit.view.
    expect((await as(t, w.agent).query(api.admin.audit.list, { paginationOpts: page })).page).toHaveLength(5);
    await t.run((ctx) => ctx.db.patch("users", w.agent, { status: "suspended" }));
    await expect(as(t, w.agent).query(api.admin.audit.list, { paginationOpts: page })).rejects.toThrow(
      /ACCOUNT_SUSPENDED/,
    );
    await expect(t.query(api.admin.audit.list, { paginationOpts: page })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.audit.actors", () => {
  test("lists admins (non-seller roles) by email, not sellers", async () => {
    const t = newTest();
    const w = await history(t);
    expect(await as(t, w.boss).query(api.admin.audit.actors, {})).toEqual([
      { _id: w.agent, email: "agent@vano.app" },
      { _id: w.boss, email: "boss@vano.app" },
    ]);
    const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["users.view"]));
    await expect(as(t, viewer).query(api.admin.audit.actors, {})).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("audit action labels", () => {
  test("every action has a label in en and fr", () => {
    for (const messages of [en, fr]) {
      // Stored nested ("user.suspend" → user.suspend), as next-intl reads dots.
      const labels = (messages as unknown as { AuditActions: Record<string, Record<string, string>> }).AuditActions;
      for (const action of AUDIT_ACTIONS) {
        const [group, verb] = action.split(".");
        expect(labels?.[group]?.[verb], action).toBeTruthy();
      }
    }
  });
});
