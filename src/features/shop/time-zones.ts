/**
 * The time zone choices for Shop settings: the browser's IANA list, plus
 * the current value if the list lacks it (e.g. "UTC"). Pure apart from
 * `Intl`, which every supported browser has.
 */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf("timeZone")
  } catch {
    zones = []
  }
  return current && !zones.includes(current) ? [current, ...zones] : zones
}
