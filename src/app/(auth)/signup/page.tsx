import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"
import { inviteFromNext, nextParam } from "@/features/auth/next-param"
import { SignupClosedGate } from "@/features/auth/signup-closed-gate"
import { startPlanParam } from "@/features/billing/start-plan"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[]; next?: string | string[] }>
}) {
  const params = await searchParams
  const startPlan = startPlanParam(params.plan)
  const next = nextParam(params.next)
  // A team invite works even while public sign-up is closed (CLAUDE.md "Team accounts").
  const invite = inviteFromNext(next)
  const form = <AuthForm flow="signUp" startPlan={startPlan} next={next} invite={invite} />
  return <SellerGate need="guest" next={next}>{invite ? form : <SignupClosedGate>{form}</SignupClosedGate>}</SellerGate>
}
