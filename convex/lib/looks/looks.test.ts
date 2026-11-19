import { describe, expect, test } from "vitest";
import { GRADIENT_IDS, GRADIENTS } from "./banners";
import { cleanBannerText, cleanLook, lookImageIds } from "./clean";
import { contrast, luminance, mix, normalizeHex, nudgeToContrast, ratioLabel, type Hex } from "./color";
import { hasBlockingProblem, lookProblems, TEXT_MIN } from "./contrast";
import {
  ACCENT_SWATCHES,
  BACKGROUND_SWATCHES,
  FREE_LOOK,
  isFreeLook,
  PRESET_IDS,
  presetLook,
} from "./presets";
import { INK, lookCssVars, mapBannerImage, resolveLook, WHITE } from "./resolve";
import type { StoredLook } from "./validators";
import type { Id } from "../../_generated/dataModel";

const custom = (accent: string, background: string, fill: "solid" | "outline" = "solid"): StoredLook => ({
  v: 1,
  preset: "blush",
  overrides: { colors: { accent, background }, buttons: { shape: "pill", fill, weight: "bold" } },
});

describe("color", () => {
  test("normalizeHex", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("b83260")).toBe("#b83260");
    expect(normalizeHex(" #B83260 ")).toBe("#b83260");
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
  });

  test("luminance and contrast match WCAG", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrast("#ffffff", "#000000")).toBe(contrast("#000000", "#ffffff"));
  });

  test("ratioLabel rounds down", () => {
    expect(ratioLabel(4.499)).toBe("4.49");
    expect(ratioLabel(7)).toBe("7.00");
  });

  test("mix", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  test("nudgeToContrast reaches the target or returns null", () => {
    const fixed = nudgeToContrast("#f2a6b8", WHITE, 4.5);
    expect(fixed).not.toBeNull();
    expect(contrast(fixed as Hex, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(nudgeToContrast("#b83260", WHITE, 4.5)).toBe("#b83260");
    expect(nudgeToContrast("#808080", "#808080", 22)).toBeNull();
  });
});

describe("presets", () => {
  test.each(PRESET_IDS)("%s has no contrast warnings", (id) => {
    expect(lookProblems(resolveLook(presetLook(id)))).toEqual([]);
  });

  test.each(PRESET_IDS)("%s body text passes on every surface", (id) => {
    const { colors: c } = resolveLook(presetLook(id));
    for (const surface of [c.background, c.card, c.muted]) {
      expect(contrast(c.mutedForeground, surface)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(c.foreground, surface)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  test("classic is the free look and keeps today's default colours", () => {
    expect(isFreeLook(FREE_LOOK)).toBe(true);
    const { colors } = resolveLook(FREE_LOOK);
    expect(colors.background).toBe("#fff8f3");
    expect(colors.foreground).toBe(INK);
    expect(colors.chip).toBe(INK);
  });

  test("isFreeLook is false for any change", () => {
    expect(isFreeLook(presetLook("blush"))).toBe(false);
    expect(isFreeLook({ ...FREE_LOOK, overrides: { banner: { kind: "none" } } })).toBe(false);
  });

  test("every accent swatch has a readable label", () => {
    for (const accent of ACCENT_SWATCHES) {
      expect(Math.max(contrast(accent, WHITE), contrast(accent, INK))).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  test("every background swatch gives readable text", () => {
    for (const background of BACKGROUND_SWATCHES) {
      const problems = lookProblems(resolveLook(custom("#1a1412", background)));
      expect(problems.filter((p) => p.target === "text")).toEqual([]);
    }
  });
});

describe("banners", () => {
  test.each(GRADIENT_IDS)("%s text passes on every stop", (id) => {
    const { stops, text } = GRADIENTS[id];
    for (const stop of stops) expect(contrast(text, stop)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

describe("resolveLook", () => {
  test("overrides beat the preset; missing facets use it", () => {
    const look = resolveLook(custom("#0e6e85", "#f1f8fa"));
    expect(look.colors.primary).toBe("#0e6e85");
    expect(look.buttons.shape).toBe("pill");
    expect(look.banner).toMatchObject({ kind: "gradient", height: "md" });
  });

  test("dark backgrounds get light text", () => {
    const look = resolveLook(custom("#e9c46a", "#141113"));
    expect(look.dark).toBe(true);
    expect(contrast(look.colors.foreground, "#141113")).toBeGreaterThan(12);
    expect(look.colors.primaryForeground).toBe(INK);
  });

  test("a photo banner is mapped to its URL, or hidden without one", () => {
    const look = resolveLook({
      ...presetLook("blush"),
      overrides: {
        banner: { kind: "photo", imageId: "img1" as Id<"_storage">, focusX: 50, focusY: 40, zoom: 1, height: "md" },
      },
    });
    expect(mapBannerImage(look, (id) => `https://x/${id}`).banner).toMatchObject({ kind: "photo", image: "https://x/img1" });
    expect(mapBannerImage(look, () => null).banner).toEqual({ kind: "none" });
  });

  test("soft chips stay readable; price falls back to the foreground when the accent is pale", () => {
    for (const id of PRESET_IDS) {
      const { colors: c } = resolveLook(presetLook(id));
      expect(contrast(c.chipSoftForeground, c.chipSoft)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(c.price, c.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
    const pale = resolveLook(custom("#f2a6b8", "#fff8f3"));
    expect(pale.colors.price).toBe(pale.colors.foreground);
  });

  test("css vars set the semantic tokens and button radius", () => {
    const vars = lookCssVars(resolveLook(presetLook("blush")));
    expect(vars["--primary"]).toBe("#b83260");
    expect(vars["--shop-btn-radius"]).toBe("9999px");
  });
});

describe("lookProblems", () => {
  test("a pale accent on a light background warns with a working fix", () => {
    const problems = lookProblems(resolveLook(custom("#f2a6b8", "#fff8f3", "outline")));
    const outline = problems.find((p) => p.target === "chip");
    expect(outline?.level).toBe("block");
    expect(outline?.fix?.field).toBe("accent");
    const fixed = lookProblems(resolveLook(custom(outline?.fix?.value as string, "#fff8f3", "outline")));
    expect(fixed.find((p) => p.target === "chip")).toBeUndefined();
  });

  test("a mid-tone background blocks publishing with a background fix", () => {
    const problems = lookProblems(resolveLook(custom("#1a1412", "#8a7f86")));
    const text = problems.find((p) => p.target === "text");
    expect(text?.level).toBe("block");
    expect(hasBlockingProblem(problems)).toBe(true);
    expect(text?.fix?.field).toBe("background");
    const fixed = lookProblems(resolveLook(custom("#1a1412", text?.fix?.value as string)));
    expect(fixed.find((p) => p.target === "text")).toBeUndefined();
  });

  test("a chip that blends into the background only warns", () => {
    const problems = lookProblems(resolveLook(custom("#e9c46a", "#fff8f3")));
    expect(problems.find((p) => p.target === "chip")?.level).toBe("warn");
    expect(hasBlockingProblem(problems)).toBe(false);
  });
});

describe("cleanLook", () => {
  test("normalizes colours and text", () => {
    const cleaned = cleanLook({
      v: 1,
      preset: "ocean",
      overrides: {
        colors: { accent: "#0E6E85", background: "F1F8FA" },
        banner: { kind: "gradient", gradientId: "aquaShore", height: "lg", text: { value: "  New\n  arrivals ", align: "center" } },
      },
    });
    expect(cleaned?.overrides.colors).toEqual({ accent: "#0e6e85", background: "#f1f8fa" });
    expect(cleaned?.overrides.banner).toMatchObject({ text: { value: "New arrivals", align: "center" } });
  });

  test("drops empty text, rejects long text and bad values", () => {
    expect(cleanBannerText({ value: "   ", align: "start" })).toBeUndefined();
    expect(cleanBannerText({ value: "a".repeat(61), align: "start" })).toBeNull();
    expect(cleanLook(custom("red", "#ffffff"))).toBeNull();
    const photo = (focusX: number, zoom: number): StoredLook => ({
      v: 1,
      preset: "blush",
      overrides: { banner: { kind: "photo", imageId: "i" as Id<"_storage">, focusX, focusY: 50, zoom, height: "sm" } },
    });
    expect(cleanLook(photo(50, 1.5))).not.toBeNull();
    expect(cleanLook(photo(101, 1))).toBeNull();
    expect(cleanLook(photo(50, 3))).toBeNull();
    expect(cleanLook(photo(Number.NaN, 1))).toBeNull();
    expect(lookImageIds(photo(50, 1))).toEqual(["i"]);
    expect(lookImageIds(FREE_LOOK)).toEqual([]);
  });
});
