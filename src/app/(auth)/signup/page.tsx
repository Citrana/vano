import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"
import { SignupClosedGate } from "@/features/auth/signup-closed-gate"
import { startPlanParam } from "@/features/billing/start-plan"

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const startPlan = startPlanParam((await searchParams).plan)
  return (
    <SellerGate need="guest">
      <SignupClosedGate>
        <AuthForm flow="signUp" startPlan={startPlan} />
      </SignupClosedGate>
    </SellerGate>
  )
}
