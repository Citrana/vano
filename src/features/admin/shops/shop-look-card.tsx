"use client"

import { useMutation, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { ProfileDecorationId } from "../../../../convex/lib/looks/profile"
import { RESET_REASON_MAX, RESET_REASON_MIN, resetReasonProblem, type ResetScope } from "../../../../convex/lib/looks/reset"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ShopLookScope } from "@/features/shop-looks/look-scope"
import { ShopBanner } from "@/features/shop-looks/shop-banner"
import { ChoiceGroup } from "@/features/shop-looks/editor/choice-group"
import { useErrorMessage } from "@/lib/use-error-message"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"

/** Reset a shop's look (banner only, profile photo only, or everything) with a required reason. */
function ResetLookDialog({ shopId, name }: { shopId: Id<"shops">; name: string }) {
  const t = useTranslations("AdminShops.look")
  const tc = useTranslations("Common")
  const reset = useMutation(api.admin.shopLooks.reset)
  const errorMessage = useErrorMessage()
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ResetScope>("banner")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const invalid = resetReasonProblem(reason) !== null

  async function confirm() {
    setPending(true)
    try {
      await reset({ shopId, scope, reason })
      toast.success(t("resetDone"))
      setOpen(false)
      setReason("")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("reset")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("resetTitle", { name })}</DialogTitle>
          <DialogDescription>{t("resetBody")}</DialogDescription>
          <ChoiceGroup
            label={t("scope")}
            value={scope}
            onChange={setScope}
            options={[
              { value: "banner", label: t("scopeBanner") },
              { value: "profile", label: t("scopeProfile") },
              { value: "all", label: t("scopeAll") },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            {scope === "banner" ? t("scopeBannerHint") : scope === "profile" ? t("scopeProfileHint") : t("scopeAllHint")}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId} required>
              {t("reason")}
            </Label>
            <Textarea
              id={reasonId}
              required
              value={reason}
              maxLength={RESET_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${reasonId}-help`}
            />
            <p id={`${reasonId}-help`} className="text-xs text-muted-foreground">
              {t("reasonHelp", { min: RESET_REASON_MIN, max: RESET_REASON_MAX })}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button variant="destructive" onClick={confirm} disabled={pending || invalid}>
              {t("reset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The shop drawer's look card: what visitors see, banner texts, and the reset. */
export function ShopLookCard({
  shopId,
  name,
  canReset,
  isOwnShop,
}: {
  shopId: Id<"shops">
  name: string
  canReset: boolean
  isOwnShop: boolean
}) {
  const t = useTranslations("AdminShops.look")
  const tl = useTranslations("ShopLooks")
  const td = useTranslations("ProfileDecorations")
  const format = useFormatter()
  const look = useQuery(api.admin.shopLooks.get, { shopId })

  if (look === undefined) return <LoadingState className="py-6" />
  if (look === null) return null
  // What visitors see now (the event banner while it's live), else the saved design.
  const shown = look.promo?.live ? look.visible : (look.published ?? look.visible)
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  const promoLine = (promo: NonNullable<typeof look.promo>) =>
    [
      promo.headline,
      promo.subline,
      t("promoDates", {
        start: promo.startsAt ? date(promo.startsAt) : t("promoNoStart"),
        end: promo.endsAt ? date(promo.endsAt) : t("promoNoEnd"),
      }),
    ]
      .filter(Boolean)
      .join(" · ")
  const announcementLine = (a: NonNullable<typeof look.announcement>) =>
    [
      a.text || t("promoBarNoText"),
      a.title ? t("promoBarTitle", { title: a.title }) : null,
      t("promoDates", {
        start: a.startsAt ? date(a.startsAt) : t("promoNoStart"),
        end: a.endsAt ? date(a.endsAt) : t("promoNoEnd"),
      }),
    ]
      .filter(Boolean)
      .join(" · ")

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      {shown.banner.kind !== "none" ? (
        <ShopLookScope look={shown} className="overflow-hidden rounded-lg border">
          <ShopBanner banner={shown.banner} sizing="phone" priority={false} />
        </ShopLookScope>
      ) : null}
      <DetailList>
        <DetailItem label={t("preset")}>
          {tl(`presets.${shown.preset}`)}
          {look.hiddenByPlan ? ` · ${t("hiddenByPlan")}` : ""}
        </DetailItem>
        <DetailItem label={t("bannerText")}>{look.publishedBannerText ?? t("none")}</DetailItem>
        {look.promo ? (
          <DetailItem label={t("promo")}>
            {promoLine(look.promo)} · {look.promo.live ? t("promoLive") : t("promoNotLive")}
          </DetailItem>
        ) : null}
        {look.draftPromo ? <DetailItem label={t("draftPromo")}>{promoLine(look.draftPromo)}</DetailItem> : null}
        {look.announcement ? (
          <DetailItem label={t("announcement")}>
            {announcementLine(look.announcement)} · {look.announcement.live ? t("promoLive") : t("promoNotLive")}
          </DetailItem>
        ) : null}
        {look.draftAnnouncement ? (
          <DetailItem label={t("draftAnnouncement")}>{announcementLine(look.draftAnnouncement)}</DetailItem>
        ) : null}
        {look.decoration || look.draftDecoration ? (
          <DetailItem label={t("decoration")}>
            {[
              look.decoration ? `${td(`items.${look.decoration as ProfileDecorationId}`)} · ${look.decorationLive ? t("promoLive") : t("promoNotLive")}` : null,
              look.draftDecoration && look.draftDecoration !== look.decoration
                ? t("draftDecoration", { name: td(`items.${look.draftDecoration as ProfileDecorationId}`) })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </DetailItem>
        ) : null}
        {look.draftBannerText || look.draftHasPhoto ? (
          <DetailItem label={t("draft")}>
            {[look.draftBannerText, look.draftHasPhoto ? t("draftPhoto") : null].filter(Boolean).join(" · ")}
          </DetailItem>
        ) : null}
        <DetailItem label={t("publishedAt")}>
          {look.publishedAt ? format.dateTime(new Date(look.publishedAt), { dateStyle: "medium" }) : t("never")}
        </DetailItem>
        {look.resetByAdminAt ? (
          <DetailItem label={t("lastReset")}>{format.dateTime(new Date(look.resetByAdminAt), { dateStyle: "medium" })}</DetailItem>
        ) : null}
      </DetailList>
      {canReset && !isOwnShop ? (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("resetHint")}</p>
          <ResetLookDialog shopId={shopId} name={name} />
        </div>
      ) : null}
    </Card>
  )
}
