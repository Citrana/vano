"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { CountryCode } from "libphonenumber-js"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { LIMITS } from "../../../convex/lib/catalog"
import { CHANGE_REASON_MAX, CODE_LENGTH, type ProtectedField } from "../../../convex/lib/changeRequests"
import { splitWhatsapp } from "../../../convex/lib/phone"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Textarea } from "@/components/ui/textarea"
import { DialCodeSelect } from "@/features/shop/dial-code-select"
import { SlugStatus } from "@/features/shop/slug-status"
import { displayShopUrl } from "@/lib/site"
import { useErrorMessage } from "@/lib/use-error-message"
import { changeRequestSchema, fullWhatsapp, type ChangeRequestValues } from "./schemas"

type Verification = {
  verificationId: Id<"phoneVerifications">
  phone: string
  devCode: string | null
  verified: boolean
}

/**
 * Ask to change a protected field: the new value, a reason, and for a new
 * WhatsApp number a code sent to it. The server checks everything again.
 */
export function ChangeRequestDialog({
  field,
  open,
  onOpenChange,
  current,
  country,
  inCooldown,
}: {
  field: ProtectedField
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The live value (E.164 for WhatsApp). */
  current: string
  /** The shop's country, the default dial code. */
  country: string
  inCooldown: boolean
}) {
  const t = useTranslations("ChangeRequests")
  const tf = useTranslations("ShopForm")
  const tv = useTranslations("Validation")
  const tc = useTranslations("Common")
  const te = useTranslations("Errors")
  const errorMessage = useErrorMessage()
  const create = useMutation(api.changeRequests.create)
  const sendCode = useMutation(api.changeRequests.sendPhoneCode)
  const verifyCode = useMutation(api.changeRequests.verifyPhoneCode)

  const defaultDial = splitWhatsapp(current, country as CountryCode).country
  const form = useForm<ChangeRequestValues>({
    resolver: zodResolver(changeRequestSchema(tv, field)),
    defaultValues: { newValue: "", whatsappCountry: defaultDial, whatsappNumber: "", reason: "" },
  })
  const { register, control, formState, setValue, trigger } = form
  const { errors, isSubmitting } = formState
  const [newValue, reason, whatsappCountry, whatsappNumber] = useWatch({
    control,
    name: ["newValue", "reason", "whatsappCountry", "whatsappNumber"],
  })

  const [verification, setVerification] = useState<Verification | null>(null)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"send" | "verify" | null>(null)
  const typedPhone = fullWhatsapp({ whatsappCountry, whatsappNumber })
  // Editing the number after sending means the code no longer applies.
  const activeVerification = verification && verification.phone === typedPhone ? verification : null

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      form.reset()
      setVerification(null)
      setCode("")
      setCodeError(null)
    }
  }

  async function onSend() {
    if (!(await trigger("whatsappNumber")) || !typedPhone) return
    setBusy("send")
    setCodeError(null)
    try {
      const sent = await sendCode({ phone: typedPhone })
      setVerification({ ...sent, verified: false })
      setCode("")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function onVerify() {
    if (!activeVerification) return
    setBusy("verify")
    try {
      const result = await verifyCode({ verificationId: activeVerification.verificationId, code })
      if (result.ok) {
        setVerification({ ...activeVerification, verified: true })
        setCodeError(null)
      } else {
        setCodeError(te(result.code))
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  async function submit(values: ChangeRequestValues) {
    try {
      if (field === "whatsapp") {
        if (!activeVerification?.verified) {
          setCodeError(te("PHONE_NOT_VERIFIED"))
          return
        }
        await create({
          field,
          newValue: activeVerification.phone,
          reason: values.reason,
          verificationId: activeVerification.verificationId,
        })
      } else {
        await create({ field, newValue: values.newValue, reason: values.reason })
      }
      toast.success(t("sent"))
      close(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const needsVerification = field === "whatsapp"
  const canSubmit = !needsVerification || activeVerification?.verified === true

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogTitle>{t(`title.${field}`)}</DialogTitle>
        <DialogDescription>{t("dialogBody")}</DialogDescription>
        {inCooldown ? (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("cooldownWarning")}
          </p>
        ) : null}
        <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          <RequiredFieldsHint />

          {field === "name" ? (
            <Field id="cr-newValue" label={t("newName")} required error={errors.newValue?.message}>
              {(p) => <Input {...p} maxLength={LIMITS.shopNameMax} placeholder={tf("namePlaceholder")} {...register("newValue")} />}
            </Field>
          ) : null}

          {field === "slug" ? (
            <Field
              id="cr-newValue"
              label={t("newSlug")}
              required
              help={<span className="break-all">{tf("slugHelp", { url: displayShopUrl(newValue || "…") })}</span>}
              error={errors.newValue?.message}
            >
              {(p) => (
                <div className="flex flex-col gap-1.5">
                  <Input
                    {...p}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={30}
                    {...register("newValue", {
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setValue("newValue", e.target.value.toLowerCase().replace(/\s+/g, "-")),
                    })}
                  />
                  <SlugStatus slug={newValue} />
                </div>
              )}
            </Field>
          ) : null}

          {needsVerification ? (
            <>
              <Field id="cr-whatsappNumber" label={t("newWhatsapp")} required error={errors.whatsappNumber?.message}>
                {(p) => (
                  <div className="flex items-stretch">
                    <DialCodeSelect country={whatsappCountry} label={tf("whatsappCode")} registration={register("whatsappCountry")} />
                    <Input
                      {...p}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      className="rounded-l-none"
                      placeholder={tf("whatsappPlaceholder")}
                      {...register("whatsappNumber")}
                    />
                  </div>
                )}
              </Field>

              {activeVerification?.verified ? (
                <p role="status" className="flex items-center gap-2 font-medium text-success">
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  {t("verified")}
                </p>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <p className="text-muted-foreground">{activeVerification ? t("codeSent") : t("codeHelp")}</p>
                  {activeVerification?.devCode ? (
                    <p role="status" className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      {t("testModeCode", { code: activeVerification.devCode })}
                    </p>
                  ) : null}
                  {activeVerification ? (
                    <Field id="cr-code" label={t("code")} required error={codeError ?? undefined}>
                      {(p) => (
                        <div className="flex gap-2">
                          <Input
                            {...p}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            className="font-mono tracking-widest"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onVerify}
                            disabled={code.length !== CODE_LENGTH || busy !== null}
                          >
                            {busy === "verify" ? <Loader2Icon className="animate-spin" /> : null}
                            {t("verify")}
                          </Button>
                        </div>
                      )}
                    </Field>
                  ) : null}
                  <Button type="button" variant="outline" className="self-start" onClick={onSend} disabled={busy !== null}>
                    {busy === "send" ? <Loader2Icon className="animate-spin" /> : null}
                    {activeVerification ? t("resend") : t("sendCode")}
                  </Button>
                </div>
              )}
            </>
          ) : null}

          <Field
            id="cr-reason"
            label={t("reason")}
            required
            help={t("reasonHelp", { count: reason?.trim().length ?? 0, max: CHANGE_REASON_MAX })}
            error={errors.reason?.message}
          >
            {(p) => <Textarea {...p} rows={3} maxLength={CHANGE_REASON_MAX} placeholder={t("reasonPlaceholder")} {...register("reason")} />}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? t("sending") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
