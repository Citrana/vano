import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

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
