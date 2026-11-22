import { describe, expect, test } from "vitest";
import { freeLookFor, shownLook, withoutDecoration } from "./clean";
import { lookProblems } from "./contrast";
import { EVENT_TEMPLATE_IDS } from "./events";
import { FREE_LOOK, isFreeLook, PRESET_IDS, presetLook } from "./presets";
import {
  clearOfFace,
  cleanProfile,
  cornerBox,
  decorationBox,
  decorationEntry,
  decorationForTemplate,
  DEFAULT_PROFILE,
  freeProfileOf,
  insidePad,
  isFreeProfile,
  PROFILE_DECORATION_IDS,
  PROFILE_DECORATIONS,
  PROFILE_SHAPES,
  PROFILE_SIZES,
  RING_INNER,
  FACE_ZONE,
  type ProfileFacet,
} from "./profile";
import { resetLook } from "./reset";
import { resolveLook } from "./resolve";
import { liveFlags } from "./schedule";
import type { StoredLook } from "./validators";

const pro: ProfileFacet = {
  shape: "flower",
  borderWidth: "thick",
  borderStyle: "double",
  borderColor: { kind: "custom", hex: "#B83260" },
  size: "lg",
  position: "center",
  overlap: "below",
  corner: "heart",
  decoration: { id: "goldCrown" },
};

const withProfile = (profile: ProfileFacet, preset: StoredLook["preset"] = "classic"): StoredLook => ({
  v: 1,
  preset,
  overrides: { profile },
});

describe("profile values", () => {
  test("cleanProfile normalises the custom colour and keeps valid values", () => {
    expect(cleanProfile(pro)).toEqual({ ...pro, borderColor: { kind: "custom", hex: "#b83260" }, decoration: { id: "goldCrown" } });
    expect(cleanProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
  });

  test("cleanProfile refuses a bad colour or bad decoration dates", () => {
    expect(cleanProfile({ ...pro, borderColor: { kind: "custom", hex: "pink" } })).toBeNull();
    expect(cleanProfile({ ...pro, decoration: { id: "bow", startsAt: 10, endsAt: 5 } })).toBeNull();
    expect(cleanProfile({ ...pro, decoration: { id: "bow", startsAt: 1.5 } })).toBeNull();
    expect(cleanProfile({ ...pro, decoration: { id: "bow", startsAt: 5, endsAt: 10 } })?.decoration).toEqual({
      id: "bow",
      startsAt: 5,
      endsAt: 10,
    });
  });
});

describe("profile plans", () => {
  test("Free: circle, thin or no border, solid, a shop colour, nothing else", () => {
    expect(isFreeProfile(DEFAULT_PROFILE)).toBe(true);
    expect(isFreeProfile({ ...DEFAULT_PROFILE, borderWidth: "none" })).toBe(true);
    expect(isFreeProfile({ ...DEFAULT_PROFILE, borderColor: { kind: "theme", token: "foreground" } })).toBe(true);
    for (const patch of [
      { shape: "rounded" },
      { borderWidth: "medium" },
      { borderStyle: "dashed" },
      { borderColor: { kind: "custom", hex: "#000000" } },
      { size: "lg" },
      { position: "center" },
      { overlap: "below" },
      { corner: "sparkle" },
      { decoration: { id: "bow" } },
    ] as Partial<ProfileFacet>[]) {
      expect(isFreeProfile({ ...DEFAULT_PROFILE, ...patch })).toBe(false);
    }
  });

  test("isFreeLook accepts the free look with a Free profile only", () => {
    expect(isFreeLook(withProfile(DEFAULT_PROFILE))).toBe(true);
    expect(isFreeLook(withProfile(pro))).toBe(false);
    expect(isFreeLook(withProfile(DEFAULT_PROFILE, "blush"))).toBe(false);
  });

  test("a downgrade falls back to the Free profile and keeps a shop colour", () => {
    const free = freeProfileOf({ ...pro, borderColor: { kind: "theme", token: "chip" } });
    expect(isFreeProfile(free)).toBe(true);
    expect(free).toEqual({ ...DEFAULT_PROFILE, borderColor: { kind: "theme", token: "chip" } });
    expect(freeProfileOf(pro).borderColor).toEqual(DEFAULT_PROFILE.borderColor);
    expect(freeProfileOf({ ...pro, borderWidth: "none" }).borderWidth).toBe("none");
    expect(freeLookFor(withProfile(pro, "noir"))).toEqual({ ...FREE_LOOK, overrides: { profile: freeProfileOf(pro) } });
    expect(freeLookFor(presetLook("noir"))).toEqual(FREE_LOOK);
  });

  test("shownLook: plan, promo and decoration rules in one place", () => {
    const look = withProfile(pro, "noir");
    expect(shownLook(null, { entitled: true, promoShown: true, decorationShown: true, sectionsEntitled: true, announcementShown: true })).toEqual(FREE_LOOK);
    expect(shownLook(look, { entitled: false, promoShown: true, decorationShown: true, sectionsEntitled: true, announcementShown: true })).toEqual(freeLookFor(look));
    expect(shownLook(look, { entitled: true, promoShown: false, decorationShown: true, sectionsEntitled: true, announcementShown: true })).toEqual(look);
    expect(shownLook(look, { entitled: true, promoShown: false, decorationShown: false, sectionsEntitled: true, announcementShown: true })).toEqual(withoutDecoration(look));
    expect(withoutDecoration(look).overrides.profile?.decoration).toBeUndefined();
    expect(withoutDecoration(look).overrides.profile?.shape).toBe("flower");
  });

  test("liveFlags reads the decoration's dates like the promo's", () => {
    const now = 1_000_000;
    expect(liveFlags(withProfile(pro), now)).toEqual({ promoLive: false, decorationLive: true, announcementLive: false });
    expect(liveFlags(withProfile({ ...pro, decoration: { id: "bow", startsAt: now + 1 } }), now).decorationLive).toBe(false);
    expect(liveFlags(withProfile({ ...pro, decoration: { id: "bow", endsAt: now } }), now).decorationLive).toBe(false);
    expect(liveFlags(withProfile({ ...pro, decoration: undefined }), now).decorationLive).toBe(false);
  });

  test("the admin profile reset drops only the profile", () => {
    const look: StoredLook = { ...withProfile(pro, "blush"), overrides: { colors: { accent: "#0e6e85", background: "#f1f8fa" }, profile: pro } };
    expect(resetLook(look, "profile")).toEqual({ ...look, overrides: { colors: look.overrides.colors } });
    expect(resetLook(look, "banner").overrides.profile).toEqual(pro);
    expect(resetLook(look, "all")).toEqual(FREE_LOOK);
  });
});

describe("profile resolve and contrast", () => {
  test("defaults to today's photo; theme colours follow the look", () => {
    const resolved = resolveLook(presetLook("lavender"));
    expect(resolved.profile).toMatchObject({ shape: "circle", size: "md", position: "start", overlap: "edge", corner: "none", decoration: null });
    expect(resolved.profile.border).toMatchObject({ style: "solid", color: resolved.colors.primary, token: "accent" });
    const chip = resolveLook(withProfile({ ...DEFAULT_PROFILE, borderColor: { kind: "theme", token: "chip" } }, "lavender"));
    expect(chip.profile.border?.color).toBe(chip.colors.chip);
    expect(resolveLook(withProfile({ ...DEFAULT_PROFILE, borderWidth: "none" })).profile.border).toBeNull();
    expect(resolveLook(withProfile(pro)).profile).toMatchObject({ decoration: "goldCrown", corner: "heart", shape: "flower" });
  });

  test("every preset's default border passes, so presets stay warning-free", () => {
    for (const id of PRESET_IDS) {
      expect(lookProblems(resolveLook(presetLook(id))).filter((p) => p.target === "profileBorder")).toEqual([]);
    }
  });

  test("a faint border warns (never blocks) and offers a readable colour", () => {
    const faint = resolveLook(withProfile({ ...DEFAULT_PROFILE, borderColor: { kind: "custom", hex: "#fdf6f1" } }));
    const [problem] = lookProblems(faint).filter((p) => p.target === "profileBorder");
    expect(problem.level).toBe("warn");
    expect(problem.fix?.field).toBe("profileBorder");
    const fixed = resolveLook(withProfile({ ...DEFAULT_PROFILE, borderColor: { kind: "custom", hex: problem.fix!.value } }));
    expect(lookProblems(fixed).filter((p) => p.target === "profileBorder")).toEqual([]);
    // No border, nothing to check.
    expect(lookProblems(resolveLook(withProfile({ ...DEFAULT_PROFILE, borderWidth: "none" }))).filter((p) => p.target === "profileBorder")).toEqual([]);
  });
});

describe("profile decorations", () => {
  test("ids are unique and every entry is listed once", () => {
    expect(new Set(PROFILE_DECORATION_IDS).size).toBe(PROFILE_DECORATIONS.length);
  });

  test("never over the face, always inside the drawing area, for every shape and size", () => {
    for (const entry of PROFILE_DECORATIONS) {
      for (const shape of PROFILE_SHAPES) {
        for (const size of PROFILE_SIZES) {
          const box = decorationBox(entry, shape, size);
          expect(insidePad(box), `${entry.id} ${shape} ${size}`).toBe(true);
          if (entry.anchor === "ring") expect(RING_INNER).toBeGreaterThan(FACE_ZONE.r);
          else expect(clearOfFace(box), `${entry.id} ${shape} ${size}`).toBe(true);
          for (const deco of [null, entry.id]) {
            const corner = cornerBox(shape, size, deco);
            expect(insidePad(corner)).toBe(true);
            expect(clearOfFace(corner), `corner ${shape} ${size} ${deco}`).toBe(true);
          }
        }
      }
    }
  });

  test("decorations adapt to the shape and size", () => {
    const entry = decorationEntry("sparkles");
    expect(decorationBox(entry, "rounded", "md").x).toBeGreaterThan(decorationBox(entry, "circle", "md").x);
    expect(decorationBox(entry, "circle", "sm").w).toBeGreaterThan(decorationBox(entry, "circle", "lg").w);
  });

  test("event templates suggest a matching decoration", () => {
    expect(decorationForTemplate("christmas")).toBe("santaHat");
    expect(decorationForTemplate("valentines")).toBe("hearts");
    expect(decorationForTemplate("eid")).toBe("crescentStars");
    expect(decorationForTemplate("mothersDay")).toBe("eventFlowers");
    expect(decorationForTemplate("womensDay")).toBe("eventFlowers");
    expect(decorationForTemplate("newYear")).toBe("newYearSparkles");
    expect(decorationForTemplate("blackFriday")).toBe("saleTag");
    expect(decorationForTemplate("backToSchool")).toBe("backpack");
    expect(decorationForTemplate("announcement")).toBeNull();
    // Each template maps to at most one decoration.
    for (const id of EVENT_TEMPLATE_IDS) {
      expect(PROFILE_DECORATIONS.filter((d) => d.events.includes(id)).length).toBeLessThanOrEqual(1);
    }
  });
});
