"use client"

import { useMutation } from "convex/react"
import { EyeIcon, EyeOffIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { useErrorMessage } from "@/lib/use-error-message"
import { useAdminViewer } from "../shell/use-admin-viewer"

/**
 * Per-product admin actions, shown in the product drawer and the shop
 * drawer: view (when public), hide/unhide (reversible, one click),
 * delete (with confirmation). Hidden without the permission; the server
 * checks anyway.
 */
export function ProductActions({
  product,
  onDeleted,
}: {
  product: { _id: Id<"products">; name: string; hidden: boolean; shopSlug: string; shopActive: boolean }
  onDeleted?: () => void
}) {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Common")
  const { viewer } = useAdminViewer()
  const setHidden = useMutation(api.admin.products.setHidden)
  const remove = useMutation(api.admin.products.remove)
  const errorMessage = useErrorMessage()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const canHide = viewer?.permissions.includes("products.hide") ?? false
  const canDelete = viewer?.permissions.includes("products.delete") ?? false

  async function toggleHidden() {
    setPending(true)
    try {
      await setHidden({ productId: product._id, hidden: !product.hidden })
      toast.success(product.hidden ? t("unhidden") : t("hiddenToast"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function confirmDelete() {
    setPending(true)
    try {
      await remove({ productId: product._id })
      toast.success(t("deleted"))
      setConfirmOpen(false)
      onDeleted?.()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center">
      {!product.hidden && product.shopActive ? (
        <a
          href={`/${product.shopSlug}/${product._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          aria-label={`${t("view")}: ${product.name}`}
        >
          <ExternalLinkIcon />
        </a>
      ) : null}
      {canHide ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleHidden}
          disabled={pending}
          aria-label={`${product.hidden ? t("unhide") : t("hide")}: ${product.name}`}
          title={product.hidden ? t("unhide") : t("hide")}
        >
          {product.hidden ? <EyeIcon /> : <EyeOffIcon />}
        </Button>
      ) : null}
      {canDelete ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            aria-label={`${tc("delete")}: ${product.name}`}
          >
            <Trash2Icon />
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogTitle>{t("deleteTitle")}</DialogTitle>
              <DialogDescription>{t("deleteBody", { name: product.name })}</DialogDescription>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
                <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete} disabled={pending}>
                  {pending ? tc("deleting") : tc("delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  )
}
