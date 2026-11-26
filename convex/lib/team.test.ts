import { describe, expect, test } from "vitest";
import { canShopDo, usableMemberIds } from "./entitlements";
import { SELLER_PERMISSIONS } from "./permissions";
import type { PlanLimits } from "./planFeatures";
import { effectivePermissions } from "./shopAccess";
import { inviteStateAt, isInviteToken, memberLabel, OWNER_ONLY, TEAM_ROLES } from "./team";
import type { Id } from "../_generated/dataModel";

const limits = (teamMembers: number, teams = true): PlanLimits => ({
  products: null,
  photosPerProduct: 6,
  teamMembers,
  features: teams ? ["teamRoles"] : [],
});
const m = (id: string, joinedAt: number, status: "active" | "suspended" = "active") => ({
  _id: id as Id<"shopMembers">,
  joinedAt,
  status,
});

describe("team rules", () => {
  test("presets never include plan, billing or team; the owner has them", () => {
    expect([...OWNER_ONLY].sort()).toEqual(["ownBilling.manage", "ownTeam.manage"]);
    for (const perms of Object.values(TEAM_ROLES)) {
      expect(perms).toContain("ownShop.view");
      for (const p of perms) expect(SELLER_PERMISSIONS).toContain(p);
    }
    expect(TEAM_ROLES.editor).not.toContain("ownSales.manage");
    expect(TEAM_ROLES.editor).not.toContain("ownReports.view");
    expect(TEAM_ROLES.viewer).toEqual(["ownShop.view", "ownStats.view", "ownReports.view"]);
  });

  test("effective permissions keep admin ones and narrow seller ones", () => {
    const global = new Set([...SELLER_PERMISSIONS, "users.view" as const]);
    expect([...effectivePermissions(global, "viewer")].sort()).toEqual(
      ["ownReports.view", "ownShop.view", "ownStats.view", "users.view"].sort(),
    );
    expect(effectivePermissions(global, "owner").size).toBe(global.size);
  });

  test("usable members: first joined, active, up to the limit; none without teams", () => {
    const members = [m("c", 3), m("a", 1), m("s", 0, "suspended"), m("b", 2)];
    expect([...usableMemberIds(members, limits(2))].sort()).toEqual(["a", "b"]);
    expect(usableMemberIds(members, limits(5, false)).size).toBe(0);
    expect(usableMemberIds(members, limits(0)).size).toBe(0);
  });

  test("addMember: feature first, then seats", () => {
    expect(canShopDo(limits(5, false), { kind: "addMember", seats: 0 })).toBe("PLAN_FEATURE_LOCKED");
    expect(canShopDo(limits(5), { kind: "addMember", seats: 4 })).toBeNull();
    expect(canShopDo(limits(5), { kind: "addMember", seats: 5 })).toBe("PLAN_LIMIT_TEAM");
  });

  test("invite state, token format, labels", () => {
    expect(inviteStateAt({ status: "pending", expiresAt: 10 }, 5)).toBe("valid");
    expect(inviteStateAt({ status: "pending", expiresAt: 10 }, 10)).toBe("expired");
    expect(inviteStateAt({ status: "accepted", expiresAt: 10 }, 5)).toBe("used");
    expect(inviteStateAt({ status: "revoked", expiresAt: 10 }, 5)).toBe("revoked");
    expect(isInviteToken("a".repeat(64))).toBe(true);
    expect(isInviteToken("A".repeat(64))).toBe(false);
    expect(memberLabel({ name: " Amina ", email: "a@x.cd" })).toBe("Amina");
    expect(memberLabel({ email: "a@x.cd" })).toBe("a@x.cd");
  });
});
