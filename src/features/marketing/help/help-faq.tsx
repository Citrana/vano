"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useDeferredValue, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { FaqList, type FaqEntry } from "@/features/marketing/shared/faq-list"

export type HelpGroup = { key: string; title: string; items: FaqEntry[] }

/** Lowercase, accents removed, so "reponse" finds "réponse". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Grouped FAQ with a search box that filters questions and answers. */
export function HelpFaq({ groups }: { groups: HelpGroup[] }) {
  const t = useTranslations("Help")
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query)
  const needle = normalize(deferred.trim())

  const visible = useMemo(() => {
    if (!needle) return groups
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => normalize(`${i.question} ${i.answer}`).includes(needle)) }))
      .filter((g) => g.items.length > 0)
  }, [groups, needle])
  const count = visible.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <label htmlFor="help-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 rounded-2xl bg-card pr-12 pl-12 text-base md:h-12"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("searchLabel")}
              className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
        {needle ? (
          <p role="status" className="text-sm text-muted-foreground">
            {count > 0 ? t("resultsCount", { count }) : t("noResults", { query: deferred.trim() })}
          </p>
        ) : (
          <nav aria-label={t("searchLabel")} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {groups.map((g) => (
              <a
                key={g.key}
                href={`#${g.key}`}
                className="flex min-h-10 shrink-0 items-center rounded-full border bg-card px-4 text-sm font-medium whitespace-nowrap hover:bg-muted"
              >
                {g.title}
              </a>
            ))}
          </nav>
        )}
      </div>
      {visible.map((g) => (
        <section key={g.key} id={g.key} aria-labelledby={`${g.key}-title`} className="flex scroll-mt-24 flex-col gap-3">
          <h2 id={`${g.key}-title`} className="text-xl font-extrabold md:text-2xl">
            {g.title}
          </h2>
          <FaqList items={g.items} />
        </section>
      ))}
    </div>
  )
}
