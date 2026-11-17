import { MailIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { contact } from "./config"

const linkClass = "inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-8"

/** Landing footer; section links point at "/#…" so it also works on the legal pages. */
export async function LandingFooter() {
  const t = await getTranslations("Landing")
  return (
    <footer className="border-t bg-card px-4 pt-12 pb-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-4">
        <div className="flex flex-col gap-3 md:col-span-2">
          <Brand />
          <p className="max-w-sm text-base text-muted-foreground">{t("footerTagline")}</p>
          <LanguageSwitcher className="self-start" />
        </div>
        <nav aria-label={t("footerProduct")} className="flex flex-col gap-1 text-sm">
          <p className="mb-1 font-semibold">{t("footerProduct")}</p>
          <Link href="/#how" className={linkClass}>{t("navHow")}</Link>
          <Link href="/#why" className={linkClass}>{t("navWhy")}</Link>
          <Link href="/#demo" className={linkClass}>{t("navDemo")}</Link>
        </nav>
        <div className="flex flex-col gap-6 text-sm">
          <nav aria-label={t("footerAccount")} className="flex flex-col gap-1">
            <p className="mb-1 font-semibold">{t("footerAccount")}</p>
            <Link href="/login" className={linkClass}>{t("login")}</Link>
            <Link href="/signup" className={linkClass}>{t("ctaShort")}</Link>
          </nav>
          {contact ? (
            <div className="flex flex-col gap-1">
              <p className="mb-1 font-semibold">{t("footerContact")}</p>
              {contact.kind === "whatsapp" ? (
                <a href={contact.href} className={`${linkClass} gap-2`} rel="noopener" target="_blank">
                  <MessageCircleIcon className="size-4" aria-hidden />
                  {t("footerWhatsapp")}
                </a>
              ) : (
                <a href={contact.href} className={`${linkClass} gap-2`}>
                  <MailIcon className="size-4" aria-hidden />
                  <span className="sr-only">{t("footerEmail")}: </span>
                  {contact.label}
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{t("footerRights", { year: new Date().getFullYear() })}</p>
        <nav aria-label={t("footerLegal")} className="flex gap-6">
          <Link href="/terms" className={linkClass}>{t("footerTerms")}</Link>
          <Link href="/privacy" className={linkClass}>{t("footerPrivacy")}</Link>
        </nav>
      </div>
    </footer>
  )
}
