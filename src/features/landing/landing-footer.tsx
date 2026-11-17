import { MailIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { waChatLink } from "@/lib/whatsapp"
import { contactEmail, contactWhatsapp } from "./config"

const linkClass = "inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-8"

export async function LandingFooter() {
  const t = await getTranslations("Landing")
  const hasContact = contactEmail || contactWhatsapp
  return (
    <footer className="border-t bg-card px-4 pt-12 pb-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-4">
        <div className="flex flex-col gap-3 md:col-span-2">
          <Brand />
          <p className="max-w-sm text-sm text-muted-foreground">{t("footerTagline")}</p>
          <LanguageSwitcher className="self-start" />
        </div>
        <nav aria-label={t("footerProduct")} className="flex flex-col gap-1 text-sm">
          <p className="mb-1 font-semibold">{t("footerProduct")}</p>
          <a href="#how" className={linkClass}>{t("navHow")}</a>
          <a href="#why" className={linkClass}>{t("navWhy")}</a>
          <a href="#demo" className={linkClass}>{t("navDemo")}</a>
        </nav>
        <div className="flex flex-col gap-6 text-sm">
          <nav aria-label={t("footerAccount")} className="flex flex-col gap-1">
            <p className="mb-1 font-semibold">{t("footerAccount")}</p>
            <Link href="/login" className={linkClass}>{t("login")}</Link>
            <Link href="/signup" className={linkClass}>{t("ctaShort")}</Link>
          </nav>
          {hasContact ? (
            <div className="flex flex-col gap-1">
              <p className="mb-1 font-semibold">{t("footerContact")}</p>
              {contactWhatsapp ? (
                <a href={waChatLink(contactWhatsapp, "")} className={`${linkClass} gap-2`} rel="noopener" target="_blank">
                  <MessageCircleIcon className="size-4" aria-hidden />
                  {t("footerWhatsapp")}
                </a>
              ) : null}
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className={`${linkClass} gap-2`}>
                  <MailIcon className="size-4" aria-hidden />
                  {contactEmail}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <p className="mx-auto mt-10 w-full max-w-6xl border-t pt-6 text-xs text-muted-foreground">
        {t("footerRights", { year: new Date().getFullYear() })}
      </p>
    </footer>
  )
}
