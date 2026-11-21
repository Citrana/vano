"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  CheckCircle2Icon,
  ClockIcon,
  FlaskConicalIcon,
  ReceiptIcon,
  SmartphoneIcon,
  XCircleIcon,
} from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import { formatMoney } from "../../../convex/lib/money"
import { isPaidPlan } from "../../../convex/lib/plans"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useErrorMessage } from "@/lib/use-error-message"
import { TestControls } from "./payment-history"
import { usePlanName } from "@/features/billing/use-plan-catalog"

type Payment = NonNullable<FunctionReturnType<typeof api.billing.payment>>

const backLink = buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })

/**
 * The checkout screen. It follows the payment live: the outcome is decided
 * on the server (provider result), never here. With the mock provider it
 * shows the test checkout; a real provider's `next` step (phone prompt,
 * hosted page) gets its own screen.
 */
export function CheckoutView({ paymentId }: { paymentId: string }) {
  const t = useTranslations("Checkout")
  const payment = useQuery(api.billing.payment, { paymentId })

  if (payment === undefined) return <LoadingState />
  if (payment === null) {
    return (
      <EmptyState
        icon={<ReceiptIcon />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/dashboard/billing" className={backLink}>
            {t("backToBilling")}
          </Link>
        }
      />
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Summary payment={payment} />
      <Step payment={payment} />
    </div>
  )
}

function Summary({ payment }: { payment: Payment }) {
  const t = useTranslations("Checkout")
  const planName = usePlanName()
  const locale = useLocale()
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{t("summary", { plan: planName(payment.plan) })}</p>
        <p className="font-heading text-xl font-extrabold tabular-nums">
          <span className="sr-only">{t("amount")}: </span>
          {formatMoney(payment.amountMinor, payment.currency, locale)}
        </p>
      </div>
    </Card>
  )
}

function Step({ payment }: { payment: Payment }) {
  const t = useTranslations("Checkout")
  const planName = usePlanName()
  const format = useFormatter()

  switch (payment.status) {
    case "created":
      return <LoadingState />
    case "succeeded":
      return (
        <Result
          icon={<CheckCircle2Icon className="text-success" />}
          title={t("successTitle")}
          body={
            payment.periodEndAfter === null
              ? null
              : t("successBody", {
                  plan: planName(payment.plan),
                  date: format.dateTime(new Date(payment.periodEndAfter), { dateStyle: "long" }),
                })
          }
          action={
            <Link href="/dashboard/billing" className={buttonVariants({ className: "w-full sm:w-auto" })}>
              {t("backToBilling")}
            </Link>
          }
        />
      )
    case "failed":
      return (
        <Result
          icon={<XCircleIcon className="text-destructive" />}
          title={t("failedTitle")}
          body={t("failedBody")}
          action={<RetryActions plan={payment.plan} />}
        />
      )
    case "cancelled":
    case "expired":
      return (
        <Result
          icon={<XCircleIcon className="text-muted-foreground" />}
          title={payment.status === "cancelled" ? t("cancelledTitle") : t("expiredTitle")}
          body={payment.status === "cancelled" ? t("cancelledBody") : t("expiredBody")}
          action={
            <Link href="/dashboard/billing" className={backLink}>
              {t("backToBilling")}
            </Link>
          }
        />
      )
    case "pending":
      return <PendingStep payment={payment} />
  }
}

function PendingStep({ payment }: { payment: Payment }) {
  const t = useTranslations("Checkout")
  const next = payment.next

  if (payment.pendingReportedAt !== null) {
    return (
      <Result
        icon={<ClockIcon className="text-muted-foreground" />}
        title={t("pendingTitle")}
        body={t("pendingBody")}
        action={
          <div className="flex w-full flex-col items-center gap-3">
            {payment.testMode && payment.provider === "mock" ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("testControls")}</p>
                <TestControls paymentId={payment._id} />
              </div>
            ) : null}
            <Link href="/dashboard/billing" className={backLink}>
              {t("backToBilling")}
            </Link>
          </div>
        }
      />
    )
  }
  if (next?.kind === "mockCheckout") {
    return payment.testMode ? (
      <MockCheckout payment={payment} />
    ) : (
      <Result
        icon={<FlaskConicalIcon className="text-muted-foreground" />}
        title={t("unavailableTitle")}
        body={t("unavailableBody")}
        action={<CancelButton payment={payment} />}
      />
    )
  }
  if (next?.kind === "redirect") {
    return (
      <Result
        icon={<ReceiptIcon className="text-muted-foreground" />}
        title={t("redirectTitle")}
        body={null}
        action={
          <a href={next.url} className={buttonVariants({ className: "w-full sm:w-auto" })}>
            {t("redirectAction")}
          </a>
        }
      />
    )
  }
  return (
    <Result
      icon={<SmartphoneIcon className="text-muted-foreground" />}
      title={t("phoneTitle")}
      body={t("phoneBody")}
      action={<CancelButton payment={payment} />}
    />
  )
}

/** Development-only test checkout: the seller plays the payment provider. */
function MockCheckout({ payment }: { payment: Payment }) {
  const t = useTranslations("Checkout")
  const simulate = useMutation(api.billing.mockSimulate)
  const errorMessage = useErrorMessage()
  const [busy, setBusy] = useState(false)

  async function run(outcome: "succeeded" | "failed" | "pending") {
    setBusy(true)
    try {
      await simulate({ paymentId: payment._id, outcome })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-dashed">
      <div role="note" className="flex items-start gap-3 rounded-lg bg-secondary p-3">
        <FlaskConicalIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="font-heading text-base font-bold uppercase tracking-wide">{t("testMode")}</p>
          <p className="text-muted-foreground">{t("testModeBody")}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={busy} onClick={() => run("succeeded")}>
          {t("simulateSuccess")}
        </Button>
        <Button variant="destructive" disabled={busy} onClick={() => run("failed")}>
          {t("simulateFailure")}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => run("pending")}>
          {t("simulatePending")}
        </Button>
        <CancelButton payment={payment} disabled={busy} />
      </div>
    </Card>
  )
}

function CancelButton({ payment, disabled = false }: { payment: Payment; disabled?: boolean }) {
  const t = useTranslations("Checkout")
  const cancel = useMutation(api.billing.cancelCheckout)
  const router = useRouter()
  const errorMessage = useErrorMessage()
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={async () => {
        try {
          await cancel({ paymentId: payment._id })
          router.push("/dashboard/billing")
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      {t("cancel")}
    </Button>
  )
}

function RetryActions({ plan }: { plan: Payment["plan"] }) {
  const t = useTranslations("Checkout")
  const startCheckout = useMutation(api.billing.startCheckout)
  const router = useRouter()
  const errorMessage = useErrorMessage()
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      {isPaidPlan(plan) ? (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const paymentId = await startCheckout({ plan })
              router.push(`/dashboard/billing/checkout/${paymentId}`)
            } catch (error) {
              toast.error(errorMessage(error))
              setBusy(false)
            }
          }}
        >
          {t("tryAgain")}
        </Button>
      ) : null}
      <Link href="/dashboard/billing" className={backLink}>
        {t("backToBilling")}
      </Link>
    </div>
  )
}

function Result({ icon, title, body, action }: { icon: ReactNode; title: string; body: string | null; action: ReactNode }) {
  return (
    <Card className="items-center py-8 text-center">
      <div className="[&_svg]:size-10" aria-hidden>
        {icon}
      </div>
      <h2 role="status" className="font-heading text-xl font-bold tracking-tight">
        {title}
      </h2>
      {body ? <p className="max-w-sm text-muted-foreground">{body}</p> : null}
      {action}
    </Card>
  )
}
