import { describe, expect, test } from "vitest";
import { renderEmail } from "./layout";
import { trialLastDaysEmail, trialSoonEmail } from "./templates/trialReminders";

const COMMON = { planName: "Pro", freeName: "Free", url: "https://vano.app/dashboard/billing" };

describe("email layout lists", () => {
  test("titled lists are escaped in HTML, dashed in text, empty ones skipped", () => {
    const { html, text } = renderEmail({
      language: "en",
      preheader: "p",
      heading: "h",
      paragraphs: [],
      lists: [
        { title: "Kept <b>", items: ["A & B"] },
        { title: "Empty", items: [] },
      ],
    });
    expect(html).toContain("Kept &lt;b&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("Empty");
    expect(text).toContain("Kept <b>\n- A & B");
    expect(text).not.toContain("Empty");
  });
});

describe("trial reminder templates", () => {
  test("2 days: 'tomorrow' wording for one day, no price when none is set, only paused parts listed", () => {
    const { subject, text } = trialLastDaysEmail("en", {
      ...COMMON,
      days: 1,
      date: "November 27, 2026",
      graceDays: 3,
      pauses: { offers: false, looks: true, stats: false, productsHidden: 1, productLimit: 10 },
      price: null,
    });
    expect(subject).toBe("Your Pro trial ends tomorrow");
    expect(text).toContain("- Extra shop looks");
    expect(text).not.toContain("Offers");
    expect(text).toContain("1 product over the Free limit of 10 is hidden from your shop");
    expect(text).toContain("Keep Pro: https://vano.app/dashboard/billing");
  });

  test("7 days in French: singular numbers, card lines passed in", () => {
    const { subject, text } = trialSoonEmail("fr", {
      ...COMMON,
      freeName: "Gratuit",
      days: 7,
      date: "3 décembre 2026",
      built: { products: 1, shopViews: 0, whatsappClicks: 1 },
      keep: ["Jusqu'à 10 produits"],
    });
    expect(subject).toBe("Plus que 7 jours d'essai Pro");
    expect(text).toContain("- 1 produit dans votre boutique");
    expect(text).toContain("- 1 clic sur Commander sur WhatsApp");
    expect(text).not.toContain("visite");
    expect(text).toContain("Ce que vous gardez avec Gratuit\n- Jusqu'à 10 produits");
  });
});
