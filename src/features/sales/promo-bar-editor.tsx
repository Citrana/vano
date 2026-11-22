"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { AnnouncementFacet } from "../../../convex/lib/looks/announcement"
import { cleanAnnouncement, samePromoBar } from "../../../convex/lib/looks/clean"
import { hasBlockingProblem, lookProblems, type LookProblem } from "../../../convex/lib/looks/contrast"
import { resolveAnnouncement } from "../../../convex/lib/looks/resolve"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { PromoBar } from "@/features/public/promo-bar"
import { ShopLookScope } from "@/features/shop-looks/look-scope"
import { useErrorMessage } from "@/lib/use-error-message"
import { PromoBarForm } from "./promo-bar-form"

/** The sample sale ("Preview with a sample sale"): 20% off, ending in two days at the next full hour. */
function sampleSale() {
  const hour = 3_600_000
  return { percent: 20, uniform: false, endsAt: Math.ceil(Date.now() / hour) * hour + 48 * hour }
}

/**
 * The Promo bar editor at the top of the Sales page (CLAUDE.md "Shop
 * looks"): a live preview drawn exactly as shoppers see it (the shop's
 * look, the real running sale or the message) and the options beside it
 * (below on phones). One Save (`shopLooks.savePromoBar`, live at once)
 * and Discard. Without `announcementBar` the options are locked; turning
 * the bar off still works.
 */
export function PromoBarEditor() {
  const data = useQuery(api.shopLooks.promoBar, {})
  if (data === undefined) return null
  // A new key after each save or discard resets the form's text fields.
  return <PromoBarEditorLoaded key={JSON.stringify(data.bar)} data={data} />
}

type PromoBarData = FunctionReturnType<typeof api.shopLooks.promoBar>

function PromoBarEditorLoaded({ data }: { data: PromoBarData }) {
  const t = useTranslations("Sales.promoBar")
  const id = useId()
  const errorMessage = useErrorMessage()
  const save = useMutation(api.shopLooks.savePromoBar)
  const saved = data.bar ?? undefined
  const [form, setForm] = useState<AnnouncementFacet | undefined>(saved)
  const [formKey, setFormKey] = useState(0)
  const [sample, setSample] = useState(false)
  const [saving, setSaving] = useState(false)

  const { look } = data
  const resolved = resolveAnnouncement(form, look.colors)
  const problems = lookProblems({ colors: look.colors, buttons: look.buttons, announcement: resolved })
    .filter((p) => p.target === "announcement")
    // Only the bar's own text colour can be fixed from here (the accent is set in Look).
    .map((p): LookProblem => (p.fix?.field === "announcementText" ? p : { ...p, fix: null }))
  const dirty = !samePromoBar(form, saved)
  const invalid = form !== undefined && (cleanAnnouncement(form) === null || hasBlockingProblem(problems))
  // A locked plan can only turn the bar off.
  const blockedByPlan = !data.entitled && form !== undefined
  const sale = data.sale ?? (sample ? sampleSale() : null)

  async function onSave() {
    setSaving(true)
    try {
      await save({ bar: form ? (cleanAnnouncement(form) ?? form) : null })
      toast.success(t("saved"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    setForm(saved)
    setFormKey((k) => k + 1)
  }

  return (
    <Card id="promo-bar" className="scroll-mt-20 gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      {data.hiddenByPlan ? <p className="rounded-lg bg-muted p-3 text-sm">{t("hiddenByPlan")}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* The preview: the shop's look and the bar as shoppers see it. */}
        <div className="flex flex-col gap-2 lg:sticky lg:top-20">
          <span className="text-xs font-medium text-muted-foreground">{t("preview")}</span>
          <ShopLookScope look={look} className="overflow-hidden rounded-lg border bg-background">
            <div inert>
              {resolved ? (
                <PromoBar bar={resolved} sale={sale} slug={data.slug} preview />
              ) : null}
              {/* A hint of the page under the bar. */}
              <div aria-hidden className="flex flex-col gap-2 p-4">
                <div className="h-3 w-1/3 rounded-sm bg-muted" />
                <div className="h-3 w-1/2 rounded-sm bg-muted" />
              </div>
            </div>
          </ShopLookScope>
          {!resolved ? <p className="text-xs text-muted-foreground">{t("off")}</p> : null}
          {resolved && !sale && form?.text.trim() === "" ? (
            <p className="text-xs text-muted-foreground">{t("hiddenNow")}</p>
          ) : null}
          {data.sale === null && resolved ? (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${id}-sample`} className="text-sm">
                {t("sampleSale")}
              </label>
              <Switch id={`${id}-sample`} checked={sample} onCheckedChange={setSample} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <PromoBarForm
            key={formKey}
            value={form}
            onChange={setForm}
            colors={look.colors}
            problems={problems}
            onFix={(fix) => {
              if (fix.field === "announcementText" && form?.colors) setForm({ ...form, colors: { ...form.colors, foreground: fix.value } })
            }}
            saleLive={data.sale !== null}
            entitled={data.entitled}
            disabled={saving || (!data.entitled && form === undefined)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {dirty ? (
              <Button type="button" variant="ghost" onClick={discard} disabled={saving}>
                {t("discard")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onSave} disabled={!dirty || invalid || blockedByPlan || saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
