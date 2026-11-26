import { AuthForm } from "@/features/auth/auth-form"
import { SellerGate } from "@/features/auth/gates"
import { nextParam } from "@/features/auth/next-param"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = nextParam((await searchParams).next)
  return (
    <SellerGate need="guest" next={next}>
      <AuthForm flow="signIn" next={next} />
    </SellerGate>
  )
}
