import { ForgotPasswordForm } from "@/features/auth/forgot-password-form"
import { SellerGate } from "@/features/auth/gates"

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const { email } = await searchParams
  return (
    <SellerGate need="guest">
      <ForgotPasswordForm initialEmail={typeof email === "string" ? email.slice(0, 254) : undefined} />
    </SellerGate>
  )
}
