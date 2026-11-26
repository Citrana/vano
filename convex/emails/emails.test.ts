import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { newTest } from "../lib/test.utils";
import { maskEmail } from "./address";
import { EMAIL_MAX_ATTEMPTS, retryDelay } from "./config";
import { EMAIL_COLORS, escapeHtml, renderEmail } from "./layout";
import { activeEmailProviderId, emailMode } from "./registry";
import { resendProvider } from "./resend";
import { sendEmail } from "./send";
import { testEmail } from "./templates/test";
import { fill } from "./texts";

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

const RESEND = { RESEND_API_KEY: "re_test", EMAIL_FROM: "Vano <hello@vano.app>" };
const email = { to: "amani@gmail.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", idempotencyKey: "k1" };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  setEnv({});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  setEnv({});
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("layout", () => {
  test("EN and FR texts, plum brand bar, plain-text version", () => {
    const en = testEmail("en", { sentAt: Date.UTC(2026, 10, 26, 9, 30) });
    const fr = testEmail("fr", { sentAt: Date.UTC(2026, 10, 26, 9, 30) });
    expect(en.subject).toBe("Vano test email");
    expect(fr.subject).toBe("E-mail de test Vano");
    expect(en.html).toContain('lang="en"');
    expect(fr.html).toContain('lang="fr"');
    expect(fr.html).toContain("L&#39;envoi d&#39;e-mails fonctionne");
    expect(en.html).toContain(EMAIL_COLORS.plum);
    expect(en.html).not.toMatch(/<style|var\(--/);
    expect(en.text).toContain("Sent on 2026-11-26 09:30 (UTC).");
    expect(fr.text).toContain("Envoyé le 2026-11-26 09:30 (UTC).");
    expect(en.text).not.toContain("<");
  });

  test("escapes every value and only links http(s) buttons", () => {
    const { html, text } = renderEmail({
      language: "en",
      preheader: "<b>pre</b>",
      heading: "<script>x</script>",
      paragraphs: ['A "quote" & <tag>'],
      button: { label: "Open", url: "https://vano.app/?a=1&b=2" },
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &quot;quote&quot; &amp; &lt;tag&gt;");
    expect(html).toContain('href="https://vano.app/?a=1&amp;b=2"');
    expect(text).toContain("Open: https://vano.app/?a=1&b=2");

    const bad = renderEmail({ language: "en", preheader: "", heading: "h", paragraphs: [], button: { label: "X", url: "javascript:alert(1)" } });
    expect(bad.html).not.toContain("javascript:");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  test("helpers", () => {
    expect(fill("Hi {name}, {missing}", { name: "Amani" })).toBe("Hi Amani, {missing}");
    expect(maskEmail("amani@gmail.com")).toBe("a•••@gmail.com");
    expect(maskEmail("nope")).toBe("•••");
    expect(retryDelay(0)).toBe(30_000);
    expect(retryDelay(99)).toBe(30 * 60_000);
  });
});

describe("registry", () => {
  test("log mode unless both the key and the sender are set", () => {
    expect(activeEmailProviderId()).toBe("log");
    expect(emailMode()).toEqual({ provider: "log", from: null });
    setEnv({ RESEND_API_KEY: "re_test" });
    expect(activeEmailProviderId()).toBe("log");
    setEnv({ EMAIL_FROM: "Vano <hello@vano.app>" });
    expect(activeEmailProviderId()).toBe("log");
    setEnv(RESEND);
    expect(emailMode()).toEqual({ provider: "resend", from: "Vano <hello@vano.app>" });
  });
});

describe("resend provider", () => {
  test("posts the email with the key, sender and idempotency key", async () => {
    setEnv({ ...RESEND, EMAIL_REPLY_TO: "help@vano.app" });
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: "msg_1" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resendProvider.send(email)).toEqual({ ok: true, providerMessageId: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "k1" });
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Vano <hello@vano.app>",
      to: ["amani@gmail.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      reply_to: "help@vano.app",
    });
  });

  test.each([
    [429, true],
    [500, true],
    [503, true],
    [401, false],
    [422, false],
  ])("status %i → retryable %s", async (status, retryable) => {
    setEnv(RESEND);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { message: "nope" })));
    expect(await resendProvider.send(email)).toMatchObject({ ok: false, retryable });
  });

  test("a network error is retryable, a missing config is not", async () => {
    setEnv(RESEND);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await resendProvider.send(email)).toMatchObject({ ok: false, retryable: true });
    setEnv({});
    expect(await resendProvider.send(email)).toMatchObject({ ok: false, retryable: false });
  });
});

describe("sendEmail + deliver", () => {
  const queue = (to = "Amani@Gmail.com ") =>
    async (ctx: Parameters<typeof sendEmail>[0]) => sendEmail(ctx, { to, subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

  test("log mode: written to the log, nothing fetched", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = newTest();
    await t.run(queue());
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("a•••@gmail.com"));
  });

  test("rejects a bad address before scheduling anything", async () => {
    const t = newTest();
    await expect(t.run(queue("not-an-email"))).rejects.toThrow(/EMAIL_INVALID/);
  });

  test("retries temporary failures with the same key, then succeeds", async () => {
    vi.useFakeTimers();
    setEnv(RESEND);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValue(jsonResponse(200, { id: "msg_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const t = newTest();
    await t.run(queue());
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const keys = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  test("gives up after EMAIL_MAX_ATTEMPTS, never throws", async () => {
    vi.useFakeTimers();
    setEnv(RESEND);
    const fetchMock = vi.fn(async () => jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);
    const t = newTest();
    await t.run(queue());
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(EMAIL_MAX_ATTEMPTS);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("gave up"));
  });

  test("a permanent failure is not retried", async () => {
    vi.useFakeTimers();
    setEnv(RESEND);
    const fetchMock = vi.fn(async () => jsonResponse(422, { message: "domain not verified" }));
    vi.stubGlobal("fetch", fetchMock);
    const t = newTest();
    await t.action(internal.emails.send.deliver, { ...email, attempt: 0 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("resend 422"));
  });
});
