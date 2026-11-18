import { CheckCheckIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatMoney } from "../../../../convex/lib/money"
import { DEMO_CURRENCY, DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { buildOrderMessage } from "@/lib/whatsapp"

/**
 * WhatsApp mock from the seller's side: the customer's prefilled order
 * (built with the real buildOrderMessage), then either the customer typing
 * or the seller's reply. Decorative: hidden from screen readers, not
 * selectable.
 */
export async function OrderChat({ reply, typing = !reply }: { reply?: { text: string; time: string }; typing?: boolean }) {
  const t = await getTranslations("Home")
  const tp = await getTranslations("Public")
  const td = await getTranslations("Demo")
  const locale = await getLocale()

  const product = DEMO_PRODUCTS[0]
  const message = buildOrderMessage(tp, {
    product: td(`products.${product.id}.name`),
    price: formatMoney(product.price, DEMO_CURRENCY, locale),
    size: "M",
    url: t("floatLinkUrl"),
  })

  return (
    <div aria-hidden className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-card border shadow-float select-none">
      <div className="flex items-center gap-3 bg-whatsapp px-4 py-3 text-white">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{t("chatCustomer").charAt(0)}</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t("chatCustomer")}</p>
          <p className="text-xs text-white/80">{t("chatOnline")}</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 bg-muted p-4">
        {/* Received order (the seller's view). */}
        <div className="max-w-[88%] rounded-xl rounded-tl-sm bg-card px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground">
          {message}
          <span className="mt-1 block text-right text-xs text-muted-foreground">{t("chatTime")}</span>
        </div>
        {reply ? (
          /* The seller's answer (sent, so it gets read ticks). */
          <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-success/15 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
            {reply.text}
            <span className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
              {reply.time}
              <CheckCheckIcon className="size-3.5 text-whatsapp" />
            </span>
          </div>
        ) : null}
        {typing ? (
          /* The customer is typing another message. */
          <div className="flex items-center gap-1 rounded-xl rounded-tl-sm bg-card px-3.5 py-3">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 animate-typing rounded-full bg-muted-foreground motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
