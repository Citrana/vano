import type { Language } from "./convex/lib/catalog";
import type en from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
