import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { setUpNewAccount } from "./lib/accounts";
import { TEAM_ROLES, type TeamRole } from "./lib/team";
import { as, insertUser, newTest, productArgs, sellerWithShop, setSubscription, storeFile, type T } from "./lib/test.utils";

const DAY = 86_400_000;

beforeEach(() => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());

/** A Business shop (teams on, 5 seats in the seed). */
async function businessShop(t: T, email = "owner@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: Date.now() + 60 * DAY });
  return { ownerId: userId, shopId, owner: as(t, userId) };
}

type Owner = Awaited<ReturnType<typeof businessShop>>["owner"];

async function invite(owner: Owner, role: TeamRole = "seller", email?: string) {
  return await owner.mutation(api.team.createInvite, { role, email, language: "en" });
}

/** A new user who joined the owner's shop with `role`. */
async function member(t: T, owner: Owner, role: TeamRole, email = `${role}@team.cd`) {
  const { token } = await invite(owner, role);
  const userId = await insertUser(t, email);
  await as(t, userId).mutation(api.team.acceptInvite, { token });
  return { userId, me: as(t, userId) };
}

describe("invites", () => {
  test("the owner invites, the person joins with the role, the link works once", async () => {
    const t = newTest();
    const { owner, shopId } = await businessShop(t);
    const { token, emailSent } = await invite(owner, "editor", "Amina@Example.com");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(emailSent).toBe(true);
    // Only the hash is stored, with the normalized email.
    const stored = await t.run((ctx) => ctx.db.query("shopInvites").first());
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.email).toBe("amina@example.com");

    const preview = await t.query(api.team.invitePreview, { token });
    expect(preview).toMatchObject({ state: "pending", shopName: "Chez Amani", role: "editor", relation: null });

    const amina = await insertUser(t, "amina@example.com");
    expect(await as(t, amina).mutation(api.team.acceptInvite, { token })).toBe(shopId);
    const viewer = await as(t, amina).query(api.users.viewer, {});
    expect(viewer).toMatchObject({ hasShop: true, ownsShop: false, shop: { id: shopId, role: "editor" } });
    expect(new Set(viewer?.permissions)).toEqual(new Set(TEAM_ROLES.editor));

    const other = await insertUser(t, "other@example.com");
    await expect(as(t, other).mutation(api.team.acceptInvite, { token })).rejects.toThrow(/INVITE_USED/);
    expect(await t.query(api.team.invitePreview, { token })).toMatchObject({ state: "used" });
  });

  test("expired, revoked, malformed, own shop and already a member", async () => {
    const t = newTest();
    const { owner, ownerId } = await businessShop(t);
    const someone = await insertUser(t, "someone@example.com");

    const expired = await invite(owner);
    await t.run(async (ctx) => {
      const row = await ctx.db.get("shopInvites", expired.inviteId);
      await ctx.db.patch("shopInvites", expired.inviteId, { expiresAt: row!._creationTime - 1 });
    });
    await expect(as(t, someone).mutation(api.team.acceptInvite, { token: expired.token })).rejects.toThrow(/INVITE_EXPIRED/);

    const revoked = await invite(owner);
    await owner.mutation(api.team.revokeInvite, { inviteId: revoked.inviteId });
    await expect(as(t, someone).mutation(api.team.acceptInvite, { token: revoked.token })).rejects.toThrow(/INVITE_INVALID/);

    await expect(as(t, someone).mutation(api.team.acceptInvite, { token: "nope" })).rejects.toThrow(/INVITE_INVALID/);
    expect(await t.query(api.team.invitePreview, { token: "nope" })).toEqual({ state: "invalid" });

    const mine = await invite(owner);
    await expect(as(t, ownerId).mutation(api.team.acceptInvite, { token: mine.token })).rejects.toThrow(/INVITE_OWN_SHOP/);

    await as(t, someone).mutation(api.team.acceptInvite, { token: mine.token });
    const again = await invite(owner);
    await expect(as(t, someone).mutation(api.team.acceptInvite, { token: again.token })).rejects.toThrow(/ALREADY_MEMBER/);
  });

  test("renewing makes a new link; the old one stops working", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const first = await invite(owner, "viewer", "v@example.com");
    const renewed = await owner.mutation(api.team.renewInvite, { inviteId: first.inviteId });
    expect(renewed.token).not.toBe(first.token);
    expect(renewed.emailSent).toBe(true);
    const someone = await insertUser(t, "v@example.com");
    await expect(as(t, someone).mutation(api.team.acceptInvite, { token: first.token })).rejects.toThrow(/INVITE_INVALID/);
    await as(t, someone).mutation(api.team.acceptInvite, { token: renewed.token });
  });

  test("teams need Business; seats are members + pending invites", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t, "pro@shop.cd");
    // The trial counts as Pro: no teams.
    await expect(invite(as(t, userId))).rejects.toThrow(/PLAN_FEATURE_LOCKED/);

    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: Date.now() + 60 * DAY });
    const owner = as(t, userId);
    await member(t, owner, "seller", "a@team.cd");
    await member(t, owner, "seller", "b@team.cd");
    await invite(owner);
    await invite(owner);
    await invite(owner);
    await expect(invite(owner)).rejects.toThrow(/PLAN_LIMIT_TEAM/);
    const overview = await owner.query(api.team.overview, {});
    expect(overview).toMatchObject({ entitled: true, limit: 5 });
    expect(overview.members).toHaveLength(2);
    expect(overview.invites).toHaveLength(3);
  });

  test("a bad email is refused; without SITE_URL the link is still made", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    await expect(invite(owner, "seller", "not-an-email")).rejects.toThrow(/EMAIL_INVALID/);
    vi.stubEnv("SITE_URL", "");
    expect((await invite(owner, "seller", "a@example.com")).emailSent).toBe(false);
  });

  test("only the owner manages the team (a manager is FORBIDDEN)", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const manager = await member(t, owner, "manager");
    await expect(manager.me.mutation(api.team.createInvite, { role: "seller", language: "en" })).rejects.toThrow(/FORBIDDEN/);
    await expect(manager.me.query(api.team.overview, {})).rejects.toThrow(/FORBIDDEN/);
  });

  test("a member of another shop is NOT_FOUND", async () => {
    const t = newTest();
    const a = await businessShop(t, "a@shop.cd", "shop-a");
    const b = await businessShop(t, "b@shop.cd", "shop-b");
    await member(t, a.owner, "seller", "x@team.cd");
    const memberId = (await a.owner.query(api.team.overview, {})).members[0]._id;
    await expect(b.owner.mutation(api.team.removeMember, { memberId })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.owner.mutation(api.team.changeRole, { memberId, role: "manager" })).rejects.toThrow(/NOT_FOUND/);
  });

  test("an invite lets someone sign up while sign-up is closed", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const { token } = await invite(owner);
    await t.run((ctx) => ctx.db.insert("platformSettings", { signupEnabled: false }));

    const refused = await t.run((ctx) => ctx.db.insert("users", { email: "x@example.com" }));
    await expect(t.run((ctx) => setUpNewAccount(ctx, refused))).rejects.toThrow(/SIGNUP_DISABLED/);

    const invited = await t.run((ctx) => ctx.db.insert("users", { email: "y@example.com", pendingInvite: token }));
    await t.run((ctx) => setUpNewAccount(ctx, invited));
    const user = await t.run((ctx) => ctx.db.get("users", invited));
    expect(user?.roleId).toBeDefined();
    expect(user?.pendingInvite).toBeUndefined();
  });
});

describe("members", () => {
  test("role change, suspension and removal take effect at once", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const seller = await member(t, owner, "seller");
    const memberId = (await owner.query(api.team.overview, {})).members[0]._id;
    await seller.me.query(api.products.listMine, {});
    await expect(seller.me.mutation(api.products.create, await productArgs(t))).rejects.toThrow(/FORBIDDEN/);

    await owner.mutation(api.team.changeRole, { memberId, role: "editor" });
    await seller.me.mutation(api.products.create, await productArgs(t));

    await owner.mutation(api.team.setSuspended, { memberId, suspended: true });
    await expect(seller.me.query(api.products.listMine, {})).rejects.toThrow();
    expect(await seller.me.query(api.users.viewer, {})).toMatchObject({
      hasShop: false,
      shops: [{ role: "editor", state: "suspended" }],
    });

    await owner.mutation(api.team.setSuspended, { memberId, suspended: false });
    await seller.me.query(api.products.listMine, {});

    await owner.mutation(api.team.removeMember, { memberId });
    await expect(seller.me.query(api.products.listMine, {})).rejects.toThrow();
    expect(await seller.me.query(api.users.viewer, {})).toMatchObject({ hasShop: false, shops: [] });
    // The member was told each time.
    const kinds = await t.run((ctx) =>
      ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", seller.userId)).collect(),
    );
    expect(kinds.map((n) => n.data.type === "team.accessChanged" && n.data.change)).toEqual([
      "role",
      "suspended",
      "reactivated",
      "removed",
    ]);
  });

  test("a downgrade pauses members (nothing deleted); an upgrade brings them back", async () => {
    const t = newTest();
    const { owner, shopId } = await businessShop(t);
    const viewer = await member(t, owner, "viewer");
    await viewer.me.query(api.stats.summary, { today: "2026-11-20" });

    await setSubscription(t, shopId, { plan: "free", status: "free" });
    await expect(viewer.me.query(api.stats.summary, { today: "2026-11-20" })).rejects.toThrow();
    expect(await viewer.me.query(api.users.viewer, {})).toMatchObject({
      hasShop: false,
      shops: [{ state: "paused" }],
    });
    expect(await t.run((ctx) => ctx.db.query("shopMembers").collect())).toHaveLength(1);

    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: Date.now() + 60 * DAY });
    await viewer.me.query(api.stats.summary, { today: "2026-11-20" });
  });

  test("over the seat limit, the newest members are paused first", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const first = await member(t, owner, "seller", "first@team.cd");
    const second = await member(t, owner, "seller", "second@team.cd");
    // One seat on Business (Plans & features).
    const { readPlanConfig, writePlanConfig } = await import("./lib/planConfig");
    await t.run(async (ctx) => {
      const config = await readPlanConfig(ctx);
      const next = structuredClone(config);
      next.features.teamMembers.values.business = 1;
      await writePlanConfig(ctx, next, config.version, null);
    });
    expect((await first.me.query(api.users.viewer, {}))?.hasShop).toBe(true);
    expect(await second.me.query(api.users.viewer, {})).toMatchObject({ hasShop: false, shops: [{ state: "paused" }] });
  });

  test("leaving a shop", async () => {
    const t = newTest();
    const { owner, shopId } = await businessShop(t);
    const seller = await member(t, owner, "seller");
    await seller.me.mutation(api.team.leaveShop, { shopId });
    expect(await seller.me.query(api.users.viewer, {})).toMatchObject({ hasShop: false, shops: [] });
  });
});

describe("several shops", () => {
  test("a person in two shops switches between them; never to a shop they can't use", async () => {
    const t = newTest();
    const a = await businessShop(t, "a@shop.cd", "shop-a");
    const b = await businessShop(t, "b@shop.cd", "shop-b");
    const c = await businessShop(t, "c@shop.cd", "shop-c");
    const { token: ta } = await invite(a.owner, "editor");
    const { token: tb } = await invite(b.owner, "viewer");
    const person = await insertUser(t, "p@example.com");
    const me = as(t, person);
    await me.mutation(api.team.acceptInvite, { token: ta });
    await me.mutation(api.team.acceptInvite, { token: tb });
    // Joining switches to the new shop.
    expect((await me.query(api.users.viewer, {}))?.shop?.id).toBe(b.shopId);
    expect((await me.query(api.users.viewer, {}))?.shops).toHaveLength(2);

    await me.mutation(api.team.switchShop, { shopId: a.shopId });
    expect((await me.query(api.users.viewer, {}))?.shop).toMatchObject({ id: a.shopId, role: "editor" });
    // Products are the current shop's.
    await me.mutation(api.products.create, await productArgs(t, { name: "In A" }));
    const products = await a.owner.query(api.products.listMine, {});
    expect(products.map((p) => p.name)).toContain("In A");

    await expect(me.mutation(api.team.switchShop, { shopId: c.shopId })).rejects.toThrow(/NOT_FOUND/);
  });

  test("a member can still open their own shop", async () => {
    const t = newTest();
    const a = await businessShop(t);
    const { me } = await member(t, a.owner, "seller");
    const own = await me.mutation(api.shops.create, {
      name: "Mon shop",
      slug: "mon-shop",
      currency: "USD",
      language: "fr",
      categories: ["bags"],
      whatsappNumber: "+243 812 345 679",
      city: "Goma",
      country: "CD",
    });
    const viewer = await me.query(api.users.viewer, {});
    expect(viewer).toMatchObject({ ownsShop: true, shop: { id: own, role: "owner" } });
    expect(viewer?.shops.map((s) => s.role).sort()).toEqual(["owner", "seller"]);
  });
});

describe("shared files", () => {
  test("team members share the shop's photos; another shop can't use them", async () => {
    const t = newTest();
    const a = await businessShop(t, "a@shop.cd", "shop-a");
    const b = await businessShop(t, "b@shop.cd", "shop-b");
    const editor = await member(t, a.owner, "editor");
    const photo = await storeFile(t);
    const productId = await editor.me.mutation(api.products.create, await productArgs(t, { imageIds: [photo] }));
    // The owner edits the editor's product with the same photo.
    await a.owner.mutation(api.products.update, { productId, ...(await productArgs(t, { imageIds: [photo] })) });
    await expect(
      b.owner.mutation(api.products.create, await productArgs(t, { imageIds: [photo] })),
    ).rejects.toThrow(/IMAGE_INVALID/);
  });
});

describe("activity and notifications", () => {
  test("activity records who did what; locked without teams", async () => {
    const t = newTest();
    const { owner, shopId } = await businessShop(t);
    const editor = await member(t, owner, "editor", "ed@team.cd");
    await editor.me.mutation(api.products.create, await productArgs(t, { name: "Robe" }));
    const page = await owner.query(api.activity.list, { paginationOpts: { numItems: 10, cursor: null } });
    expect(page.locked).toBe(false);
    expect(page.page[0]).toMatchObject({ kind: "product.created", targetLabel: "Robe", actor: { label: "ed@team.cd" } });
    expect(page.page.map((r) => r.kind)).toContain("team.joined");
    // A seller (no ownActivity.view) can't read it.
    const seller = await member(t, owner, "seller", "s@team.cd");
    await expect(seller.me.query(api.activity.list, { paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow(/FORBIDDEN/);

    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: Date.now() + 60 * DAY });
    // Owner keeps access to their shop on Pro; the page is locked.
    expect((await owner.query(api.activity.list, { paginationOpts: { numItems: 10, cursor: null } })).locked).toBe(true);
  });

  test("sales records show who marked them", async () => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const seller = await member(t, owner, "seller", "vendeur@team.cd");
    const productId = await owner.mutation(api.products.create, await productArgs(t, { sizes: [], colors: [] }));
    await seller.me.mutation(api.salesRecords.record, {
      productId,
      quantity: 1,
      finalUnitPrice: 2500,
      source: "whatsapp",
      soldAt: Date.now() - 1000,
    });
    const list = await owner.query(api.salesRecords.listMine, {});
    if (list.locked) throw new Error("locked");
    expect(list.rows[0].recordedBy).toBe("vendeur@team.cd");
  });

  test("shop notifications reach only members whose role covers the area, and hide after removal", async () => {
    const t = newTest();
    const { owner, ownerId, shopId } = await businessShop(t);
    const editor = await member(t, owner, "editor", "ed@team.cd");
    const viewer = await member(t, owner, "viewer", "vi@team.cd");
    const { notify } = await import("./lib/notify");
    await t.run(async (ctx) => {
      const shop = (await ctx.db.get("shops", shopId))!;
      await notify(ctx, { data: { type: "report.ready", month: "2026-10" }, to: { shop }, dedupeKey: "r:1" });
      await notify(ctx, {
        data: { type: "look.reset", scope: "banner", reason: "test" },
        to: { shop },
        dedupeKey: "l:1",
      });
    });
    const types = async (userId: Id<"users">) =>
      (await as(t, userId).query(api.notifications.inbox.latest, {})).map((n) => n.data.type).sort();
    expect(await types(ownerId)).toEqual(["look.reset", "report.ready", "team.memberJoined", "team.memberJoined"]);
    expect(await types(viewer.userId)).toEqual(["report.ready"]);
    expect(await types(editor.userId)).toEqual(["look.reset"]);

    const viewerId = (await owner.query(api.team.overview, {})).members.find((m) => m.role === "viewer")!._id;
    await owner.mutation(api.team.removeMember, { memberId: viewerId });
    // Only the personal "removed" note is left.
    expect(await types(viewer.userId)).toEqual(["team.accessChanged"]);
  });
});

describe("role matrix (server-side, every area)", () => {
  // true = allowed; the call may still fail for another reason, never FORBIDDEN.
  const AREAS = {
    viewProducts: { manager: true, seller: true, editor: true, viewer: false },
    editProducts: { manager: true, seller: false, editor: true, viewer: false },
    offers: { manager: true, seller: false, editor: true, viewer: false },
    look: { manager: true, seller: false, editor: true, viewer: false },
    recordSales: { manager: true, seller: true, editor: false, viewer: false },
    reports: { manager: true, seller: false, editor: false, viewer: true },
    stats: { manager: true, seller: false, editor: false, viewer: true },
    settings: { manager: true, seller: false, editor: false, viewer: false },
    billing: { manager: false, seller: false, editor: false, viewer: false },
    team: { manager: false, seller: false, editor: false, viewer: false },
  } as const;

  test.each(["manager", "seller", "editor", "viewer"] as const)("%s", async (role) => {
    const t = newTest();
    const { owner } = await businessShop(t);
    const { me } = await member(t, owner, role);
    const productId = await owner.mutation(api.products.create, await productArgs(t, { sizes: [], colors: [] }));
    const calls: Record<keyof typeof AREAS, () => Promise<unknown>> = {
      viewProducts: () => me.query(api.products.listMine, {}),
      editProducts: () => me.mutation(api.products.setFeatured, { productId, featured: true }),
      offers: () => me.query(api.sales.listMine, {}),
      look: () => me.mutation(api.shopLooks.discardDraft, {}),
      recordSales: () => me.query(api.salesRecords.quote, { productId, now: Date.now() }),
      reports: () => me.query(api.reports.month, { month: "2026-10" }),
      stats: () => me.query(api.stats.summary, { today: "2026-11-20" }),
      settings: () => me.mutation(api.shops.hideChecklist, {}),
      billing: () => me.query(api.billing.mine, {}),
      team: () => me.query(api.team.overview, {}),
    };
    for (const [area, allowed] of Object.entries(AREAS) as [keyof typeof AREAS, Record<TeamRole, boolean>][]) {
      const outcome = await calls[area]().then(
        () => "ok",
        (e: unknown) => (String(e).includes("FORBIDDEN") ? "forbidden" : "ok"),
      );
      expect({ area, outcome }).toEqual({ area, outcome: allowed[role] ? "ok" : "forbidden" });
    }
  });
});
