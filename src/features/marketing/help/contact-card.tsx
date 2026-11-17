import { MailIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { contactEmail, whatsappHref } from "@/features/marketing/shared/site-config"

/** Help contact (anchor #contact) + Terms/Privacy links. Values from site-config. */
export async function ContactCard() {
  const t = await getTranslations("Help")
  const tm = await getTranslations("Marketing")
  const whatsapp = whatsappHref()
  return (
    <section id="contact" aria-labelledby="contact-title" className="mx-auto grid w-full max-w-3xl scroll-mt-24 gap-4 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4 rounded-3xl bg-blush p-6 md:p-8">
        <div>
          <h2 id="contact-title" className="text-2xl font-extrabold">
            {t("contactTitle")}
          </h2>
          <p className="text-base text-foreground/80">{t("contactBody")}</p>
        </div>
        {whatsapp || contactEmail ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "whatsapp", size: "lg" })}>
                <MessageCircleIcon aria-hidden />
                {t("contactWhatsapp")}
              </a>
            ) : null}
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <MailIcon aria-hidden />
                {t("contactEmail")}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-base text-muted-foreground">{t("contactSoon")}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-foreground/5">
        <h2 className="text-lg font-bold">{t("legalTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("legalBody")}</p>
        <Link href="/terms" className="min-h-11 content-center text-base font-medium underline underline-offset-4">
          {tm("footerTerms")}
        </Link>
        <Link href="/privacy" className="min-h-11 content-center text-base font-medium underline underline-offset-4">
          {tm("footerPrivacy")}
        </Link>
      </div>
    </section>
  )
}
