"use client"

import { ChevronDownIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { useMemo } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"
import { countryOptions, dialCode, flagEmoji } from "./countries"

/**
 * WhatsApp dial-code picker: shows the flag and code; the full list opens
 * natively. Sits on the left of a phone input (`rounded-l-none`).
 */
export function DialCodeSelect({
  country,
  label,
  registration,
}: {
  country: string
  label: string
  registration: UseFormRegisterReturn
}) {
  const locale = useLocale()
  const countries = useMemo(() => countryOptions(locale), [locale])
  return (
    <label className="relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 bg-muted px-3 text-sm tabular-nums focus-within:outline-2 focus-within:outline-solid focus-within:outline-ring md:min-h-9">
      <span aria-hidden>{flagEmoji(country)}</span>
      <span aria-hidden>{dialCode(country) ?? "+"}</span>
      <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
      <select aria-label={label} className="absolute inset-0 cursor-pointer opacity-0" {...registration}>
        <optgroup label="—">
          {countries.priority.map((c) => (
            <option key={c.code} value={c.code}>
              {`${flagEmoji(c.code)} ${c.dial} ${c.name}`}
            </option>
          ))}
        </optgroup>
        <optgroup label="A–Z">
          {countries.rest.map((c) => (
            <option key={c.code} value={c.code}>
              {`${flagEmoji(c.code)} ${c.dial} ${c.name}`}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}
