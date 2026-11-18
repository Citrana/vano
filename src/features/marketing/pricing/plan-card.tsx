import { CheckIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { OpenShopCta } from "@/features/marketing/shared/open-shop-cta"
import { contactEmail, whatsappHref } from "@/features/marketing/shared/site-config"
import { formatPlanPrice, type Plan } from "./plans"

/** Where "Talk to us" goes: WhatsApp (prefilled), else email, else Help contact. */
function talkHref(message: string): string {
  return whatsappHref(message) ?? (contactEmail ? `mailto:${contactEmail}` : "/help#contact")
}

export async function PlanCard({ plan, locale }: { plan: Plan; locale: string }) {
  const t = await getTranslations("Pricing")
  const highlight = plan.highlight === true
  const headingId = `plan-${plan.id}`

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "relative flex h-full flex-col gap-5 rounded-3xl bg-card p-6 ring-1",
        highlight ? "shadow-lift ring-2 ring-plum/60" : "shadow-soft ring-foreground/5",
      )}
    >
      {highlight ? <Badge className="absolute -top-3 left-6 h-7 px-3 text-sm">{t("mostPopular")}</Badge> : null}
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl font-extrabold">
          {t(`plans.${plan.id}.name`)}
        </h2>
        <p className="text-base text-muted-foreground">{t(`plans.${plan.id}.tagline`)}</p>
      </div>
      <div className="flex flex-col">
        {plan.priceMinor === null ? (
          <>
            <p className="font-heading text-3xl font-extrabold tracking-tight">{t("customPrice")}</p>
            <p className="text-sm text-muted-foreground">{t("plans.enterprise.priceNote")}</p>
          </>
        ) : (
          <p className="flex items-baseline gap-1">
            <span className="font-heading text-4xl font-extrabold tracking-tight tabular-nums">{formatPlanPrice(plan.priceMinor, locale)}</span>
            {plan.priceMinor > 0 ? <span className="text-base text-muted-foreground">{t("perMonth")}</span> : null}
          </p>
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f.key} className="flex items-start gap-2 text-base">
            <CheckIcon className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={3} aria-hidden />
            <span>{t(`features.${f.key}`, f.values)}</span>
          </li>
        ))}
      </ul>
      {/* mt-auto pins the button to the card bottom so all cards line up. */}
      <div className="mt-auto">
        {plan.cta === "talk" ? (
          <a
            href={talkHref(t("enterpriseMessage"))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
          >
            <MessageCircleIcon aria-hidden />
            {t("ctaTalk")}
          </a>
        ) : (
          <OpenShopCta
            variant={highlight ? "default" : "outline"}
            label={plan.cta === "free" ? t("ctaFree") : t("ctaTrial")}
            className="w-full"
          />
        )}
      </div>
    </article>
  )
}
