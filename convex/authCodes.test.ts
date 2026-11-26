import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CLEANUP_BATCH } from "./authCodeJobs";
import { AUTH_CODE_TTL_S, AUTH_MAX_FAILED_PER_HOUR, isCodeShape } from "./lib/authCodes";
import { newTest, type T } from "./lib/test.utils";

/**
 * End to end through Convex Auth's real `auth:signIn` action
 * (CLAUDE.md "Auth codes"). Emails run in log mode; codes are read back
 * from the log line.
 */

async function pem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;
}

let privateKey = "";
beforeAll(async () => {
  privateKey = await pem();
});

let logs: string[] = [];
beforeEach(() => {
  process.env.SITE_URL = "http://localhost:3000";
  process.env.JWT_PRIVATE_KEY = privateKey;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Params = Record<string, string>;
const signIn = (t: T, params: Params) => t.action(api.auth.signIn, { provider: "password", params });

const emails = () => logs.filter((l) => l.includes("[email] (log mode"));
function lastCode(): string {
  const mail = emails().at(-1);
  const code = mail?.match(/^\d{6}$/m)?.[0];
  if (!code) throw new Error("no code email");
  return code;
}

const EMAIL = "amani@example.com";
const PASSWORD = "password1";

async function signUp(t: T, extra: Params = {}) {
  return await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signUp", ...extra });
}

async function verify(t: T, code: string, email = EMAIL) {
  return await signIn(t, { email, code, flow: "email-verification" });
}

async function account(t: T) {
  return await t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", EMAIL))
      .unique(),
  );
}

async function sessionsOf(t: T, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect(),
  );
}

describe("sign-up verification", () => {
  test("sign-up sends a 6-digit code in the screen language and gives no session until it's entered", async () => {
    const t = newTest();
    const started = Date.now();
    expect(await signUp(t, { language: "fr" })).toEqual({ tokens: null });
    expect(emails()).toHaveLength(1);
    expect(emails()[0]).toContain("Confirmez votre e-mail");
    const code = lastCode();
    expect(isCodeShape(code)).toBe(true);

    const row = await t.run((ctx) => ctx.db.query("authVerificationCodes").unique());
    expect(row!.code).not.toBe(code); // stored hashed
    expect(row!.expirationTime).toBeGreaterThanOrEqual(started + AUTH_CODE_TTL_S * 1000);
    expect(row!.expirationTime).toBeLessThanOrEqual(Date.now() + AUTH_CODE_TTL_S * 1000);

    const user = await t.run((ctx) => ctx.db.query("users").unique());
    expect(user).toMatchObject({ email: EMAIL, language: "fr" });
    expect(user!.emailVerificationTime).toBeUndefined();
    expect(await sessionsOf(t, user!._id)).toHaveLength(0);

    const result = await verify(t, code);
    expect(result.tokens).toEqual(expect.objectContaining({ token: expect.any(String) }));
    expect((await account(t))!.emailVerified).toBe(EMAIL);
    const verified = await t.run((ctx) => ctx.db.get("users", user!._id));
    expect(verified!.emailVerificationTime).toEqual(expect.any(Number));
    expect(verified!.roleId).toBeDefined(); // still an active seller
  });

  test("a code works once", async () => {
    const t = newTest();
    await signUp(t);
    const code = lastCode();
    await verify(t, code);
    await expect(verify(t, code)).rejects.toThrow();
  });

  test("a code stops working after 15 minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t = newTest();
    await signUp(t);
    const code = lastCode();
    vi.setSystemTime(Date.now() + AUTH_CODE_TTL_S * 1000 + 1000);
    await expect(verify(t, code)).rejects.toThrow();
    expect((await account(t))!.emailVerified).toBeUndefined();
  });

  test("a code entered with another email is refused", async () => {
    const t = newTest();
    await signUp(t);
    const code = lastCode();
    await signIn(t, { email: "other@example.com", password: PASSWORD, flow: "signUp" });
    await expect(verify(t, code, "other@example.com")).rejects.toThrow();
  });

  test("after too many wrong codes even the right one fails", async () => {
    const t = newTest();
    await signUp(t);
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < AUTH_MAX_FAILED_PER_HOUR; i++) {
      await expect(verify(t, wrong)).rejects.toThrow();
    }
    await expect(verify(t, code)).rejects.toThrow();
    expect((await account(t))!.emailVerified).toBeUndefined();
  });

  test("signing in to an unverified account sends a new code and replaces the old one", async () => {
    const t = newTest();
    await signUp(t);
    const first = lastCode();
    expect(await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" })).toEqual({ tokens: null });
    expect(emails()).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("authVerificationCodes").collect())).toHaveLength(1);
    const second = lastCode();
    if (first !== second) await expect(verify(t, first)).rejects.toThrow();
    expect((await verify(t, second)).tokens).not.toBeNull();
  });

  test("resending is limited per address", async () => {
    const t = newTest();
    await signUp(t);
    await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" }); // burst of 2
    await expect(signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" })).rejects.toThrow(/CODE_RATE_LIMITED/);
  });

  test("email-verification without a code never sends one", async () => {
    const t = newTest();
    await signUp(t);
    await expect(signIn(t, { email: EMAIL, flow: "email-verification" })).rejects.toThrow(/CODE_INVALID/);
    expect(emails()).toHaveLength(1);
  });

  test("a verified account signs in with its password, no code", async () => {
    const t = newTest();
    await signUp(t);
    await verify(t, lastCode());
    const result = await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" });
    expect(result.tokens).not.toBeNull();
    expect(emails()).toHaveLength(1);
  });

  test("a failed send is reported so the screen can offer a retry", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Vano <hello@vano.app>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const t = newTest();
    await expect(signUp(t)).rejects.toThrow(/EMAIL_SEND_FAILED/);
  });
});

describe("password reset", () => {
  async function verifiedAccount(t: T) {
    await signUp(t);
    const { tokens } = await verify(t, lastCode());
    expect(tokens).not.toBeNull();
    return (await account(t))!.userId;
  }

  test("code then new password: signs in, signs out other sessions, old password stops working", async () => {
    const t = newTest();
    const userId = await verifiedAccount(t);
    await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" }); // a second device
    expect(await sessionsOf(t, userId)).toHaveLength(2);

    expect(await signIn(t, { email: EMAIL, flow: "reset" })).toEqual({ tokens: null });
    expect(emails().at(-1)).toContain("Reset your password");
    const result = await signIn(t, { email: EMAIL, code: lastCode(), newPassword: "newpassword1", flow: "reset-verification" });
    expect(result.tokens).not.toBeNull();
    expect(await sessionsOf(t, userId)).toHaveLength(1);

    await expect(signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" })).rejects.toThrow();
    expect((await signIn(t, { email: EMAIL, password: "newpassword1", flow: "signIn" })).tokens).not.toBeNull();
  });

  test("an unknown email gets the same answer and no email", async () => {
    const t = newTest();
    await verifiedAccount(t);
    const before = emails().length;
    expect(await signIn(t, { email: "nobody@example.com", flow: "reset" })).toEqual({ tokens: null });
    expect(emails()).toHaveLength(before);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1); // nothing created for the unknown address
  });

  test("the reset limit applies to unknown emails too", async () => {
    const t = newTest();
    await signIn(t, { email: "nobody@example.com", flow: "reset" });
    await signIn(t, { email: "nobody@example.com", flow: "reset" });
    await expect(signIn(t, { email: "nobody@example.com", flow: "reset" })).rejects.toThrow(/CODE_RATE_LIMITED/);
  });

  test("a wrong code changes nothing", async () => {
    const t = newTest();
    await verifiedAccount(t);
    await signIn(t, { email: EMAIL, flow: "reset" });
    const wrong = lastCode() === "000000" ? "111111" : "000000";
    await expect(
      signIn(t, { email: EMAIL, code: wrong, newPassword: "newpassword1", flow: "reset-verification" }),
    ).rejects.toThrow();
    expect((await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" })).tokens).not.toBeNull();
  });

  test("the new password follows the password rules", async () => {
    const t = newTest();
    await verifiedAccount(t);
    await signIn(t, { email: EMAIL, flow: "reset" });
    await expect(
      signIn(t, { email: EMAIL, code: lastCode(), newPassword: "short", flow: "reset-verification" }),
    ).rejects.toThrow(/PASSWORD_TOO_SHORT/);
  });

  test("a reset also verifies an unverified address", async () => {
    const t = newTest();
    await signUp(t);
    await signIn(t, { email: EMAIL, flow: "reset" });
    await signIn(t, { email: EMAIL, code: lastCode(), newPassword: "newpassword1", flow: "reset-verification" });
    expect((await account(t))!.emailVerified).toBe(EMAIL);
  });
});

describe("languageFor", () => {
  test("sign-up language, else the shop's, else English", async () => {
    const t = newTest();
    const lang = (email: string) => t.query(internal.emails.authCode.languageFor, { email });
    expect(await lang("nobody@example.com")).toBe("en");
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { email: "fr@example.com", language: "fr" });
      await ctx.db.insert("users", { email: "plain@example.com" });
    });
    expect(await lang("fr@example.com")).toBe("fr");
    expect(await lang("plain@example.com")).toBe("en");
  });
});

describe("authCodeJobs.cleanup", () => {
  test("deletes only expired codes, in batches", async () => {
    const t = newTest();
    const now = Date.now();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: EMAIL });
      const accountId = await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: EMAIL });
      for (let i = 0; i < CLEANUP_BATCH + 5; i++) {
        await ctx.db.insert("authVerificationCodes", { accountId, provider: "password-verify", code: `old${i}`, expirationTime: now - 1000 });
      }
      await ctx.db.insert("authVerificationCodes", { accountId, provider: "password-verify", code: "live", expirationTime: now + 60_000 });
    });
    expect(await t.mutation(internal.authCodeJobs.cleanup, {})).toEqual({ deleted: CLEANUP_BATCH });
    expect(await t.mutation(internal.authCodeJobs.cleanup, {})).toEqual({ deleted: 5 });
    const left = await t.run((ctx) => ctx.db.query("authVerificationCodes").collect());
    expect(left.map((r) => r.code)).toEqual(["live"]);
  });
});
