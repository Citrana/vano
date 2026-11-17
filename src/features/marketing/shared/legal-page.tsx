import { InfoIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

type LegalKey = "terms" | "privacy"

/** Placeholder Terms / Privacy page: short sections (nav and footer come from the marketing layout). */
export async function LegalPage({ page }: { page: LegalKey }) {
  const t = await getTranslations("Legal")
  const sections = [1, 2, 3, 4] as const
  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 md:py-16">
        <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight md:text-5xl">
          {t(`${page}Title`)}
        </h1>
        <p role="note" className="flex items-start gap-2 rounded-xl bg-blush px-4 py-3 text-base">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-plum" aria-hidden />
          {t("placeholderNotice")}
        </p>
        {sections.map((n) => (
          <section key={n} className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">{t(`${page}S${n}Title`)}</h2>
            <p className="text-base text-muted-foreground">{t(`${page}S${n}Body`)}</p>
          </section>
        ))}
      </div>
    </>
  )
}
