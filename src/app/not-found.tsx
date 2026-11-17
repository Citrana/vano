import { StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import { buttonVariants } from "@/components/ui/button"

/** Unknown URL — at the top level that is almost always an unknown shop link. */
export default async function NotFound() {
  const t = await getTranslations("NotFound")
  const tp = await getTranslations("Public")
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <StoreIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{tp("notFoundBody")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("home")}
      </Link>
      <Brand className="mt-6 text-lg" />
    </main>
  )
}
