import { MessageCircleIcon, ShirtIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import { buttonVariants } from "@/components/ui/button"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const steps = [
    { icon: StoreIcon, title: t("step1"), body: t("step1Body") },
    { icon: ShirtIcon, title: t("step2"), body: t("step2Body") },
    { icon: MessageCircleIcon, title: t("step3"), body: t("step3Body") },
  ]
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            {t("login")}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10 md:py-20">
        <section className="flex max-w-2xl flex-col gap-5">
          <h1 className="font-heading text-4xl leading-tight font-semibold text-balance md:text-6xl">{t("title")}</h1>
          <p className="text-lg text-muted-foreground text-pretty">{t("subtitle")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              {t("cta")}
            </Link>
            <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline" })}>
              {t("dashboard")}
            </Link>
          </div>
        </section>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">
                  {i + 1}. {title}
                </p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
