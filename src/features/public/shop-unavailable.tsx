import { StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { Language } from "../../../convex/lib/catalog"
import { PublicFooter } from "./public-footer"

/**
 * What visitors see while an admin has suspended the shop, in the shop's
 * language. Only the name is shown — nothing else about the shop.
 */
export async function ShopUnavailable({ name, language }: { name: string; language: Language }) {
  const t = await getTranslations({ locale: language, namespace: "Public" })
  return (
    <div lang={language} className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <StoreIcon className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">{t("unavailableTitle", { shop: name })}</h1>
        <p className="max-w-sm text-muted-foreground">{t("unavailableBody")}</p>
      </main>
      <PublicFooter language={language} />
    </div>
  )
}
