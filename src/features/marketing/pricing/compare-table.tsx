import { CheckIcon, ChevronDownIcon, MinusIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"
import { COMPARISON, PLANS, type CompareCell } from "./plans"

/** Sticky first column: stays visible while the table scrolls sideways on phones. */
const STICKY = "sticky left-0 z-10 bg-background"

/**
 * "Compare all features": a native <details> (no JS) holding one grouped
 * table. On phones the table scrolls inside its box with the feature names
 * pinned, so the page itself never scrolls sideways.
 * All values come from COMPARISON in plans.ts.
 */
export async function CompareTable() {
  const t = await getTranslations("Pricing")
  const lastGroup = COMPARISON.length - 1

  function Value({ cell }: { cell: CompareCell }) {
    if (cell === true) {
      return (
        <>
          <CheckIcon className="size-5 text-success" strokeWidth={3} aria-hidden />
          <span className="sr-only">{t("included")}</span>
        </>
      )
    }
    if (cell === false) {
      return (
        <>
          <MinusIcon className="size-5 text-muted-foreground/60" aria-hidden />
          <span className="sr-only">{t("notIncluded")}</span>
        </>
      )
    }
    if ("count" in cell) return <span className="tabular-nums">{cell.count}</span>
    return <span>{t(`compareValues.${cell.label}`)}</span>
  }

  return (
    <section aria-labelledby="compare-title" className="px-4 pb-10">
      <details className="group mx-auto w-full max-w-6xl">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-center gap-3 border-y px-5 py-4 text-base font-semibold focus-ring hover:bg-card/60 md:text-lg [&::-webkit-details-marker]:hidden">
          <span id="compare-title">{t("compareTitle")}</span>
          <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <p className="pt-4 pb-2 text-sm text-muted-foreground md:hidden">{t("compareSwipe")}</p>
        <div className="relative overflow-x-auto pt-2 pb-4 md:pb-6">
          <table className="w-full min-w-[38rem] table-fixed border-separate border-spacing-0 text-sm md:text-base">
            <caption className="sr-only">{t("compareCaption")}</caption>
            <colgroup>
              <col className="w-40 md:w-[28%]" />
              {PLANS.map((plan) => (
                <col key={plan.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <td className={STICKY} />
                {PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn("rounded-t-lg px-2 pt-4 pb-3 text-center text-base font-extrabold md:text-lg", plan.highlight && "bg-blush/60")}
                  >
                    {t(`plans.${plan.id}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON.map((group, g) => (
              <tbody key={group.key}>
                <tr>
                  <th scope="colgroup" colSpan={PLANS.length + 1} className="p-0 text-left">
                    <span className={cn(STICKY, "inline-block pt-6 pr-3 pb-2 text-xs font-bold tracking-wider text-plum uppercase")}>
                      {t(`compareGroups.${group.key}`)}
                    </span>
                  </th>
                </tr>
                {group.rows.map((row, r) => {
                  const lastRow = g === lastGroup && r === group.rows.length - 1
                  return (
                    <tr key={row.key}>
                      <th
                        scope="row"
                        className={cn(
                          STICKY,
                          "border-t border-border py-3 pr-3 text-left font-medium shadow-[6px_0_8px_-6px_var(--color-border)] md:shadow-none",
                        )}
                      >
                        {t(`compare.${row.key}`)}
                        {row.hint ? (
                          <span className="block text-sm font-normal text-muted-foreground">
                            {t(`featureHints.${row.key as "salesPromotions"}`)}
                          </span>
                        ) : null}
                      </th>
                      {PLANS.map((plan) => (
                        <td
                          key={plan.id}
                          className={cn(
                            "border-t border-border px-2 py-3 text-center",
                            plan.highlight && "bg-blush/60",
                            plan.highlight && lastRow && "rounded-b-lg",
                          )}
                        >
                          <span className="inline-flex items-center justify-center">
                            <Value cell={row.cells[plan.id]} />
                          </span>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      </details>
    </section>
  )
}
