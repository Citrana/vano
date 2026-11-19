import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * WhatsApp number rules (CLAUDE.md "Shared validation"). Numbers are
 * stored in E.164 ("+243812345678"). Input may be "+243 812 345 678" or a
 * national number with `defaultCountry` ("0812345678" + "CD").
 */
export function normalizeWhatsapp(
  input: string,
  defaultCountry?: CountryCode,
): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** Digits only, for `https://wa.me/<digits>`. */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * A stored number split for the form: its country (for the dial-code
 * picker) and the national part, e.g. "+254712345678" → { country: "KE",
 * national: "712 345 678" }. Shared / non-geographic codes (+1, +800…)
 * keep `fallbackCountry` when it matches the code. Unparseable input is
 * returned as-is with the fallback.
 */
export function splitWhatsapp(
  value: string,
  fallbackCountry: CountryCode,
): { country: CountryCode; national: string } {
  const parsed = parsePhoneNumberFromString(value.trim(), fallbackCountry);
  if (!parsed) return { country: fallbackCountry, national: value.trim() };
  const fallbackMatches = getCountryCallingCode(fallbackCountry) === parsed.countryCallingCode;
  const country = parsed.country ?? (fallbackMatches ? fallbackCountry : undefined);
  // No single country for this code: keep the full international number.
  if (!country) return { country: fallbackCountry, national: parsed.formatInternational() };
  return { country, national: parsed.formatNational() };
}

/** A stored number for display: "+243812345678" → "+243 812 345 678". */
export function formatWhatsapp(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
