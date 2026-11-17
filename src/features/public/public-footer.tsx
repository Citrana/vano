import { getTranslations } from "next-intl/server"
import Link from "next/link"
import type { Language } from "../../../convex/lib/catalog"

export async function PublicFooter({ language }: { language: Language }) {
  const t = await getTranslations({ locale: language, namespace: "Public" })
  return (
    <footer className="mt-auto border-t py-6 text-center text-xs text-muted-foreground">
      {t("poweredBy")} ·{" "}
      <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
        {t("createYours")}
      </Link>
    </footer>
  )
}
