import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, builtInRoles, insertRole, insertUserWithRole, newTest, type T } from "../lib/test.utils";

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["settings.view"]));
  const seller = await insertUserWithRole(t, "s@shop.cd", ids.seller);
  return { admin, viewer, seller };
}

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());
const save = (t: T, userId: Parameters<typeof as>[1], over: Partial<{ signupEnabled: boolean; announcementEn: string; announcementFr: string }> = {}) =>
  as(t, userId).mutation(api.admin.settings.update, {
    signupEnabled: true,
    announcementEn: "",
    announcementFr: "",
    ...over,
  });

describe("admin.settings", () => {
  test("defaults: sign-up open, no announcement", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await as(t, w.viewer).query(api.admin.settings.get, {})).toEqual({
      signupEnabled: true,
      announcementEn: "",
      announcementFr: "",
    });
  });

  test("saves and logs each change; the same values again do nothing", async () => {
    const t = newTest();
    const w = await world(t);
    await save(t, w.admin, { announcementEn: " Maintenance tonight ", announcementFr: "Maintenance ce soir" });
    await save(t, w.admin, { announcementEn: "Maintenance tonight", announcementFr: "Maintenance ce soir" });
    await save(t, w.admin, { announcementEn: "Back online", announcementFr: "De retour" });
    await save(t, w.admin, { signupEnabled: false, announcementEn: "Back online", announcementFr: "De retour" });
    await save(t, w.admin, { signupEnabled: false });

    expect(await as(t, w.admin).query(api.admin.settings.get, {})).toEqual({
      signupEnabled: false,
      announcementEn: "",
      announcementFr: "",
    });
    expect((await audit(t)).map((a) => a.details)).toEqual([
      { signupEnabled: true, announcement: "set" },
      { signupEnabled: true, announcement: "changed" },
      { signupEnabled: false, announcement: "unchanged" },
      { signupEnabled: false, announcement: "cleared" },
    ]);
    expect((await audit(t))[0]).toMatchObject({ action: "settings.update", targetType: "settings" });
    expect(await t.run((ctx) => ctx.db.query("platformSettings").collect())).toHaveLength(1);
  });

  test("the announcement needs both languages and a length limit", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(save(t, w.admin, { announcementEn: "Only English" })).rejects.toThrow(/ANNOUNCEMENT_INVALID/);
    await expect(save(t, w.admin, { announcementEn: "x".repeat(281), announcementFr: "ok" })).rejects.toThrow(
      /ANNOUNCEMENT_INVALID/,
    );
  });

  test("permissions: view to read, manage to change", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(save(t, w.viewer)).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller).query(api.admin.settings.get, {})).rejects.toThrow(/FORBIDDEN/);
    await t.run((ctx) => ctx.db.patch("users", w.admin, { status: "suspended" }));
    await expect(as(t, w.admin).query(api.admin.settings.get, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(t.query(api.admin.settings.get, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});
