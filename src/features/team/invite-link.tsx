"use client"

import { CheckIcon, CopyIcon, MailCheckIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { invitePath } from "../../../convex/lib/team"
import { Button, buttonVariants } from "@/components/ui/button"
import { siteUrl } from "@/lib/site"
import { waShareLink } from "@/lib/whatsapp"

/** The full invite link for a token (shown once: only its hash is stored). */
export function inviteUrl(token: string): string {
  return `${siteUrl()}${invitePath(token)}`
}

/**
 * A fresh invite link with Copy and "Share on WhatsApp" (CLAUDE.md "Team
 * accounts"), and a note when Vano also emailed it.
 */
export function InviteLink({ token, shopName, email }: { token: string; shopName: string; email: string | null }) {
  const t = useTranslations("Team.link")
  const url = inviteUrl(token)
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
  }

  return (
    <div className="flex flex-col gap-3">
      {email ? (
        <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("emailed", { email })}</span>
        </p>
      ) : null}
      <p className="truncate rounded-lg border bg-muted px-3 py-2.5 font-mono text-xs" title={url}>
        {url}
      </p>
      <p className="text-xs text-muted-foreground">{t("once")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={waShareLink(t("message", { shop: shopName, url }))}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp" })}
        >
          <MessageCircleIcon />
          {t("whatsapp")}
        </a>
        <Button variant="outline" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </Button>
      </div>
    </div>
  )
}
