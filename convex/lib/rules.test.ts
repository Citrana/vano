import { describe, expect, test } from "vitest";
import { cleanTags, tagsProblem } from "./catalog";
import { normalizeEmail, passwordProblem } from "./credentials";
import { announcementProblem } from "./settings";
import { addDays, isDay, utcDay } from "./days";
import { imageProblem, MAX_IMAGE_BYTES } from "./images";
import { formatMoney, minorToInput, parseMoneyToMinor, priceProblem } from "./money";
import { allStepsDone, onboardingSteps } from "./onboarding";
import { normalizeWhatsapp, splitWhatsapp, waDigits } from "./phone";
import { slugify, slugProblem } from "./slug";

describe("slug", () => {
  test.each([
    ["chez-amani", null],
    ["abc", null],
    ["a".repeat(30), null],
    ["ab", "length"],
    ["a".repeat(31), "length"],
    ["Chez-Amani", "format"],
    ["chez_amani", "format"],
    ["-chez", "format"],
    ["chez--amani", "format"],
    ["chez-", "format"],
    ["dashboard", "reserved"],
    ["admin", "reserved"],
    ["api", "reserved"],
    ["login", "reserved"],
    ["signup", "reserved"],
    ["settings", "reserved"],
  ])("slugProblem(%s) = %s", (slug, expected) => {
    expect(slugProblem(slug)).toBe(expected);
  });

  test("slugify", () => {
    expect(slugify("Chez Amani – Mode!")).toBe("chez-amani-mode");
    expect(slugify("Élégance Bébé")).toBe("elegance-bebe");
    expect(slugify("  --  ")).toBe("");
    expect(slugify("a".repeat(29) + " bcd")).toBe("a".repeat(29));
  });
});

describe("phone", () => {
  test("normalizes international and national numbers", () => {
    expect(normalizeWhatsapp("+243 812 345 678")).toBe("+243812345678");
    expect(normalizeWhatsapp("0812345678", "CD")).toBe("+243812345678");
    expect(normalizeWhatsapp("+254 712 345 678")).toBe("+254712345678");
  });
  test("rejects invalid numbers", () => {
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("0812345678")).toBeNull(); // no country code
    expect(normalizeWhatsapp("+243 1")).toBeNull();
  });
  test("a number from another country than the shop's", () => {
    // Shop in Congo, Kenyan WhatsApp picked with the dial-code select.
    expect(normalizeWhatsapp("712 345 678", "KE")).toBe("+254712345678");
    expect(normalizeWhatsapp("+254712345678", "CD")).toBe("+254712345678");
  });
  test("splitWhatsapp gives the dial country and the national part", () => {
    expect(splitWhatsapp("+254712345678", "CD")).toEqual({ country: "KE", national: "0712 345678" });
    expect(splitWhatsapp("+243812345678", "CD").country).toBe("CD");
    expect(splitWhatsapp("+33612345678", "CD").country).toBe("FR");
    expect(splitWhatsapp("", "CD")).toEqual({ country: "CD", national: "" });
  });
  test("waDigits", () => {
    expect(waDigits("+243812345678")).toBe("243812345678");
  });
});

describe("money", () => {
  test.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["1,234.56", 123456],
    ["12,5", 1250],
    ["25 000", 2500000],
    ["-1", null],
    ["1.234", null],
    ["abc", null],
    ["", null],
  ])("parseMoneyToMinor(%s) = %s", (input, expected) => {
    expect(parseMoneyToMinor(input)).toBe(expected);
  });

  test("minorToInput", () => {
    expect(minorToInput(1250)).toBe("12.50");
    expect(minorToInput(1200)).toBe("12");
    expect(minorToInput(5)).toBe("0.05");
  });

  test("formatMoney drops decimals for whole amounts", () => {
    expect(formatMoney(2500, "USD", "en")).toBe("$25");
    expect(formatMoney(2550, "USD", "en")).toBe("$25.50");
    expect(formatMoney(2500000, "CDF", "fr")).toMatch(/25\s000/);
  });

  test("priceProblem", () => {
    expect(priceProblem(100)).toBeNull();
    expect(priceProblem(0)).toBe("notPositive");
    expect(priceProblem(1.5)).toBe("notInteger");
    expect(priceProblem(1e15)).toBe("tooHigh");
  });
});

describe("tags", () => {
  test("cleanTags trims and dedupes case-insensitively", () => {
    expect(cleanTags([" M ", "m", "", "L  XL"])).toEqual(["M", "L XL"]);
  });
  test("tagsProblem", () => {
    expect(tagsProblem(["S"])).toBeNull();
    expect(tagsProblem(Array.from({ length: 21 }, (_, i) => `${i}`))).toBe("tooMany");
    expect(tagsProblem(["x".repeat(21)])).toBe("tooLong");
  });
});

describe("images", () => {
  test("imageProblem", () => {
    expect(imageProblem(null)).toBe("missing");
    expect(imageProblem({ contentType: "application/pdf", size: 10 })).toBe("type");
    expect(imageProblem({ size: 10 })).toBe("type");
    expect(imageProblem({ contentType: "image/webp", size: MAX_IMAGE_BYTES + 1 })).toBe("size");
    expect(imageProblem({ contentType: "image/jpeg", size: 300_000 })).toBeNull();
  });
});

describe("days", () => {
  test("utcDay / addDays / isDay", () => {
    expect(utcDay(Date.UTC(2026, 10, 17, 23, 59))).toBe("2026-11-17");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("nope")).toBe(false);
  });
});

describe("credentials", () => {
  test.each([
    ["  Amani@Example.COM ", "amani@example.com"],
    ["a@b.co", "a@b.co"],
    ["no-at-sign.com", null],
    ["a@b", null],
    ["a b@c.com", null],
    ["", null],
    [undefined, null],
  ])("normalizeEmail(%s) = %s", (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  test("passwordProblem", () => {
    expect(passwordProblem("1234567")).toBe("too_short");
    expect(passwordProblem("12345678")).toBeNull();
  });
});

describe("announcementProblem", () => {
  test.each([
    [{ en: "", fr: "" }, null],
    [{ en: "  ", fr: " " }, null],
    [{ en: "Maintenance tonight", fr: "Maintenance ce soir" }, null],
    [{ en: "Maintenance tonight", fr: "" }, "both_required"],
    [{ en: "", fr: "Maintenance ce soir" }, "both_required"],
    [{ en: "x".repeat(281), fr: "ok" }, "too_long"],
    [{ en: "x".repeat(280), fr: "y".repeat(280) }, null],
  ])("%j → %s", (announcement, expected) => {
    expect(announcementProblem(announcement)).toBe(expected);
  });
});

describe("onboarding", () => {
  test("new shop: only the first step is done", () => {
    const steps = onboardingSteps({ productCount: 0, theme: undefined, linkSharedAt: undefined });
    expect(steps).toEqual([
      { key: "created", done: true },
      { key: "product", done: false },
      { key: "look", done: false },
      { key: "share", done: false },
    ]);
    expect(allStepsDone(steps)).toBe(false);
  });

  test("all done with a product, a look and a shared link", () => {
    const steps = onboardingSteps({ productCount: 2, theme: "soft", linkSharedAt: 1 });
    expect(allStepsDone(steps)).toBe(true);
  });
});

describe("change requests", () => {
  test("cleanNewValue normalizes and spots invalid, reserved and same values", async () => {
    const { cleanNewValue } = await import("./changeRequests");
    expect(cleanNewValue("name", "  Maison   Amani ", "Chez Amani")).toEqual({ value: "Maison Amani" });
    expect(cleanNewValue("name", "A", "Chez Amani")).toEqual({ problem: "invalid" });
    expect(cleanNewValue("name", "Chez Amani ", "Chez Amani")).toEqual({ problem: "same" });
    expect(cleanNewValue("slug", "maison-amani", "chez-amani")).toEqual({ value: "maison-amani" });
    expect(cleanNewValue("slug", "admin", "chez-amani")).toEqual({ problem: "reserved" });
    expect(cleanNewValue("slug", "Maison Amani", "chez-amani")).toEqual({ problem: "invalid" });
    expect(cleanNewValue("whatsapp", "+243 899 000 111", "+243812345678")).toEqual({ value: "+243899000111" });
    expect(cleanNewValue("whatsapp", "+243 812 345 678", "+243812345678")).toEqual({ problem: "same" });
    expect(cleanNewValue("whatsapp", "0899", "+243812345678")).toEqual({ problem: "invalid" });
  });

  test("cooldown, reasons and masked phones", async () => {
    const { inCooldown, reasonProblem, maskPhone, CHANGE_COOLDOWN_DAYS } = await import("./changeRequests");
    const day = 86_400_000;
    expect(inCooldown(null, 0)).toBe(false);
    expect(inCooldown(0, (CHANGE_COOLDOWN_DAYS - 1) * day)).toBe(true);
    expect(inCooldown(0, CHANGE_COOLDOWN_DAYS * day)).toBe(false);
    expect(reasonProblem("too short")).toBe("length");
    expect(reasonProblem("x".repeat(20))).toBeNull();
    expect(reasonProblem("x".repeat(501))).toBe("length");
    expect(maskPhone("+243812345678")).toBe("+243 ••• ••• 678");
  });

  test("riskyValueMatch flags brands, ignores look-alike words", async () => {
    const { riskyValueMatch } = await import("./protectedNames");
    expect(riskyValueMatch("Gucci Goma")).toBe("gucci");
    expect(riskyValueMatch("louis-vuitton-kinshasa")).toBe("louis vuitton");
    expect(riskyValueMatch("guccishop")).toBe("gucci");
    expect(riskyValueMatch("Nike Store")).toBe("nike");
    expect(riskyValueMatch("WhatsApp Deals")).toBe("whatsapp");
    expect(riskyValueMatch("M-Pesa Mode")).toBe("mpesa");
    expect(riskyValueMatch("canvas-bags")).toBeNull();
    expect(riskyValueMatch("Metallic Style")).toBeNull();
    expect(riskyValueMatch("Chez Amani")).toBeNull();
  });
});
