"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDownIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { CountryCode } from "libphonenumber-js"
import type { Id } from "../../../convex/_generated/dataModel"
import { LANGUAGES, LIMITS } from "../../../convex/lib/catalog"
import { errorCodeOf, type ErrorCode } from "../../../convex/lib/errors"
import { CURRENCIES } from "../../../convex/lib/money"
import { normalizeWhatsapp, splitWhatsapp } from "../../../convex/lib/phone"
import { slugify } from "../../../convex/lib/slug"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Textarea } from "@/components/ui/textarea"
import { ThemeDots } from "@/features/shop-themes/theme-dots"
import { shopUrl } from "@/lib/site"
import { CategoryPicker } from "./category-picker"
import { countryOptions, dialCode, flagEmoji } from "./countries"
import { LogoField } from "./logo-field"
import { shopSchema, type ShopFormValues } from "./schemas"
import { SlugStatus } from "./slug-status"

/** What the form sends: `whatsappNumber` is full E.164 (dial code included). */
export type ShopSubmit = Omit<ShopFormValues, "logoId" | "description" | "whatsappCountry"> & {
  description?: string
  logoId?: Id<"_storage">
}

/** Server error codes that belong to one field. */
const FIELD_OF: Partial<Record<ErrorCode, keyof ShopFormValues>> = {
  SLUG_INVALID: "slug",
  SLUG_RESERVED: "slug",
  SLUG_TAKEN: "slug",
  NAME_INVALID: "name",
  DESCRIPTION_TOO_LONG: "description",
  CITY_INVALID: "city",
  COUNTRY_INVALID: "country",
  PHONE_INVALID: "whatsappNumber",
  CATEGORIES_REQUIRED: "categories",
  CATEGORY_IN_USE: "categories",
}

/** Onboarding (`mode="create"`) and Shop settings (`mode="edit"`). */
export function ShopForm({
  mode,
  initial,
  initialLogoUrl,
  onSubmit,
}: {
  mode: "create" | "edit"
  /** The stored shop; `whatsappNumber` is E.164 and is split for the form. */
  initial?: Omit<ShopFormValues, "whatsappCountry">
  initialLogoUrl?: string | null
  onSubmit: (values: ShopSubmit) => Promise<void>
}) {
  const t = useTranslations("ShopForm")
  const tv = useTranslations("Validation")
  const te = useTranslations("Errors")
  const tCur = useTranslations("Currencies")
  const tLang = useTranslations("Languages")
  const tCommon = useTranslations("Common")
  const tOnb = useTranslations("Onboarding")
  const tTheme = useTranslations("ShopThemes")
  const locale = useLocale()

  const form = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema(tv)),
    defaultValues: initial ? withSplitWhatsapp(initial) : {
      name: "",
      slug: "",
      currency: "USD",
      language: locale,
      categories: [],
      description: "",
      whatsappNumber: "",
      whatsappCountry: "CD",
      city: "",
      country: "CD",
      logoId: undefined,
    },
  })
  const { register, control, formState, setValue, setError } = form
  const { errors, isSubmitting } = formState
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null)
  const [logoBusy, setLogoBusy] = useState(false)
  // The slug follows the name until the seller edits it (create only).
  const slugTouched = useRef(mode === "edit")
  // The dial code follows the shop's country until the seller picks one (create only).
  const dialTouched = useRef(mode === "edit")

  const [slug, description, whatsappCountry] = useWatch({
    control,
    name: ["slug", "description", "whatsappCountry"],
  })
  const countries = useMemo(() => countryOptions(locale), [locale])

  /** A pasted "+254 712…" switches the dial code and keeps the national part. */
  function splitInternational(value: string) {
    if (!value.trim().startsWith("+")) return
    if (normalizeWhatsapp(value) === null) return
    const { country: dial, national } = splitWhatsapp(value, whatsappCountry as CountryCode)
    dialTouched.current = true
    setValue("whatsappCountry", dial, { shouldValidate: true })
    setValue("whatsappNumber", national, { shouldValidate: true })
  }

  async function submit({ whatsappCountry: dial, ...values }: ShopFormValues) {
    try {
      await onSubmit({
        ...values,
        // Full E.164 so the server never guesses the country (schema checked it parses).
        whatsappNumber: normalizeWhatsapp(values.whatsappNumber, dial as CountryCode) ?? values.whatsappNumber,
        description: values.description || undefined,
        logoId: values.logoId as Id<"_storage"> | undefined,
      })
    } catch (error) {
      const code = errorCodeOf(error)
      const field = code ? FIELD_OF[code] : undefined
      if (code && field) setError(field, { message: te(code) }, { shouldFocus: true })
      else toast.error(code ? te(code) : te("UNKNOWN"))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <Card className="gap-5">
        <CardTitle>{t("sectionShop")}</CardTitle>
        <RequiredFieldsHint />
        <Field id="name" label={t("name")} required error={errors.name?.message}>
          {(p) => (
            <Input
              {...p}
              placeholder={t("namePlaceholder")}
              maxLength={LIMITS.shopNameMax}
              {...register("name", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!slugTouched.current) setValue("slug", slugify(e.target.value))
                },
              })}
            />
          )}
        </Field>

        <Field
          id="slug"
          label={t("slug")}
          required
          help={<span className="break-all">{t("slugHelp", { url: shopUrl(slug || "…") })}</span>}
          error={errors.slug?.message}
        >
          {(p) => (
            <div className="flex flex-col gap-1.5">
              <Input
                {...p}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={30}
                {...register("slug", {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    slugTouched.current = true
                    setValue("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  },
                })}
              />
              <SlugStatus slug={slug} />
            </div>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="currency" label={t("currency")} required help={t("currencyHelp")}>
            {(p) => (
              <NativeSelect {...p} {...register("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {tCur(c)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field id="language" label={t("language")} required help={t("languageHelp")}>
            {(p) => (
              <NativeSelect {...p} {...register("language")}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {tLang(l)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>

        <Field id="categories" label={t("categories")} required error={errors.categories?.message}>
          {(p) => (
            <Controller
              control={control}
              name="categories"
              render={({ field }) => (
                <CategoryPicker
                  value={field.value}
                  onChange={field.onChange}
                  invalid={p["aria-invalid"]}
                  describedBy={p["aria-describedby"]}
                />
              )}
            />
          )}
        </Field>

        <Field
          id="description"
          label={t("description")}
          error={errors.description?.message}
          help={t("charCount", { count: description?.length ?? 0, max: LIMITS.shopDescriptionMax })}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={LIMITS.shopDescriptionMax}
              placeholder={t("descriptionPlaceholder")}
              {...register("description")}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("logo")}</span>
          <Controller
            control={control}
            name="logoId"
            render={({ field }) => (
              <LogoField
                previewUrl={logoUrl}
                onBusyChange={setLogoBusy}
                onChange={(value) => {
                  field.onChange(value?.storageId)
                  setLogoUrl(value?.url ?? null)
                }}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">{t("logoHelp")}</p>
        </div>

        {mode === "edit" ? (
          <div id="look" className="flex scroll-mt-24 flex-col gap-2">
            <span className="text-sm font-medium">{tTheme("label")}</span>
            <Controller
              control={control}
              name="theme"
              render={({ field }) => (
                <div className="flex flex-wrap items-center gap-2">
                  <ThemeDots value={field.value ?? null} onChange={field.onChange} className="-ml-2.5" />
                  {field.value ? <span className="text-sm text-muted-foreground">{tTheme(field.value)}</span> : null}
                </div>
              )}
            />
            <p className="text-xs text-muted-foreground">{t("lookHelp")}</p>
          </div>
        ) : null}
      </Card>

      <Card className="gap-5">
        <CardTitle>{t("sectionContact")}</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="country" label={t("country")} required error={errors.country?.message}>
            {(p) => (
              <NativeSelect
                {...p}
                {...register("country", {
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                    if (!dialTouched.current) setValue("whatsappCountry", e.target.value)
                  },
                })}
              >
                <option value="" disabled>
                  {t("chooseCountry")}
                </option>
                <optgroup label="—">
                  {countries.priority.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="A–Z">
                  {countries.rest.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
            )}
          </Field>
          <Field id="city" label={t("city")} required error={errors.city?.message}>
            {(p) => (
              <Input {...p} autoComplete="address-level2" placeholder={t("cityPlaceholder")} {...register("city")} />
            )}
          </Field>
        </div>
        <Field
          id="whatsappNumber"
          label={t("whatsapp")}
          required
          help={t("whatsappHelp")}
          error={errors.whatsappNumber?.message}
        >
          {(p) => (
            <div className="flex items-stretch">
              {/* Dial code: shows the flag and code; the full list opens natively. */}
              <label className="relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 bg-muted px-3 text-sm tabular-nums focus-within:outline-2 focus-within:outline-solid focus-within:outline-ring md:min-h-9">
                <span aria-hidden>{flagEmoji(whatsappCountry)}</span>
                <span aria-hidden>{dialCode(whatsappCountry) ?? "+"}</span>
                <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
                <select
                  aria-label={t("whatsappCode")}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  {...register("whatsappCountry", { onChange: () => (dialTouched.current = true) })}
                >
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
              <Input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                className="rounded-l-none"
                placeholder={t("whatsappPlaceholder")}
                {...register("whatsappNumber", {
                  onBlur: (e: React.FocusEvent<HTMLInputElement>) => splitInternational(e.target.value),
                })}
              />
            </div>
          )}
        </Field>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting || logoBusy}>
          {isSubmitting
            ? mode === "create"
              ? tOnb("creating")
              : tCommon("saving")
            : mode === "create"
              ? tOnb("submit")
              : tCommon("save")}
        </Button>
      </div>
    </form>
  )
}

/** The stored E.164 number as a dial-code country + national number for the form. */
function withSplitWhatsapp(initial: Omit<ShopFormValues, "whatsappCountry">): ShopFormValues {
  const { country, national } = splitWhatsapp(initial.whatsappNumber, initial.country as CountryCode)
  return { ...initial, whatsappNumber: national, whatsappCountry: country }
}
