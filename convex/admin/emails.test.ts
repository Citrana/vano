import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("admin.emails", () => {
  test("status: log mode by default, Resend with its sender once configured", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await as(t, w.viewer).query(api.admin.emails.status, {})).toEqual({ provider: "log", from: null });
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Vano <hello@vano.app>";
    expect(await as(t, w.viewer).query(api.admin.emails.status, {})).toEqual({
      provider: "resend",
      from: "Vano <hello@vano.app>",
    });
  });

  test("only settings.manage can send; status needs settings.view", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(t.mutation(api.admin.emails.sendTest, { language: "en" })).rejects.toThrow(/NOT_AUTHENTICATED/);
    await expect(as(t, w.seller).mutation(api.admin.emails.sendTest, { language: "en" })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.viewer).mutation(api.admin.emails.sendTest, { language: "en" })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller).query(api.admin.emails.status, {})).rejects.toThrow(/FORBIDDEN/);
    expect(await audit(t)).toHaveLength(0);
  });

  test("sends to the admin's own address in the chosen language, logged", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await as(t, w.admin).mutation(api.admin.emails.sendTest, { language: "fr" })).toEqual({
      to: "b•••@vano.app",
      provider: "log",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Subject: E-mail de test Vano"));
    const [row] = await audit(t);
    expect(row).toMatchObject({
      action: "settings.testEmail",
      actorEmail: "boss@vano.app",
      targetType: "settings",
      details: { provider: "log", language: "fr" },
    });
  });

  test("an account without an email can't send", async () => {
    const t = newTest();
    const ids = await builtInRoles(t);
    const noEmail = await t.run((ctx) => ctx.db.insert("users", { roleId: ids.super_admin, status: "active" }));
    await expect(as(t, noEmail).mutation(api.admin.emails.sendTest, { language: "en" })).rejects.toThrow(/EMAIL_MISSING/);
  });

  test("rate limited per admin", async () => {
    const t = newTest();
    const w = await world(t);
    for (let i = 0; i < 3; i++) await as(t, w.admin).mutation(api.admin.emails.sendTest, { language: "en" });
    await expect(as(t, w.admin).mutation(api.admin.emails.sendTest, { language: "en" })).rejects.toThrow(
      /TEST_EMAIL_RATE_LIMITED/,
    );
    expect(await audit(t)).toHaveLength(3);
  });
});
