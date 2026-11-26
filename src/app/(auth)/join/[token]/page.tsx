import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { JoinInvite } from "@/features/team/join-invite"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Team.join")
  // The token is in the path: never send it to another site, never index it.
  return { title: t("metaTitle"), referrer: "no-referrer", robots: { index: false, follow: false } }
}

/** A team invite link (CLAUDE.md "Team accounts"). */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params
  return <JoinInvite token={token} />
}
