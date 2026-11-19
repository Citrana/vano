"use client"

import { createTranslator, useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import type { EventTemplateId } from "../../../../convex/lib/looks/events"

type Language = "en" | "fr"
type TemplateTexts = { headline: string; subline: string }
type Lookup = (template: EventTemplateId) => TemplateTexts

/**
 * Default headline and second line of each template, in the SHOP's
 * language (CLAUDE.md "Internationalization": public pages always use the
 * shop's language, whatever language the seller's dashboard is in).
 */
export function useTemplateTexts(language: Language): Lookup {
  const locale = useLocale()
  const t = useTranslations("EventBanners.templates")
  const [other, setOther] = useState<{ language: Language; lookup: Lookup } | null>(null)

  useEffect(() => {
    if (language === locale) return
    let active = true
    void import(`../../../../messages/${language}.json`).then((module: { default: IntlMessages }) => {
      if (!active) return
      const tr = createTranslator({ locale: language, messages: module.default, namespace: "EventBanners.templates" })
      setOther({ language, lookup: (id) => ({ headline: tr(`${id}.headline`), subline: tr(`${id}.subline`) }) })
    })
    return () => {
      active = false
    }
  }, [language, locale])

  return useCallback(
    (id: EventTemplateId) =>
      other?.language === language && language !== locale
        ? other.lookup(id)
        : { headline: t(`${id}.headline`), subline: t(`${id}.subline`) },
    [other, language, locale, t],
  )
}

type IntlMessages = Parameters<typeof createTranslator>[0]["messages"]
