import { describe, expect, test } from "vitest";
import { ERROR_CODES } from "../../convex/lib/errors";
import { CATEGORY_KEYS } from "../../convex/lib/catalog";
import { CURRENCIES } from "../../convex/lib/money";
import { DEFAULT_PLAN_CONFIG } from "../../convex/lib/planDefaults";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { localeFromAcceptLanguage, resolveLocale } from "./locale";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  test("en and fr have exactly the same keys", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  test("no empty translations", () => {
    for (const messages of [en, fr]) {
      const flat = keys(messages);
      for (const key of flat) {
        const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages);
        expect(value, key).not.toBe("");
      }
    }
  });

  test("every error code, category and currency is translated", () => {
    for (const code of ERROR_CODES) expect(en.Errors).toHaveProperty(code);
    for (const key of CATEGORY_KEYS) expect(en.Categories).toHaveProperty(key);
    for (const key of CURRENCIES) expect(en.Currencies).toHaveProperty(key);
  });
});

/**
 * Billing and plan texts get plan names, the grace days and the period
 * length passed in (admins rename plans; the numbers live in code), so
 * none may be written into the text itself.
 */
const PLAN_TEXT_KEYS = [
  "Billing.change.downgradeFreeNote",
  "Billing.change.downgradePaidNote",
  "Billing.change.renewBody",
  "Billing.bannerGrace",
  "Billing.graceUntil",
  "Notifications.types.plan.inGrace",
  "Notifications.types.plan.trialProOnly",
  "Pricing.metaDescription",
  "Pricing.faq.a3",
  "Help.groups.pricing.a3",
  "Features.canLooksNote",
  "AdminPlans.trialHelp",
  "AdminPlans.trialTagHelp",
];

describe("plan texts", () => {
  const names = Object.values(DEFAULT_PLAN_CONFIG.plans).flatMap((p) => [p.name.en, p.name.fr]);
  // Placeholders and ICU branches ({plan}, {days, plural, …}) are dropped first.
  const outsidePlaceholders = (text: string) => text.replace(/\{[a-z]+(, (plural|select), )?/gi, " ").replace(/[{}#]/g, " ");

  test("no plan name, grace or period number is written into the text", () => {
    for (const messages of [en, fr]) {
      for (const key of PLAN_TEXT_KEYS) {
        const text = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages) as string;
        expect(typeof text, key).toBe("string");
        const words = outsidePlaceholders(text);
        for (const name of names) expect(words, `${key}: ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
        expect(words, key).not.toMatch(/\b(3|30)\b/);
      }
    }
  });
});

describe("locale", () => {
  test("Accept-Language negotiation", () => {
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeFromAcceptLanguage("fr-CD,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(localeFromAcceptLanguage("sw-KE,en;q=0.5,fr;q=0.7")).toBe("fr");
    expect(localeFromAcceptLanguage("de-DE,es;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("en-US;q=0,fr")).toBe("fr");
  });

  test("cookie wins over the header", () => {
    expect(resolveLocale("fr", "en-US")).toBe("fr");
    expect(resolveLocale("de", "fr")).toBe("fr");
    expect(resolveLocale(undefined, null)).toBe("en");
  });
});
