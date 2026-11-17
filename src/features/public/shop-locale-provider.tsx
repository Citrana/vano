import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import type { Language } from "../../../convex/lib/catalog"
import { loadMessages } from "@/i18n/messages"

/**
 * Public pages always speak the shop's language (CLAUDE.md
 * "Internationalization"), whatever the visitor's cookie says. Client
 * components below read their strings from this provider.
 */
export async function ShopLocaleProvider({ language, children }: { language: Language; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={language} messages={await loadMessages(language)}>
      <div lang={language} className="flex flex-1 flex-col">
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
