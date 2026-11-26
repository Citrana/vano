import { describe, expect, test, vi } from "vitest";
import { RESET_MIN_RESPONSE_MS } from "./authCodes";
import { guardAuthorize, isMissingAccountError } from "./authFlows";

// Convex Auth's ctx isn't used by the guard itself.
const ctx = {} as never;
const ok = { userId: "u1" as never };

function setup(base: (params: Record<string, unknown>) => Promise<typeof ok | null>) {
  let clock = 0;
  const sleeps: number[] = [];
  const consumeResetSend = vi.fn(async () => {});
  const guarded = guardAuthorize(base as never, {
    consumeResetSend,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { guarded, consumeResetSend, sleeps, tick: (ms: number) => (clock += ms) };
}

describe("guardAuthorize", () => {
  test("other flows go to Convex Auth unchanged", async () => {
    const base = vi.fn(async () => ok);
    const { guarded, consumeResetSend, sleeps } = setup(base);
    const params = { flow: "signIn", email: "A@x.com", password: "p" };
    expect(await guarded(params, ctx)).toBe(ok);
    expect(base).toHaveBeenCalledWith(params, ctx);
    expect(consumeResetSend).not.toHaveBeenCalled();
    expect(sleeps).toEqual([]);
  });

  test("email-verification needs a code", async () => {
    const base = vi.fn(async () => ok);
    const { guarded } = setup(base);
    await expect(guarded({ flow: "email-verification", email: "a@x.com" }, ctx)).rejects.toThrow();
    await expect(guarded({ flow: "email-verification", email: "a@x.com", code: "" }, ctx)).rejects.toThrow();
    expect(base).not.toHaveBeenCalled();
    expect(await guarded({ flow: "email-verification", email: "a@x.com", code: "123456" }, ctx)).toBe(ok);
  });

  test("reset: a missing account answers like a real one, both padded to the minimum time", async () => {
    const missing = setup(async () => {
      throw new Error("InvalidAccountId");
    });
    expect(await missing.guarded({ flow: "reset", email: " A@X.com " }, ctx)).toBeNull();
    expect(missing.consumeResetSend).toHaveBeenCalledWith(ctx, "a@x.com");
    expect(missing.sleeps).toEqual([RESET_MIN_RESPONSE_MS]);

    const real: ReturnType<typeof setup> = setup(async () => {
      real.tick(400); // sending the email
      return null;
    });
    expect(await real.guarded({ flow: "reset", email: "a@x.com" }, ctx)).toBeNull();
    expect(real.sleeps).toEqual([RESET_MIN_RESPONSE_MS - 400]);
  });

  test("reset: a slow send isn't padded further; other errors still surface", async () => {
    const slow: ReturnType<typeof setup> = setup(async () => {
      slow.tick(RESET_MIN_RESPONSE_MS + 1);
      throw new Error("EMAIL_SEND_FAILED");
    });
    await expect(slow.guarded({ flow: "reset", email: "a@x.com" }, ctx)).rejects.toThrow("EMAIL_SEND_FAILED");
    expect(slow.sleeps).toEqual([]);
  });

  test("reset: the send limit is taken before looking up the account", async () => {
    const base = vi.fn(async () => null);
    const { guarded, consumeResetSend } = setup(base);
    consumeResetSend.mockRejectedValueOnce(new Error("CODE_RATE_LIMITED"));
    await expect(guarded({ flow: "reset", email: "a@x.com" }, ctx)).rejects.toThrow("CODE_RATE_LIMITED");
    expect(base).not.toHaveBeenCalled();
  });

  test("reset: an invalid email is refused", async () => {
    const { guarded, consumeResetSend } = setup(async () => null);
    await expect(guarded({ flow: "reset", email: "nope" }, ctx)).rejects.toThrow();
    expect(consumeResetSend).not.toHaveBeenCalled();
  });

  test("isMissingAccountError", () => {
    expect(isMissingAccountError(new Error("InvalidAccountId"))).toBe(true);
    expect(isMissingAccountError(new Error("InvalidSecret"))).toBe(false);
    expect(isMissingAccountError("InvalidAccountId")).toBe(false);
  });
});
