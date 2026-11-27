import { describe, expect, test, vi } from "vitest";
import { RESET_MIN_RESPONSE_MS, SIGNIN_FAILURE_MIN_MS, SIGNUP_MIN_RESPONSE_MS } from "./authCodes";
import { guardAuthorize, isCredentialsError, isMissingAccountError, type SignupDeps } from "./authFlows";

// Convex Auth's ctx isn't used by the guard itself.
const ctx = {} as never;
const ok = { userId: "u1" as never };

type Base = (params: Record<string, unknown>) => Promise<typeof ok | null>;
type State = Awaited<ReturnType<SignupDeps["state"]>>;

function setup(base: Base, state: State = { allowed: true, account: null }) {
  let clock = 0;
  const sleeps: number[] = [];
  const consumeResetSend = vi.fn(async () => {});
  const signup = {
    consumeAttempt: vi.fn(async () => {}),
    state: vi.fn(async () => state),
    passwordMatches: vi.fn(async () => false),
    sendAccountExists: vi.fn(async () => {}),
  };
  const baseFn = vi.fn(base);
  const guarded = guardAuthorize(baseFn as never, {
    consumeResetSend,
    signup,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { guarded, base: baseFn, consumeResetSend, signup, sleeps, tick: (ms: number) => (clock += ms) };
}

const signUpParams = { flow: "signUp", email: " A@X.com ", password: "password1", language: "fr" };

describe("guardAuthorize: signUp never reveals an existing account", () => {
  test("a new email goes to Convex Auth (account + code), padded", async () => {
    const s: ReturnType<typeof setup> = setup(async () => {
      s.tick(300);
      return null;
    });
    expect(await s.guarded(signUpParams, ctx)).toBeNull();
    expect(s.base).toHaveBeenCalledWith({ ...signUpParams, email: "a@x.com" }, ctx);
    expect(s.signup.sendAccountExists).not.toHaveBeenCalled();
    expect(s.sleeps).toEqual([SIGNUP_MIN_RESPONSE_MS - 300]);
  });

  test("a registered email gets the same answer and time, and its owner an email instead of a code", async () => {
    const s: ReturnType<typeof setup> = setup(async () => ok, { allowed: true, account: { verified: true } });
    s.signup.sendAccountExists.mockImplementation(async () => {
      s.tick(300);
    });
    expect(await s.guarded(signUpParams, ctx)).toBeNull();
    expect(s.base).not.toHaveBeenCalled();
    expect(s.signup.sendAccountExists).toHaveBeenCalledWith(ctx, "a@x.com");
    expect(s.sleeps).toEqual([SIGNUP_MIN_RESPONSE_MS - 300]);
    // A verified owner's password is never tried (their sign-in budget stays intact).
    expect(s.signup.passwordMatches).not.toHaveBeenCalled();
  });

  test("someone else's pending account gets the email too", async () => {
    const s = setup(async () => ok, { allowed: true, account: { verified: false } });
    expect(await s.guarded(signUpParams, ctx)).toBeNull();
    expect(s.signup.passwordMatches).toHaveBeenCalledWith(ctx, "a@x.com", "password1");
    expect(s.signup.sendAccountExists).toHaveBeenCalledOnce();
    expect(s.base).not.toHaveBeenCalled();
  });

  test("signing up again on your own pending account is a resend (a new code)", async () => {
    const s = setup(async () => null, { allowed: true, account: { verified: false } });
    s.signup.passwordMatches.mockResolvedValueOnce(true);
    expect(await s.guarded(signUpParams, ctx)).toBeNull();
    expect(s.base).toHaveBeenCalledWith({ ...signUpParams, email: "a@x.com", flow: "signIn" }, ctx);
    expect(s.signup.sendAccountExists).not.toHaveBeenCalled();
  });

  test("an account created meanwhile (race) answers like a registered email", async () => {
    const s = setup(async () => {
      throw new Error("Account a@x.com already exists");
    });
    expect(await s.guarded(signUpParams, ctx)).toBeNull();
    expect(s.signup.sendAccountExists).toHaveBeenCalledWith(ctx, "a@x.com");
  });

  test("the attempt budget is taken first, for every address", async () => {
    const s = setup(async () => null, { allowed: true, account: { verified: true } });
    s.signup.consumeAttempt.mockRejectedValueOnce(new Error("CODE_RATE_LIMITED"));
    await expect(s.guarded(signUpParams, ctx)).rejects.toThrow("CODE_RATE_LIMITED");
    expect(s.signup.consumeAttempt).toHaveBeenCalledWith(ctx, "a@x.com");
    expect(s.signup.state).not.toHaveBeenCalled();
    expect(s.signup.sendAccountExists).not.toHaveBeenCalled();
  });

  test("closed sign-up is refused alike for new and registered emails", async () => {
    for (const account of [null, { verified: true }]) {
      const s = setup(async () => null, { allowed: false, account });
      await expect(s.guarded(signUpParams, ctx)).rejects.toThrow(/SIGNUP_DISABLED/);
      expect(s.base).not.toHaveBeenCalled();
      expect(s.signup.sendAccountExists).not.toHaveBeenCalled();
      expect(s.sleeps).toEqual([SIGNUP_MIN_RESPONSE_MS]);
    }
  });

  test("passes a well-formed invite token to the sign-up check, ignores anything else", async () => {
    const token = "a".repeat(64);
    const s = setup(async () => null);
    await s.guarded({ ...signUpParams, invite: token }, ctx);
    await s.guarded({ ...signUpParams, invite: "nope" }, ctx);
    expect(s.signup.state.mock.calls.map((c) => (c as unknown[])[2])).toEqual([token, undefined]);
  });

  test("a bad email or short password is refused before anything is used or looked up", async () => {
    const s = setup(async () => null);
    await expect(s.guarded({ ...signUpParams, email: "nope" }, ctx)).rejects.toThrow(/EMAIL_INVALID/);
    await expect(s.guarded({ ...signUpParams, password: "short" }, ctx)).rejects.toThrow(/PASSWORD_TOO_SHORT/);
    expect(s.signup.consumeAttempt).not.toHaveBeenCalled();
  });
});

describe("guardAuthorize: codes and sign-in stay generic", () => {
  test("email-verification needs a code", async () => {
    const s = setup(async () => ok);
    await expect(s.guarded({ flow: "email-verification", email: "a@x.com" }, ctx)).rejects.toThrow(/CODE_INVALID/);
    await expect(s.guarded({ flow: "email-verification", email: "a@x.com", code: "" }, ctx)).rejects.toThrow();
    expect(s.base).not.toHaveBeenCalled();
    expect(await s.guarded({ flow: "email-verification", email: "a@x.com", code: "123456" }, ctx)).toBe(ok);
  });

  test("a wrong code and an email with no account both read CODE_INVALID, padded", async () => {
    for (const message of ["Could not verify code", "InvalidAccountId"]) {
      const s = setup(async () => {
        throw new Error(message);
      });
      await expect(s.guarded({ flow: "email-verification", email: "a@x.com", code: "123456" }, ctx)).rejects.toThrow(
        /CODE_INVALID/,
      );
      expect(s.sleeps).toEqual([SIGNIN_FAILURE_MIN_MS]);
    }
  });

  test("sign-in: wrong password, unknown email and a locked account all read INVALID_CREDENTIALS, padded", async () => {
    for (const message of ["InvalidSecret", "InvalidAccountId", "TooManyFailedAttempts", "Invalid credentials"]) {
      const s = setup(async () => {
        throw new Error(message);
      });
      await expect(s.guarded({ flow: "signIn", email: "a@x.com", password: "p" }, ctx)).rejects.toThrow(
        /INVALID_CREDENTIALS/,
      );
      expect(s.sleeps).toEqual([SIGNIN_FAILURE_MIN_MS]);
    }
  });

  test("a successful sign-in isn't slowed; other errors still surface", async () => {
    const s = setup(async () => ok);
    const params = { flow: "signIn", email: "A@x.com", password: "p" };
    expect(await s.guarded(params, ctx)).toBe(ok);
    expect(s.base).toHaveBeenCalledWith(params, ctx);
    expect(s.sleeps).toEqual([]);
    expect(s.consumeResetSend).not.toHaveBeenCalled();

    const suspended = setup(async () => {
      throw new Error("ACCOUNT_SUSPENDED");
    });
    await expect(suspended.guarded(params, ctx)).rejects.toThrow("ACCOUNT_SUSPENDED");
  });
});

describe("guardAuthorize: reset", () => {
  test("a missing account answers like a real one, both padded to the minimum time", async () => {
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

  test("a slow send isn't padded further; other errors still surface", async () => {
    const slow: ReturnType<typeof setup> = setup(async () => {
      slow.tick(RESET_MIN_RESPONSE_MS + 1);
      throw new Error("EMAIL_SEND_FAILED");
    });
    await expect(slow.guarded({ flow: "reset", email: "a@x.com" }, ctx)).rejects.toThrow("EMAIL_SEND_FAILED");
    expect(slow.sleeps).toEqual([]);
  });

  test("the send limit is taken before looking up the account", async () => {
    const s = setup(async () => null);
    s.consumeResetSend.mockRejectedValueOnce(new Error("CODE_RATE_LIMITED"));
    await expect(s.guarded({ flow: "reset", email: "a@x.com" }, ctx)).rejects.toThrow("CODE_RATE_LIMITED");
    expect(s.base).not.toHaveBeenCalled();
  });

  test("an invalid email is refused", async () => {
    const s = setup(async () => null);
    await expect(s.guarded({ flow: "reset", email: "nope" }, ctx)).rejects.toThrow();
    expect(s.consumeResetSend).not.toHaveBeenCalled();
  });
});

describe("error helpers", () => {
  test("isMissingAccountError", () => {
    expect(isMissingAccountError(new Error("InvalidAccountId"))).toBe(true);
    expect(isMissingAccountError(new Error("InvalidSecret"))).toBe(false);
    expect(isMissingAccountError("InvalidAccountId")).toBe(false);
  });

  test("isCredentialsError", () => {
    expect(isCredentialsError(new Error("InvalidSecret"))).toBe(true);
    expect(isCredentialsError(new Error("TooManyFailedAttempts"))).toBe(true);
    expect(isCredentialsError(new Error("ACCOUNT_SUSPENDED"))).toBe(false);
  });
});
