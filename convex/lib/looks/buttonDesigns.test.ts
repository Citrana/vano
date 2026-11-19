import { describe, expect, test } from "vitest";
import { BUTTON_DESIGNS, DESIGN_DECORATION } from "./buttonDesigns";
import { cleanLook } from "./clean";
import { lookProblems } from "./contrast";
import { ACCENT_SWATCHES, BACKGROUND_SWATCHES, PRESET_IDS, presetLook } from "./presets";
import { lookCssVars, resolveLook } from "./resolve";
import type { StoredLook } from "./validators";

const withButtons = (buttons: NonNullable<StoredLook["overrides"]["buttons"]>, preset: StoredLook["preset"] = "blush"): StoredLook => ({
  v: 1,
  preset,
  overrides: { buttons },
});

describe("button designs", () => {
  test("old looks resolve to Classic, no icon, the WhatsApp label", () => {
    expect(resolveLook(presetLook("blush")).buttons).toMatchObject({ design: "classic", decoration: "none", label: "order" });
  });

  test("a design brings its own icon unless the seller picks one", () => {
    const base = { shape: "pill", fill: "solid", weight: "bold" } as const;
    for (const design of BUTTON_DESIGNS) {
      expect(resolveLook(withButtons({ ...base, design })).buttons.decoration).toBe(DESIGN_DECORATION[design]);
    }
    expect(resolveLook(withButtons({ ...base, design: "floral", decoration: "heart" })).buttons.decoration).toBe("heart");
    expect(resolveLook(withButtons({ ...base, design: "heart", decoration: "none" })).buttons.decoration).toBe("none");
  });

  test("cleanLook keeps the new fields and drops defaults", () => {
    const look = withButtons({ shape: "pill", fill: "solid", weight: "bold", design: "bow", decoration: "star", label: "want" });
    expect(cleanLook(look)?.overrides.buttons).toEqual({ shape: "pill", fill: "solid", weight: "bold", design: "bow", decoration: "star", label: "want" });
    const defaults = withButtons({ shape: "pill", fill: "solid", weight: "bold", design: "classic", label: "order" });
    expect(cleanLook(defaults)?.overrides.buttons).toEqual({ shape: "pill", fill: "solid", weight: "bold" });
  });

  test("every preset with every design has zero contrast warnings", () => {
    for (const preset of PRESET_IDS) {
      const base = presetLook(preset);
      for (const design of BUTTON_DESIGNS) {
        const buttons = { ...resolveLook(base).buttons, design };
        const look = withButtons({ shape: buttons.shape, fill: buttons.fill, weight: buttons.weight, design }, preset);
        expect(lookProblems(resolveLook(look)), `${preset}/${design}`).toEqual([]);
      }
    }
  });

  test("Glow on the curated accents never blocks, and a failing one gets a fix", () => {
    for (const accent of ACCENT_SWATCHES) {
      for (const background of BACKGROUND_SWATCHES) {
        const look: StoredLook = {
          v: 1,
          preset: "blush",
          overrides: { colors: { accent, background }, buttons: { shape: "pill", fill: "solid", weight: "bold", design: "glow" } },
        };
        const glow = lookProblems(resolveLook(look)).filter((p) => p.target === "buttonDesign");
        for (const p of glow) {
          expect(p.level, `${accent} on ${background}`).toBe("warn");
          expect(p.fix).not.toBeNull();
        }
      }
    }
  });

  test("Glow sets its gradient tokens; other designs don't", () => {
    const glow = lookCssVars(resolveLook(withButtons({ shape: "pill", fill: "solid", weight: "bold", design: "glow" })));
    expect(glow["--shop-glow-from"]).toMatch(/^#/);
    expect(glow["--shop-chip-glow-to"]).toMatch(/^#/);
    expect(lookCssVars(resolveLook(presetLook("blush")))["--shop-glow-from"]).toBeUndefined();
  });
});
