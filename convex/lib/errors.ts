import { ConvexError } from "convex/values";

/**
 * Error codes thrown to the UI (CLAUDE.md "Security & ownership"). The UI
 * shows `Errors.<code>` from `messages/*.json` — add both translations
 * with every new code.
 */
export const ERROR_CODES = [
  "NOT_AUTHENTICATED",
  "EMAIL_INVALID",
  "PASSWORD_TOO_SHORT",
  "NOT_FOUND",
  "NO_SHOP",
  "SHOP_EXISTS",
  "SLUG_INVALID",
  "SLUG_RESERVED",
  "SLUG_TAKEN",
  "NAME_INVALID",
  "DESCRIPTION_TOO_LONG",
  "CITY_INVALID",
  "COUNTRY_INVALID",
  "PHONE_INVALID",
  "CATEGORIES_REQUIRED",
  "CATEGORY_NOT_IN_SHOP",
  "CATEGORY_IN_USE",
  "PRICE_INVALID",
  "TAGS_INVALID",
  "IMAGES_COUNT",
  "IMAGE_INVALID",
  "TOO_MANY_PRODUCTS",
  "FORBIDDEN",
  "ACCOUNT_SUSPENDED",
  "SHOP_SUSPENDED",
  "SIGNUP_DISABLED",
  "LAST_SUPER_ADMIN",
  "CANNOT_MODIFY_SELF",
  "ROLE_BUILT_IN",
  "ROLE_IN_USE",
  "ROLE_NAME_INVALID",
  "ROLE_NAME_TAKEN",
  "PERMISSION_ESCALATION",
  "SUPER_ADMIN_EXISTS",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function fail(code: ErrorCode): never {
  throw new ConvexError({ code });
}

/** Reads the code back from an error caught on the client. */
export function errorCodeOf(error: unknown): ErrorCode | null {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      typeof data.code === "string" &&
      (ERROR_CODES as readonly string[]).includes(data.code)
    ) {
      return data.code as ErrorCode;
    }
  }
  return null;
}
