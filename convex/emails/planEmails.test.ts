import { describe, expect, test } from "vitest";
import { EMAIL_COLORS } from "./layout";
import { planDowngradeEmail, planReceiptEmail, type PlanReceiptValues } from "./templates/planEmails";

const RECEIPT: PlanReceiptValues = {
  kind: "upgrade",
  planName: "Business",
  amount: "Ksh 900",
  credit: { amount: "Ksh 100", planName: "Pro" },
  paidOn: "November 27, 2026",
  reference: "mock_abc123",
  newEnd: "December 27, 2026",
  unlocks: ["Team accounts", "Discount codes"],
  trial: null,
  url: "https://vano.app/dashboard/billing",
};

const NO_IMPACT = {
  sales: 0,
  discountCodes: 0,
  productsHidden: 0,
  look: false,
  sections: false,
  eventBanner: false,
  promoBar: false,
};

describe("planReceiptEmail", () => {
  test("upgrade: plan, amount, credit, date, reference, end date and unlocks", () => {
    const { subject, html, text } = planReceiptEmail("en", RECEIPT);
    expect(subject).toBe("Receipt: you're now on Business");
    expect(text).toContain("Welcome to Business");
    expect(text).toContain("Plan: Business");
    expect(text).toContain("Credit for unused Pro days: −Ksh 100");
    expect(text).toContain("Amount paid: Ksh 900");
    expect(text).toContain("Payment date: November 27, 2026");
    expect(text).toContain("Payment reference: mock_abc123");
    expect(text).toContain("New end date: December 27, 2026");
    expect(text).toContain("Now unlocked\n- Team accounts\n- Discount codes");
    expect(text).toContain("See my plan: https://vano.app/dashboard/billing");
    expect(text).toContain("Nairobi time");
    expect(html).toContain(EMAIL_COLORS.plum);
    expect(html).not.toMatch(/<style|var\(--/);
  });

  test("renewal: same layout, no unlocks; trial lines", () => {
    const renewal = planReceiptEmail("en", { ...RECEIPT, kind: "renewal", planName: "Pro", credit: null, trial: "kept" });
    expect(renewal.subject).toBe("Receipt: Pro renewed until December 27, 2026");
    expect(renewal.text).toContain("Pro is renewed");
    expect(renewal.text).toContain("Your free trial days were kept");
    expect(renewal.text).not.toContain("Now unlocked");
    expect(renewal.text).not.toContain("Credit");

    const ended = planReceiptEmail("en", { ...RECEIPT, trial: "ended" });
    expect(ended.text).toContain("Your free trial ended today because Business starts now.");
  });

  test("FR, masked phone, escaped values", () => {
    const fr = planReceiptEmail("fr", { ...RECEIPT, paidFrom: "+254712345678", reference: "<b>ref</b>" });
    expect(fr.subject).toBe("Reçu : vous êtes maintenant sur Business");
    expect(fr.text).toContain("Payé depuis: +254 ••• ••• 678");
    expect(fr.text).not.toContain("712345");
    expect(fr.html).not.toContain("712345");
    expect(fr.html).toContain("&lt;b&gt;ref&lt;/b&gt;");
    expect(fr.html).toContain('lang="fr"');
  });
});

describe("planDowngradeEmail", () => {
  const base = {
    planName: "Business",
    targetName: "Free",
    freeName: "Free",
    date: "December 27, 2026",
    freeDate: "December 30, 2026",
    target: { paid: false } as const,
    impact: { ...NO_IMPACT, sales: 2, discountCodes: 1, look: true },
    keepUrl: "https://vano.app/dashboard/billing?keep=abc",
  };

  test("not a payment, end date, what pauses, data kept, Keep my plan", () => {
    const { subject, text, html } = planDowngradeEmail("en", base);
    expect(subject).toBe("Confirmed: your shop moves to Free on December 27, 2026");
    expect(text).toContain("This is not a payment: nothing was charged.");
    expect(text).toContain("You keep Business until December 27, 2026");
    expect(text).toContain("Your shop moves to Free on: December 30, 2026");
    expect(text).toContain("2 running sales stop");
    expect(text).toContain("1 discount code stops working");
    expect(text).toContain("Your shop look goes back to Classic");
    expect(text).toContain("Your data is kept");
    expect(text).toContain("Keep my plan: https://vano.app/dashboard/billing?keep=abc");
    expect(html).toContain('href="https://vano.app/dashboard/billing?keep=abc"');
  });

  test("a paid target names its real price; nothing to pause says so; FR", () => {
    const paid = planDowngradeEmail("en", {
      ...base,
      targetName: "Pro",
      target: { paid: true, price: "Ksh 299", days: 30 },
      impact: NO_IMPACT,
    });
    expect(paid.text).toContain("Get Pro (Ksh 299 for 30 days)");
    expect(paid.text).toContain("Nothing you use right now will pause.");

    const fr = planDowngradeEmail("fr", { ...base, date: "27 décembre 2026", freeDate: "30 décembre 2026" });
    expect(fr.subject).toBe("Confirmé : votre boutique passe à Free le 27 décembre 2026");
    expect(fr.text).toContain("Garder mon forfait: https://vano.app/dashboard/billing?keep=abc");
  });
});
