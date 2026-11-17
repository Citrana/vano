"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CATEGORY_KEYS, type Category } from "../../../../convex/lib/catalog"
import { CURRENCIES, type Currency } from "../../../../convex/lib/money"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

export type ShopsFilterValue = {
  search: string
  status: "" | "active" | "suspended"
  category: "" | Category
  currency: "" | Currency
}

/** Name search + status, category and currency filters. */
export function ShopsFilters({ value, onChange }: { value: ShopsFilterValue; onChange: (next: ShopsFilterValue) => void }) {
  const t = useTranslations("AdminShops")
  const ts = useTranslations("ShopStatus")
  const tc = useTranslations("Categories")
  const tm = useTranslations("Currencies")
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
      <label className="relative sm:col-span-2 lg:col-span-1">
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
        <span className="sr-only">{t("status")}</span>
        <NativeSelect value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as ShopsFilterValue["status"] })}>
          <option value="">{t("allStatuses")}</option>
          <option value="active">{ts("active")}</option>
          <option value="suspended">{ts("suspended")}</option>
        </NativeSelect>
      </label>
      <label>
        <span className="sr-only">{t("category")}</span>
        <NativeSelect value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as ShopsFilterValue["category"] })}>
          <option value="">{t("allCategories")}</option>
          {CATEGORY_KEYS.map((c) => (
            <option key={c} value={c}>{tc(c)}</option>
          ))}
        </NativeSelect>
      </label>
      <label>
        <span className="sr-only">{t("currency")}</span>
        <NativeSelect value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value as ShopsFilterValue["currency"] })}>
          <option value="">{t("allCurrencies")}</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{tm(c)}</option>
          ))}
        </NativeSelect>
      </label>
    </div>
  )
}
