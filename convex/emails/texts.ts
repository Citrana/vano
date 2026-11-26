import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import type { Language } from "../lib/catalog";

/**
 * Email texts come from the app's translation files (`Emails.*` in
 * messages/en.json and fr.json), like every other text, so the i18n test
 * keeps both languages complete. Emails are built on the server, so they
 * use the recipient's language, never the sender's.
 */
export type EmailTexts = typeof en.Emails;

export function emailTexts(language: Language): EmailTexts {
  return language === "fr" ? fr.Emails : en.Emails;
}

/** Fills `{name}` placeholders; unknown ones are left as they are. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
