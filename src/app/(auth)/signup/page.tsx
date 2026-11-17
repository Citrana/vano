import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"
import { SignupClosedGate } from "@/features/auth/signup-closed-gate"

export default function SignupPage() {
  return (
    <SellerGate need="guest">
      <SignupClosedGate>
        <AuthForm flow="signUp" />
      </SignupClosedGate>
    </SellerGate>
  )
}
