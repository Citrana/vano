"use client"

import { CheckIcon, CopyIcon, ExternalLinkIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { displayShopUrl, shopUrl } from "@/lib/site"
import { waShareLink } from "@/lib/whatsapp"

export const SHARE_CARD_ID = "share-link"

/**
 * The shop link with WhatsApp share, copy and open buttons. Shows the short
 * link (`vano.app/shop`); copies and shares the full one. `onShared` runs
 * after a WhatsApp share or a copy (the dashboard checklist uses it).
 */
export function ShareShopCard({ name, slug, onShared }: { name: string; slug: string; onShared?: () => void }) {
  const t = useTranslations("Share")
  const url = shopUrl(slug)
  const shown = displayShopUrl(slug)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt(t("copy"), url)
    }
    onShared?.()
  }

  return (
    <Card id={SHARE_CARD_ID} tabIndex={-1} className="scroll-mt-24 bg-secondary ring-0 outline-none" aria-labelledby="share-title">
      <CardHeader>
        <CardTitle id="share-title">{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <p className="truncate rounded-lg bg-card px-3 py-2.5 font-mono text-sm" title={url}>
        {shown}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <a
          href={waShareLink(t("message", { shop: name, url }))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShared}
          className={buttonVariants({ variant: "whatsapp", className: "col-span-2" })}
        >
          <MessageCircleIcon />
          {t("whatsapp")}
        </a>
        <Button variant="outline" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </Button>
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <ExternalLinkIcon />
          {t("open")}
        </a>
      </div>
    </Card>
  )
}
