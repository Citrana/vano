"use client"

import { CopyIcon, ExternalLinkIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { shopUrl } from "@/lib/site"
import { waShareLink } from "@/lib/whatsapp"

/** The shop link with copy, WhatsApp share and open buttons. */
export function ShareShopCard({ name, slug }: { name: string; slug: string }) {
  const t = useTranslations("Share")
  const url = shopUrl(slug)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("copied"))
    } catch {
      window.prompt(t("copy"), url)
    }
  }

  return (
    <Card className="bg-secondary ring-0">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <p className="truncate rounded-lg bg-card px-3 py-2.5 font-mono text-sm" title={url}>
        {url}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <a
          href={waShareLink(t("message", { shop: name, url }))}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp", className: "col-span-2" })}
        >
          <MessageCircleIcon />
          {t("whatsapp")}
        </a>
        <Button variant="outline" onClick={copy}>
          <CopyIcon />
          {t("copy")}
        </Button>
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          <ExternalLinkIcon />
          {t("open")}
        </a>
      </div>
    </Card>
  )
}
