import { describe, expect, test } from "vitest";
import { STICKER_IDS, STICKERS } from "../../../src/assets/images/stickers/manifest";
import { cleanLook, cleanPromo, withoutPromo } from "./clean";
import { contrast } from "./color";
import { eventTextContrast, hasBlockingProblem, lookProblems, TEXT_MIN } from "./contrast";
import {
  EVENT_FONT_IDS,
  EVENT_PALETTES,
  EVENT_TEMPLATE_IDS,
  EVENT_TEMPLATES,
  PROMO_HEADLINE_MAX,
  PROMO_STICKERS_MAX,
  PROMO_SUBLINE_MAX,
  type EventPaletteId,
} from "./events";
import { resolveLook } from "./resolve";
import { PROMO_MAX_DAYS, promoBoundaries, promoLiveAt, promoStatusAt, scheduleProblem } from "./schedule";
import type { PromoFacet, StoredLook } from "./validators";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 19, 12);

const promo = (patch: Partial<PromoFacet> = {}, design: Partial<PromoFacet["design"]> = {}): PromoFacet => ({
  design: { template: "sale", palette: "hotPink", font: "bold", headline: "Big sale", stickers: ["percentBurst"], ...design },
  height: "md",
  ...patch,
});

const lookWith = (p: PromoFacet): StoredLook => ({
  v: 1,
  preset: "blush",
  overrides: { banner: { kind: "gradient", gradientId: "roseDusk", height: "sm" }, promo: p },
});

describe("event templates", () => {
  test("every template lists 4–6 existing palettes, a font and real stickers", () => {
    expect(EVENT_TEMPLATE_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EVENT_TEMPLATE_IDS)).toEqual(new Set(Object.keys(EVENT_TEMPLATES)));
    for (const id of EVENT_TEMPLATE_IDS) {
      const template = EVENT_TEMPLATES[id];
      expect(template.palettes.length, id).toBeGreaterThanOrEqual(4);
      expect(template.palettes.length, id).toBeLessThanOrEqual(6);
      expect(new Set(template.palettes).size, id).toBe(template.palettes.length);
      for (const p of template.palettes) expect(EVENT_PALETTES[p], `${id}/${p}`).toBeDefined();
      expect(EVENT_FONT_IDS).toContain(template.defaultFont);
      expect(template.defaultStickers.length).toBeLessThanOrEqual(PROMO_STICKERS_MAX);
      for (const s of template.defaultStickers) expect(STICKER_IDS, `${id}/${s}`).toContain(s);
    }
  });

  test("every palette's headline and second line pass 4.5:1 on every background stop", () => {
    for (const [id, palette] of Object.entries(EVENT_PALETTES)) {
      for (const stop of palette.stops) {
        expect(contrast(palette.text, stop), `${id} text on ${stop}`).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrast(palette.subText, stop), `${id} subText on ${stop}`).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    }
  });

  test("every template × palette resolves with zero contrast problems", () => {
    for (const template of EVENT_TEMPLATE_IDS) {
      for (const palette of EVENT_TEMPLATES[template].palettes) {
        const resolved = resolveLook(lookWith(promo({}, { template, palette })));
        expect(resolved.banner.kind).toBe("event");
        expect(lookProblems(resolved).filter((p) => p.target === "eventText"), `${template}/${palette}`).toEqual([]);
      }
    }
  });

  test("a palette that fails is blocked", () => {
    const bad = { ...EVENT_PALETTES.blush, text: "#ffd1df" as const };
    expect(eventTextContrast(bad)).toBeLessThan(3);
    const resolved = resolveLook(lookWith(promo()));
    const problems = lookProblems({ ...resolved, banner: { ...resolved.banner, palette: bad } as typeof resolved.banner });
    expect(hasBlockingProblem(problems)).toBe(true);
  });

  test("sticker manifest ids and files are unique", () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
    expect(new Set(STICKERS.map((s) => s.file)).size).toBe(STICKERS.length);
  });
});

describe("cleanPromo", () => {
  test("trims texts, drops an empty second line and duplicate stickers", () => {
    expect(cleanPromo(promo({}, { headline: "  Big \n sale ", subline: "   ", stickers: ["star", "star"] }))).toEqual({
      design: { template: "sale", palette: "hotPink", font: "bold", headline: "Big sale", subline: undefined, stickers: ["star"] },
      height: "md",
      startsAt: undefined,
      endsAt: undefined,
    });
  });

  test("refuses bad values", () => {
    expect(cleanPromo(promo({}, { headline: "   " }))).toBeNull();
    expect(cleanPromo(promo({}, { headline: "x".repeat(PROMO_HEADLINE_MAX + 1) }))).toBeNull();
    expect(cleanPromo(promo({}, { headline: "x".repeat(PROMO_HEADLINE_MAX) }))).not.toBeNull();
    expect(cleanPromo(promo({}, { subline: "x".repeat(PROMO_SUBLINE_MAX + 1) }))).toBeNull();
    // A palette the template doesn't offer.
    expect(cleanPromo(promo({}, { palette: "emerald" as EventPaletteId }))).toBeNull();
    expect(cleanPromo(promo({}, { stickers: ["nope"] }))).toBeNull();
    expect(cleanPromo(promo({}, { stickers: ["star", "heart", "flower", "sun", "gift"] }))).toBeNull();
    expect(cleanPromo(promo({ startsAt: NOW, endsAt: NOW }))).toBeNull();
    expect(cleanPromo(promo({ startsAt: 1.5 }))).toBeNull();
  });

  test("cleanLook cleans the promo facet; withoutPromo removes it", () => {
    const look = lookWith(promo({}, { headline: " Hi " }));
    expect(cleanLook(look)?.overrides.promo?.design.headline).toBe("Hi");
    expect(cleanLook(lookWith(promo({}, { headline: "" })))).toBeNull();
    expect(withoutPromo(look).overrides).toEqual({ banner: look.overrides.banner });
    expect(resolveLook(withoutPromo(look)).banner.kind).toBe("gradient");
  });
});

describe("schedule", () => {
  test("promoLiveAt and promoStatusAt", () => {
    expect(promoLiveAt(promo(), NOW)).toBe(true);
    expect(promoLiveAt(null, NOW)).toBe(false);
    expect(promoLiveAt(promo({ startsAt: NOW + 1 }), NOW)).toBe(false);
    expect(promoLiveAt(promo({ startsAt: NOW }), NOW)).toBe(true);
    expect(promoLiveAt(promo({ endsAt: NOW }), NOW)).toBe(false);
    expect(promoStatusAt(promo({ startsAt: NOW + 1 }), NOW)).toBe("scheduled");
    expect(promoStatusAt(promo({ endsAt: NOW - 1 }), NOW)).toBe("ended");
    expect(promoStatusAt(promo({ startsAt: NOW - 1, endsAt: NOW + 1 }), NOW)).toBe("live");
  });

  test("scheduleProblem: order, too far, too long; an ended promo is allowed", () => {
    expect(scheduleProblem(promo(), NOW)).toBeNull();
    expect(scheduleProblem(promo({ startsAt: NOW + DAY, endsAt: NOW }), NOW)).toBe("order");
    expect(scheduleProblem(promo({ startsAt: NOW + 400 * DAY }), NOW)).toBe("tooFar");
    expect(scheduleProblem(promo({ endsAt: NOW + (PROMO_MAX_DAYS + 1) * DAY }), NOW)).toBe("tooLong");
    expect(scheduleProblem(promo({ startsAt: NOW + 10 * DAY, endsAt: NOW + 20 * DAY }), NOW)).toBeNull();
    expect(scheduleProblem(promo({ startsAt: NOW - 10 * DAY, endsAt: NOW - DAY }), NOW)).toBeNull();
  });

  test("promoBoundaries: only future times", () => {
    expect(promoBoundaries(promo({ startsAt: NOW - 1, endsAt: NOW + 5 }), NOW)).toEqual([NOW + 5]);
    expect(promoBoundaries(promo({ startsAt: NOW + 1, endsAt: NOW + 5 }), NOW)).toEqual([NOW + 1, NOW + 5]);
    expect(promoBoundaries(undefined, NOW)).toEqual([]);
  });
});
