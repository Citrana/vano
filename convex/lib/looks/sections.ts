import { v, type Infer } from "convex/values";
import { CATEGORY_KEYS, categoryValidator, type Category } from "../catalog";

/**
 * The shop page's sections and product layout (CLAUDE.md "Shop looks"):
 * an optional `sections` facet of the look. Pure; the editor, the public
 * page, the preview, the demo and `shopLooks.publish` use the same rules.
 *
 * A missing facet = `DEFAULT_SECTIONS` (today's page: every product in a
 * 2-column grid, plus the About and contact block). Free publishes only
 * that (`isFreeSections`, the About switch is free); the rest needs the
 * `featuredSections` plan feature. On a downgrade the page shows
 * `freeSectionsOf(saved)`; the saved choice is kept.
 */

export const SECTION_IDS = ["sale", "newArrivals", "featured", "backInStock", "category", "all"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
/** Sections that appear once (category sections appear once per category). */
export const BUILT_IN_SECTIONS = ["sale", "newArrivals", "featured", "backInStock", "all"] as const satisfies readonly SectionId[];

export const sectionIdValidator = v.union(
  v.literal("sale"),
  v.literal("newArrivals"),
  v.literal("featured"),
  v.literal("backInStock"),
  v.literal("category"),
  v.literal("all"),
);

export const sectionEntryValidator = v.object({
  id: sectionIdValidator,
  on: v.boolean(),
  /** Only (and always) for `id: "category"`. */
  category: v.optional(categoryValidator),
});
export type SectionEntry = Infer<typeof sectionEntryValidator>;

export const PRODUCT_LAYOUTS = ["grid2", "grid3", "large"] as const;
export const productLayoutValidator = v.union(v.literal("grid2"), v.literal("grid3"), v.literal("large"));
export type ProductLayout = Infer<typeof productLayoutValidator>;
export const FREE_LAYOUT: ProductLayout = "grid2";

export const sectionsFacetValidator = v.object({
  /** The page's sections, top to bottom. */
  order: v.array(sectionEntryValidator),
  layout: productLayoutValidator,
  /** Show the About and contact block (its filled parts, from Shop settings). */
  about: v.boolean(),
});
export type SectionsFacet = Infer<typeof sectionsFacetValidator>;

/** How many products "New arrivals" shows: the newest visible ones. */
export const NEW_ARRIVALS_COUNT = 8;
/** At most this many products in a section: few enough to read as a highlight. */
export const SECTION_MAX_PRODUCTS = 12;
const MAX_ENTRIES = BUILT_IN_SECTIONS.length + CATEGORY_KEYS.length;

export const DEFAULT_SECTIONS: SectionsFacet = {
  order: [
    { id: "sale", on: false },
    { id: "newArrivals", on: false },
    { id: "featured", on: false },
    { id: "backInStock", on: false },
    { id: "all", on: true },
  ],
  layout: FREE_LAYOUT,
  about: true,
};

/** One key per entry: the id, or `category:<key>`. */
export function sectionKey(entry: Pick<SectionEntry, "id" | "category">): string {
  return entry.id === "category" ? `category:${entry.category}` : entry.id;
}

/**
 * Value checks: a category entry names a category, others don't; no
 * duplicates; "All products" is always in the list (appended, on, when
 * missing) so a shop can always show everything. Null = refused.
 */
export function cleanSections(facet: SectionsFacet): SectionsFacet | null {
  if (facet.order.length > MAX_ENTRIES) return null;
  const seen = new Set<string>();
  const order: SectionEntry[] = [];
  for (const entry of facet.order) {
    if ((entry.id === "category") !== (entry.category !== undefined)) return null;
    const key = sectionKey(entry);
    if (seen.has(key)) return null;
    seen.add(key);
    order.push(entry.id === "category" ? { id: "category", on: entry.on, category: entry.category } : { id: entry.id, on: entry.on });
  }
  if (!seen.has("all")) order.push({ id: "all", on: true });
  return { order, layout: facet.layout, about: facet.about };
}

/** The sections a page uses: the facet, else the default. */
export function sectionsOf(facet: SectionsFacet | undefined): SectionsFacet {
  return facet ?? DEFAULT_SECTIONS;
}

/**
 * The editor's rows: the saved order, then any built-in section it
 * doesn't list yet (off), so every option can be switched on.
 */
export function sectionRows(facet: SectionsFacet): SectionEntry[] {
  const listed = new Set(facet.order.map(sectionKey));
  return [...facet.order, ...BUILT_IN_SECTIONS.filter((id) => !listed.has(id)).map((id) => ({ id, on: false }))];
}

/** What Free publishes: every product in 2 columns. The About switch is free. */
export function isFreeSections(facet: SectionsFacet | undefined): boolean {
  if (!facet) return true;
  return facet.layout === FREE_LAYOUT && facet.order.every((entry) => !entry.on || entry.id === "all");
}

/** What a Free shop shows for its saved sections: the default, with its About choice. */
export function freeSectionsOf(facet: SectionsFacet): SectionsFacet {
  return { ...DEFAULT_SECTIONS, about: facet.about };
}

/** What a product needs for the section rules (public cards and previews). */
export type SectionProduct = {
  category: Category;
  soldOut: boolean;
  sale?: unknown;
  featured?: boolean;
  backInStock?: boolean;
};

export type BuiltSection<P> = {
  key: string;
  id: SectionId;
  category?: Category;
  products: P[];
};

function sectionProducts<P extends SectionProduct>(entry: SectionEntry, products: readonly P[]): P[] {
  switch (entry.id) {
    case "all":
      return [...products];
    case "sale":
      return products.filter((p) => p.sale).slice(0, SECTION_MAX_PRODUCTS);
    case "newArrivals":
      return products.slice(0, NEW_ARRIVALS_COUNT);
    case "featured":
      return products.filter((p) => p.featured).slice(0, SECTION_MAX_PRODUCTS);
    case "backInStock":
      return products.filter((p) => p.backInStock && !p.soldOut).slice(0, SECTION_MAX_PRODUCTS);
    case "category":
      return products.filter((p) => p.category === entry.category);
  }
}

const sameIds = <P>(a: readonly P[], b: readonly P[]) => a.length === b.length && a.every((p, i) => p === b[i]);

/**
 * The page's sections, in order, each with its products (`products` is
 * the visible list, newest first). Never shows a section that is off or
 * empty (the Sale section is empty unless a sale is live), nor one that
 * would only repeat the whole "All products" list shown below or above.
 * If nothing is left while the shop has products, "All products" shows.
 */
export function buildShopSections<P extends SectionProduct>(facet: SectionsFacet, products: readonly P[]): BuiltSection<P>[] {
  const all = facet.order.find((e) => e.id === "all")?.on ? products : null;
  const built: BuiltSection<P>[] = [];
  for (const entry of facet.order) {
    if (!entry.on) continue;
    const items = sectionProducts(entry, products);
    if (items.length === 0) continue;
    if (entry.id !== "all" && all && sameIds(items, all)) continue;
    built.push({ key: sectionKey(entry), id: entry.id, category: entry.category, products: items });
  }
  if (built.length === 0 && products.length > 0) built.push({ key: "all", id: "all", products: [...products] });
  return built;
}

/** Whether the page shows this section (e.g. the Sale section, which then carries the countdown). */
export function showsSection<P extends SectionProduct>(facet: SectionsFacet, products: readonly P[], id: SectionId): boolean {
  return buildShopSections(facet, products).some((s) => s.id === id);
}
