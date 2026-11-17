import { PackageXIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import { buttonVariants } from "@/components/ui/button"

/**
 * A product that doesn't exist in an existing shop. (An unknown shop is
 * caught by [slug]/layout.tsx and shown by the root not-found page.) The
 * shop's language isn't known here, so this uses the visitor's.
 */
export default async function ProductNotFound() {
  const t = await getTranslations("Public")
  const tn = await getTranslations("NotFound")
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <PackageXIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-2xl font-bold tracking-tight">{t("productNotFoundTitle")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {tn("home")}
      </Link>
      <Brand className="mt-6 text-lg" />
    </main>
  )
}
