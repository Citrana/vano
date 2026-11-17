import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"

export default function SignupPage() {
  return (
    <SellerGate need="guest">
      <AuthForm flow="signUp" />
    </SellerGate>
  )
}
