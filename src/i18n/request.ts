import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./locale";
import { loadMessages } from "./messages";

/**
 * No locale in URLs (CLAUDE.md "Internationalization"): the seller's
 * choice from the NEXT_LOCALE cookie, else the browser's Accept-Language.
 * Public shop pages override this with the shop's own language.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  const locale =
    explicit === "en" || explicit === "fr"
      ? explicit
      : resolveLocale(
          (await cookies()).get(LOCALE_COOKIE)?.value,
          (await headers()).get("accept-language"),
        );
  return { locale, messages: await loadMessages(locale) };
});
