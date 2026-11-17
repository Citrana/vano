"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CATEGORY_KEYS, type Category } from "../../../../convex/lib/catalog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

export type ProductsFilterValue = { search: string; visibility: "" | "visible" | "hidden"; category: "" | Category }

/** Name search + visibility + category filters. */
export function ProductsFilters({
  value,
  onChange,
}: {
  value: ProductsFilterValue
  onChange: (next: ProductsFilterValue) => void
}) {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Categories")
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <label className="relative">
        <span className="sr-only">{t("search")}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </label>
      <label>
        <span className="sr-only">{t("visibility")}</span>
        <NativeSelect
          value={value.visibility}
          onChange={(e) => onChange({ ...value, visibility: e.target.value as ProductsFilterValue["visibility"] })}
        >
          <option value="">{t("allVisibility")}</option>
          <option value="visible">{t("visible")}</option>
          <option value="hidden">{t("hidden")}</option>
        </NativeSelect>
      </label>
      <label>
        <span className="sr-only">{t("category")}</span>
        <NativeSelect
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value as ProductsFilterValue["category"] })}
        >
          <option value="">{t("allCategories")}</option>
          {CATEGORY_KEYS.map((c) => (
            <option key={c} value={c}>{tc(c)}</option>
          ))}
        </NativeSelect>
      </label>
    </div>
  )
}
