import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js"

/** Countries shown first: where Vano's sellers mostly are. */
export const PRIORITY_COUNTRIES: CountryCode[] = ["CD", "KE", "RW", "UG", "TZ", "BI", "CG", "FR", "BE"]

export type CountryOption = { code: CountryCode; name: string; dial: string }

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

/** Priority countries, then the rest sorted by localized name. */
export function countryOptions(locale: string): { priority: CountryOption[]; rest: CountryOption[] } {
  const names = new Intl.DisplayNames([locale], { type: "region" })
  const toOption = (code: CountryCode): CountryOption => ({
    code,
    name: names.of(code) ?? code,
    dial: `+${getCountryCallingCode(code)}`,
  })
  const priority = PRIORITY_COUNTRIES.map(toOption)
  const prioritySet = new Set<string>(PRIORITY_COUNTRIES)
  const rest = getCountries()
    .filter((code) => !prioritySet.has(code))
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  return { priority, rest }
}

export function dialCode(country: string): string | null {
  try {
    return `+${getCountryCallingCode(country as CountryCode)}`
  } catch {
    return null
  }
}
