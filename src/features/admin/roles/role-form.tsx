"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"
import { PermissionGrid } from "./permission-grid"
import { roleSchema, type RoleFormValues } from "./schemas"
import { useCanGrant } from "./use-can-grant"

/** Create / edit a custom role: name, description and the permission grid. */
export function RoleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: RoleFormValues
  submitLabel: string
  onSubmit: (values: RoleFormValues) => Promise<void>
}) {
  const t = useTranslations("AdminRoles")
  const tv = useTranslations("Validation")
  const tc = useTranslations("Common")
  const errorMessage = useErrorMessage()
  const canGrant = useCanGrant()
  const form = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema(tv)), defaultValues: initial })
  const { errors, isSubmitting } = form.formState

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSubmit(values)
        } catch (error) {
          toast.error(errorMessage(error))
        }
      })}
    >
      <RequiredFieldsHint />
      <Field id="role-name" label={t("name")} required error={errors.name?.message}>
        {(props) => <Input {...props} {...form.register("name")} maxLength={60} />}
      </Field>
      <Field id="role-description" label={t("description")} help={tc("optional")} error={errors.description?.message}>
        {(props) => <Textarea {...props} {...form.register("description")} rows={2} />}
      </Field>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{t("permissions")}</h2>
        <Controller
          control={form.control}
          name="permissions"
          render={({ field }) => <PermissionGrid value={field.value} onChange={field.onChange} canGrant={canGrant} />}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? tc("saving") : submitLabel}
      </Button>
    </form>
  )
}
