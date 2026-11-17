import type { Language } from "../../convex/lib/catalog";

export async function loadMessages(locale: Language) {
  return locale === "fr"
    ? (await import("../../messages/fr.json")).default
    : (await import("../../messages/en.json")).default;
}
