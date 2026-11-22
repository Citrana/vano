import { describe, expect, test } from "vitest";
import {
  buildShopSections,
  cleanSections,
  DEFAULT_SECTIONS,
  freeSectionsOf,
  isFreeSections,
  NEW_ARRIVALS_COUNT,
  sectionRows,
  showsSection,
  type SectionProduct,
  type SectionsFacet,
} from "./sections";
import { cleanAnnouncement, cleanLook, sameLook, shownLook } from "./clean";
import { ANNOUNCEMENT_TEXT_MAX, cleanAnnouncementUrl } from "./announcement";
import { lookProblems } from "./contrast";
import { PRESET_IDS, presetLook, FREE_LOOK } from "./presets";
import { resetLook } from "./reset";
import { resolveLook } from "./resolve";
import { liveFlags, lookBoundaries } from "./schedule";
import type { StoredLook } from "./validators";

type P = SectionProduct & { id: string };
const product = (id: string, extra: Partial<P> = {}): P => ({ id, category: "clothes", soldOut: false, ...extra });

const facet = (on: string[], extra: Partial<SectionsFacet> = {}): SectionsFacet => ({
  ...DEFAULT_SECTIONS,
  order: DEFAULT_SECTIONS.order.map((e) => ({ ...e, on: on.includes(e.id) })),
  ...extra,
});

const ids = (sections: ReturnType<typeof buildShopSections<P>>) => sections.map((s) => [s.key, s.products.map((p) => p.id)]);

describe("cleanSections", () => {
  test("keeps the order, adds All products when missing, refuses bad entries", () => {
    expect(cleanSections({ order: [{ id: "featured", on: true }], layout: "grid3", about: false })).toEqual({
      order: [
        { id: "featured", on: true },
        { id: "all", on: true },
      ],
      layout: "grid3",
      about: false,
    });
    // A category entry needs a category; others can't have one; no duplicates.
    expect(cleanSections({ order: [{ id: "category", on: true }], layout: "grid2", about: true })).toBeNull();
    expect(cleanSections({ order: [{ id: "sale", on: true, category: "shoes" }], layout: "grid2", about: true })).toBeNull();
    expect(
      cleanSections({
        order: [
          { id: "category", on: true, category: "shoes" },
          { id: "category", on: false, category: "shoes" },
        ],
        layout: "grid2",
        about: true,
      }),
    ).toBeNull();
    expect(cleanSections({ order: Array.from({ length: 20 }, () => ({ id: "all" as const, on: true })), layout: "grid2", about: true })).toBeNull();
  });

  test("the editor lists every built-in section", () => {
    const rows = sectionRows({ order: [{ id: "all", on: true }], layout: "grid2", about: true });
    expect(rows.map((r) => r.id)).toEqual(["all", "sale", "newArrivals", "featured", "backInStock"]);
    expect(rows.slice(1).every((r) => !r.on)).toBe(true);
  });
});

describe("Free sections", () => {
  test("All products in 2 columns, with or without the About block", () => {
    expect(isFreeSections(undefined)).toBe(true);
    expect(isFreeSections(DEFAULT_SECTIONS)).toBe(true);
    expect(isFreeSections({ ...DEFAULT_SECTIONS, about: false })).toBe(true);
    // Order alone doesn't matter while only All products is on.
    expect(isFreeSections({ ...DEFAULT_SECTIONS, order: [...DEFAULT_SECTIONS.order].reverse() })).toBe(true);
    expect(isFreeSections(facet(["all", "featured"]))).toBe(false);
    expect(isFreeSections({ ...DEFAULT_SECTIONS, layout: "large" })).toBe(false);
    expect(isFreeSections({ ...DEFAULT_SECTIONS, order: [{ id: "category", on: true, category: "bags" }, { id: "all", on: true }] })).toBe(false);
  });

  test("a downgrade shows the default and keeps the About choice", () => {
    const saved = facet(["featured", "all"], { layout: "large", about: false });
    expect(freeSectionsOf(saved)).toEqual({ ...DEFAULT_SECTIONS, about: false });
  });
});

describe("buildShopSections", () => {
  const products = [
    product("a", { featured: true, sale: { price: 1 } }),
    product("b", { category: "shoes", backInStock: true }),
    product("c", { soldOut: true, backInStock: true, featured: true }),
    ...Array.from({ length: 8 }, (_, i) => product(`x${i}`)),
  ];

  test("sections in order, each with its products; off and empty ones never show", () => {
    const sections = buildShopSections(
      {
        order: [
          { id: "featured", on: true },
          { id: "backInStock", on: true },
          { id: "newArrivals", on: true },
          { id: "category", on: true, category: "shoes" },
          { id: "category", on: true, category: "bags" },
          { id: "sale", on: false },
          { id: "all", on: true },
        ],
        layout: "grid2",
        about: true,
      },
      products,
    );
    expect(ids(sections)).toEqual([
      ["featured", ["a", "c"]],
      ["backInStock", ["b"]], // a sold-out product isn't "back in stock"
      ["newArrivals", products.slice(0, NEW_ARRIVALS_COUNT).map((p) => p.id)],
      ["category:shoes", ["b"]],
      // bags: empty, not shown
      ["all", products.map((p) => p.id)],
    ]);
  });

  test("the Sale section only while a sale is live", () => {
    expect(showsSection(facet(["sale", "all"]), products, "sale")).toBe(true);
    expect(showsSection(facet(["sale", "all"]), products.map((p) => ({ ...p, sale: null })), "sale")).toBe(false);
  });

  test("a section that would repeat the whole All products list is left out", () => {
    const few = [product("a"), product("b")];
    // 2 products: "New arrivals" = every product.
    expect(ids(buildShopSections(facet(["newArrivals", "all"]), few))).toEqual([["all", ["a", "b"]]]);
    // Without All products, it shows.
    expect(ids(buildShopSections(facet(["newArrivals"]), few))).toEqual([["newArrivals", ["a", "b"]]]);
  });

  test("nothing left: All products shows, so the shop is never blank", () => {
    expect(ids(buildShopSections(facet(["featured"]), [product("a")]))).toEqual([["all", ["a"]]]);
    expect(buildShopSections(facet(["all"]), [])).toEqual([]);
  });
});

describe("announcement bar", () => {
  const bar = { text: "  Free delivery\nthis weekend ", tone: "accent" as const };

  test("one line of text, https links, schedule shape", () => {
    expect(cleanAnnouncement(bar)).toEqual({ text: "Free delivery this weekend", tone: "accent" });
    expect(cleanAnnouncement({ ...bar, text: "   " })).toBeNull();
    expect(cleanAnnouncement({ ...bar, text: "x".repeat(ANNOUNCEMENT_TEXT_MAX + 1) })).toBeNull();
    expect(cleanAnnouncement({ ...bar, link: { kind: "url", url: "example.com/sale" } })?.link).toEqual({
      kind: "url",
      url: "https://example.com/sale",
    });
    expect(cleanAnnouncement({ ...bar, link: { kind: "url", url: "javascript:alert(1)" } })).toBeNull();
    expect(cleanAnnouncement({ ...bar, startsAt: 10, endsAt: 5 })).toBeNull();
  });

  test("links: http(s) to a real host only", () => {
    expect(cleanAnnouncementUrl("http://shop.example.com/a?b=1")).toBe("https://shop.example.com/a?b=1");
    expect(cleanAnnouncementUrl("ftp://example.com")).toBeNull();
    expect(cleanAnnouncementUrl("https://user:pass@example.com")).toBeNull();
    expect(cleanAnnouncementUrl("localhost")).toBeNull();
    expect(cleanAnnouncementUrl("data:text/html,hi")).toBeNull();
  });

  test("every preset × tone is readable (no contrast problem)", () => {
    for (const preset of PRESET_IDS) {
      for (const tone of ["accent", "dark", "soft"] as const) {
        const look = resolveLook({ ...presetLook(preset), overrides: { announcement: { text: "Hi", tone } } });
        expect(lookProblems(look).filter((p) => p.target === "announcement"), `${preset} ${tone}`).toEqual([]);
      }
    }
  });

  test("a mid-tone custom accent is flagged, with a fix", () => {
    const look = resolveLook({
      v: 1,
      preset: "classic",
      overrides: { colors: { accent: "#7a7a7a", background: "#ffffff" }, announcement: { text: "Hi", tone: "accent" } },
    });
    const problem = lookProblems(look).find((p) => p.target === "announcement");
    expect(problem?.fix?.field).toBe("accent");
  });

  test("dates follow the event banner rules (live flag, job times)", () => {
    const look: StoredLook = { ...FREE_LOOK, overrides: { announcement: { text: "Hi", tone: "dark", startsAt: 100, endsAt: 200 } } };
    expect(liveFlags(look, 50).announcementLive).toBe(false);
    expect(liveFlags(look, 150).announcementLive).toBe(true);
    expect(liveFlags(look, 200).announcementLive).toBe(false);
    expect(lookBoundaries(look, 50)).toEqual([100, 200]);
    expect(lookBoundaries(look, 150)).toEqual([200]);
  });
});

describe("shownLook with sections and the announcement bar", () => {
  const published: StoredLook = {
    v: 1,
    preset: "noir",
    overrides: { sections: facet(["featured", "all"], { layout: "grid3", about: false }), announcement: { text: "Hi", tone: "accent" } },
  };
  const flags = { entitled: true, promoShown: true, decorationShown: true, sectionsEntitled: true, announcementShown: true };

  test("entitled: as published", () => {
    expect(shownLook(published, flags)).toEqual(published);
  });

  test("each part falls back on its own plan feature", () => {
    const noSections = shownLook(published, { ...flags, sectionsEntitled: false });
    expect(noSections.preset).toBe("noir");
    expect(noSections.overrides.sections).toEqual({ ...DEFAULT_SECTIONS, about: false });
    expect(noSections.overrides.announcement).toBeDefined();

    const noBar = shownLook(published, { ...flags, announcementShown: false });
    expect(noBar.overrides.announcement).toBeUndefined();
    expect(noBar.overrides.sections).toEqual(published.overrides.sections);

    // No custom looks: the free look, but the sections still follow their own feature.
    const noLooks = shownLook(published, { ...flags, entitled: false });
    expect(noLooks.preset).toBe("classic");
    expect(noLooks.overrides.sections).toEqual(published.overrides.sections);
  });

  test("cleanLook keeps both facets; a preset reset keeps nothing extra", () => {
    expect(sameLook(cleanLook(published), published)).toBe(true);
    expect(resetLook(published, "all")).toEqual(FREE_LOOK);
    const banner = resetLook(published, "banner");
    expect(banner.overrides.announcement).toBeUndefined();
    expect(banner.overrides.sections).toEqual(published.overrides.sections);
    expect(resetLook(published, "profile").overrides.announcement).toBeDefined();
  });

  test("resolveLook fills the default sections and derives the bar's colours", () => {
    const free = resolveLook(FREE_LOOK);
    expect(free.sections).toEqual(DEFAULT_SECTIONS);
    expect(free.announcement).toBeNull();
    const look = resolveLook(published);
    expect(look.announcement).toMatchObject({ text: "Hi", tone: "accent", background: look.colors.primary, foreground: look.colors.primaryForeground });
  });
});
