import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"

export default function LoginPage() {
  return (
    <SellerGate need="guest">
      <AuthForm flow="signIn" />
    </SellerGate>
  )
}
