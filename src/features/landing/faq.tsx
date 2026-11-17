import { ChevronDownIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Reveal } from "./reveal"
import { Section } from "./section"

const ITEMS = [1, 2, 3, 4] as const

/** Native <details> list: no JS, keyboard and screen-reader friendly. */
export async function Faq() {
  const t = await getTranslations("Landing")
  return (
    <Section id="faq" eyebrow={t("faqEyebrow")} title={t("faqTitle")}>
      <Reveal className="mx-auto w-full max-w-3xl">
        <ul className="flex flex-col gap-3">
          {ITEMS.map((n) => (
            <li key={n}>
              <details className="group rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5 open:ring-foreground/10">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-lg [&::-webkit-details-marker]:hidden">
                  {t(`faqQ${n}`)}
                  <ChevronDownIcon
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-5 pb-5 text-base text-muted-foreground">{t(`faqA${n}`)}</p>
              </details>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
