"use client"

import { useMutation, useQuery } from "convex/react"
import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, PlusIcon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { useErrorMessage } from "@/lib/use-error-message"
import { useRoleName } from "./role-label"

/**
 * The header's shop switcher (CLAUDE.md "Team accounts"): shown when the
 * person owns or belongs to more than one shop, or works in someone else's
 * shop (then it also offers "Create your own shop" and "Leave"). Paused or
 * suspended shops are listed, not selectable. Switching goes to the
 * dashboard home, which every role can open.
 */
export function ShopSwitcher() {
  const t = useTranslations("Team.switcher")
  const roleName = useRoleName()
  const viewer = useQuery(api.users.viewer, {})
  const switchShop = useMutation(api.team.switchShop)
  const leave = useMutation(api.team.leaveShop)
  const errorMessage = useErrorMessage()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  if (!viewer?.shop) return null
  const current = viewer.shop
  if (viewer.shops.length < 2 && current.role === "owner") return null

  async function pick(shopId: Id<"shops">) {
    if (shopId === current.id) return
    try {
      await switchShop({ shopId })
      router.push("/dashboard")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function leaveCurrent() {
    try {
      await leave({ shopId: current.id })
      setLeaving(false)
      router.push("/dashboard")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label", { shop: current.name })}
        className="flex min-h-11 max-w-[8.5rem] min-w-0 items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm font-medium focus-ring hover:bg-muted sm:max-w-xs md:min-h-9"
      >
        <StoreIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{current.name}</span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
          {viewer.shops.map((shop) => {
            const usable = shop.state === "active"
            return (
              <DropdownMenuItem key={shop.id} disabled={!usable} onClick={() => void pick(shop.id)} className="items-start gap-2 py-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                    <img src={shop.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <StoreIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{shop.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {roleName(shop.role)}
                    {usable ? null : ` · ${t(`state.${shop.state}`)}`}
                  </span>
                </span>
                <CheckIcon className={cn("mt-1 size-4 shrink-0", shop.id === current.id ? "opacity-100" : "opacity-0")} aria-hidden />
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        {current.role !== "owner" || !viewer.ownsShop ? <DropdownMenuSeparator /> : null}
        {viewer.ownsShop ? null : (
          <DropdownMenuItem onClick={() => router.push("/onboarding")}>
            <PlusIcon />
            {t("createOwn")}
          </DropdownMenuItem>
        )}
        {current.role !== "owner" ? (
          <DropdownMenuItem onClick={() => setLeaving(true)}>
            <LogOutIcon />
            {t("leave", { shop: current.name })}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={leaving} onOpenChange={setLeaving}>
      <DialogContent>
        <DialogTitle>{t("leaveTitle", { shop: current.name })}</DialogTitle>
        <DialogDescription>{t("leaveBody")}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLeaving(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={() => void leaveCurrent()}>
            {t("leaveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
