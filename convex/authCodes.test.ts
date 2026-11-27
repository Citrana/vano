import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CLEANUP_BATCH } from "./authCodeJobs";
import { AUTH_CODE_TTL_S, AUTH_MAX_FAILED_PER_HOUR, isCodeShape, resetCodeValid } from "./lib/authCodes";
import { newTest, sellerWithShop, type T } from "./lib/test.utils";
import { sha256Hex } from "./verification/codes";

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

// The guard pads sign-ups and failed codes / sign-ins to a minimum time
// (lib/authFlows.ts), with real timers here: tests that make several
// attempts need longer than the default 5 s.
vi.setConfig({ testTimeout: 30_000 });

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

describe("sign-up never reveals whether an email has an account", () => {
  const notices = () => emails().filter((m) => m.includes("You already have a Vano account") || m.includes("Vous avez déjà un compte Vano"));
  const hasCode = (mail: string) => /^\d{6}$/m.test(mail);
  const users = (t: T) => t.run(async (ctx) => (await ctx.db.query("users").collect()).length);

  async function registered(t: T) {
    await signUp(t);
    await verify(t, lastCode());
    logs = [];
  }

  test("a registered email gets the new-email answer; its owner gets an email instead of a code", async () => {
    const t = newTest();
    await registered(t);
    const before = await account(t);

    // Same answer as a brand-new email (no session, the code step).
    expect(await signUp(t, { password: "someone-else" })).toEqual({ tokens: null });
    expect(await signIn(t, { email: "new@example.com", password: PASSWORD, flow: "signUp" })).toEqual({ tokens: null });

    const notice = notices();
    expect(notice).toHaveLength(1);
    expect(hasCode(notice[0])).toBe(false);
    expect(notice[0]).toContain("http://localhost:3000/login");
    expect(notice[0]).toContain("http://localhost:3000/forgot-password?email=amani%40example.com");
    // Nothing about the account changed: same login, same password.
    expect(await users(t)).toBe(2);
    expect((await account(t))!.secret).toBe(before!.secret);
    expect((await signIn(t, { email: EMAIL, password: PASSWORD, flow: "signIn" })).tokens).not.toBeNull();
  });

  test("a wrong code reads the same for a registered email and a new one", async () => {
    const t = newTest();
    await registered(t);
    await signUp(t, { password: "someone-else" });
    await signIn(t, { email: "new@example.com", password: PASSWORD, flow: "signUp" });
    await expect(verify(t, "000000")).rejects.toThrow(/CODE_INVALID/);
    await expect(verify(t, "000000", "new@example.com")).rejects.toThrow(/CODE_INVALID/);
    // And for an email nobody used at all.
    await expect(verify(t, "000000", "nobody@example.com")).rejects.toThrow(/CODE_INVALID/);
  });

  test("the notice is in the owner's language, not the screen's", async () => {
    const t = newTest();
    await signUp(t, { language: "fr" });
    await verify(t, lastCode());
    logs = [];
    await signUp(t, { language: "en", password: "someone-else" });
    expect(notices()[0]).toContain("Vous avez déjà un compte Vano");
  });

  test("Resend on your own pending sign-up (signing up again) sends a new code", async () => {
    const t = newTest();
    await signUp(t);
    expect(await signUp(t)).toEqual({ tokens: null });
    expect(emails()).toHaveLength(2);
    expect(hasCode(emails()[1])).toBe(true);
    expect(notices()).toHaveLength(0);
    expect((await verify(t, lastCode())).tokens).not.toBeNull();
  });

  test("signing up over someone else's pending account sends its owner the notice, not a code", async () => {
    const t = newTest();
    await signUp(t);
    logs = [];
    expect(await signUp(t, { password: "someone-else" })).toEqual({ tokens: null });
    expect(notices()).toHaveLength(1);
    expect(emails().some(hasCode)).toBe(false);
  });

  test("the send limit gives a registered and a new address the same number of emails", async () => {
    const attempts = async (t: T, email: string) => {
      const out: string[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          await signIn(t, { email, password: "someone-else", flow: "signUp" });
          out.push("ok");
        } catch (error) {
          out.push(String(error).includes("CODE_RATE_LIMITED") ? "limited" : "other");
        }
      }
      return out;
    };
    // Registered: its own sign-up code already used one email of the budget.
    const known = newTest();
    await signUp(known);
    await verify(known, lastCode());
    expect(await attempts(known, EMAIL)).toEqual(["ok", "limited", "limited"]);
    expect(emails()).toHaveLength(2); // the sign-up code + one notice

    logs = [];
    const fresh = newTest();
    expect(await attempts(fresh, EMAIL)).toEqual(["ok", "ok", "limited"]);
    expect(emails()).toHaveLength(2); // a code + a resend
  });

  test("sign-up attempts are limited per address even when nothing is sent", async () => {
    const t = newTest();
    await t.run((ctx) => ctx.db.insert("platformSettings", { signupEnabled: false }));
    for (let i = 0; i < 5; i++) await expect(signUp(t)).rejects.toThrow(/SIGNUP_DISABLED/);
    await expect(signUp(t)).rejects.toThrow(/CODE_RATE_LIMITED/);
  });

  test("closed sign-up: registered and new emails get the same refusal; an invite lets both through alike", async () => {
    const t = newTest();
    await registered(t);
    const { userId, shopId } = await sellerWithShop(t, "owner@example.com");
    const token = "b".repeat(64);
    const tokenHash = await sha256Hex(token);
    await t.run((ctx) =>
      ctx.db.insert("shopInvites", {
        shopId,
        role: "viewer",
        tokenHash,
        language: "en",
        createdBy: userId,
        expiresAt: Date.now() + 86_400_000,
        status: "pending",
      }),
    );
    await t.run((ctx) => ctx.db.insert("platformSettings", { signupEnabled: false }));
    logs = [];

    await expect(signUp(t, { password: "someone-else" })).rejects.toThrow(/SIGNUP_DISABLED/);
    await expect(signIn(t, { email: "new@example.com", password: PASSWORD, flow: "signUp" })).rejects.toThrow(
      /SIGNUP_DISABLED/,
    );
    // No code and no notice (the shop owner's welcome email isn't counted).
    expect(notices()).toHaveLength(0);
    expect(emails().filter(hasCode)).toHaveLength(0);

    expect(await signUp(t, { password: "someone-else", invite: token })).toEqual({ tokens: null });
    expect(await signIn(t, { email: "new@example.com", password: PASSWORD, flow: "signUp", invite: token })).toEqual({
      tokens: null,
    });
    expect(notices()).toHaveLength(1);
    expect(emails().filter(hasCode)).toHaveLength(1);
  });
});

describe("sign-in errors stay generic", () => {
  test("a wrong password and an unknown email read the same INVALID_CREDENTIALS", async () => {
    const t = newTest();
    await signUp(t);
    await verify(t, lastCode());
    await expect(signIn(t, { email: EMAIL, password: "wrong-password", flow: "signIn" })).rejects.toThrow(
      /INVALID_CREDENTIALS/,
    );
    await expect(signIn(t, { email: "nobody@example.com", password: "wrong-password", flow: "signIn" })).rejects.toThrow(
      /INVALID_CREDENTIALS/,
    );
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

describe("checkResetCode", () => {
  const check = (t: T, email: string, code: string) => t.mutation(api.authCodes.checkResetCode, { email, code });
  const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

  async function resetRequested(t: T) {
    await signUp(t);
    await verify(t, lastCode());
    await signIn(t, { email: EMAIL, flow: "reset" });
    return lastCode();
  }

  test("the right code is ok and still works to change the password", async () => {
    const t = newTest();
    const code = await resetRequested(t);
    expect(await check(t, " Amani@Example.com ", code)).toEqual({ status: "ok" });
    expect(await check(t, EMAIL, code)).toEqual({ status: "ok" }); // read-only
    const result = await signIn(t, { email: EMAIL, code, newPassword: "newpassword1", flow: "reset-verification" });
    expect(result.tokens).not.toBeNull();
    expect(await check(t, EMAIL, code)).toEqual({ status: "invalid" }); // used up by the reset
  });

  test("a wrong code, an unknown email and another email's code all read invalid", async () => {
    const t = newTest();
    const code = await resetRequested(t);
    expect(await check(t, EMAIL, wrongFor(code))).toEqual({ status: "invalid" });
    expect(await check(t, "nobody@example.com", code)).toEqual({ status: "invalid" });
    expect(await check(t, "nobody@example.com", wrongFor(code))).toEqual({ status: "invalid" });
  });

  test("a sign-up code isn't a reset code", async () => {
    const t = newTest();
    await signUp(t);
    expect(await check(t, EMAIL, lastCode())).toEqual({ status: "invalid" });
  });

  test("an expired code is invalid", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t = newTest();
    const code = await resetRequested(t);
    vi.setSystemTime(Date.now() + AUTH_CODE_TTL_S * 1000 + 1000);
    expect(await check(t, EMAIL, code)).toEqual({ status: "invalid" });
  });

  test("after too many wrong codes even the right one reads tooMany; right codes don't count", async () => {
    const t = newTest();
    const code = await resetRequested(t);
    for (let i = 0; i < 3; i++) expect(await check(t, EMAIL, code)).toEqual({ status: "ok" });
    for (let i = 0; i < AUTH_MAX_FAILED_PER_HOUR; i++) {
      expect(await check(t, EMAIL, wrongFor(code))).toEqual({ status: "invalid" });
    }
    expect(await check(t, EMAIL, code)).toEqual({ status: "tooMany" });
    // Per email: another address isn't locked.
    expect(await check(t, "other@example.com", code)).toEqual({ status: "invalid" });
  });

  test("malformed input is invalid without using a try", async () => {
    const t = newTest();
    const code = await resetRequested(t);
    for (let i = 0; i < AUTH_MAX_FAILED_PER_HOUR + 2; i++) {
      expect(await check(t, EMAIL, "12ab")).toEqual({ status: "invalid" });
      expect(await check(t, "not-an-email", code)).toEqual({ status: "invalid" });
    }
    expect(await check(t, EMAIL, code)).toEqual({ status: "ok" });
  });

  test("resetCodeValid", () => {
    const row = { provider: "password-reset", expirationTime: 2000 };
    const account = { providerAccountId: EMAIL };
    expect(resetCodeValid(row, account, EMAIL, 1000)).toBe(true);
    expect(resetCodeValid(row, account, EMAIL, 2000)).toBe(false);
    expect(resetCodeValid({ ...row, provider: "password-verify" }, account, EMAIL, 1000)).toBe(false);
    expect(resetCodeValid(row, account, "other@example.com", 1000)).toBe(false);
    expect(resetCodeValid(null, account, EMAIL, 1000)).toBe(false);
    expect(resetCodeValid(row, null, EMAIL, 1000)).toBe(false);
  });
});
