import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Language } from "../lib/catalog";
import { INVITE_TTL_DAYS, invitePath, memberLabel, type TeamRole } from "../lib/team";
import { sendEmail } from "./send";
import { teamInviteEmail } from "./templates/teamInvite";

/**
 * Emails a team invite link (CLAUDE.md "Team accounts", "Emails"), in the
 * language the owner picked. Only schedules the email (`sendEmail`); returns
 * false when the app URL isn't configured, so the owner shares the link
 * another way. `to` is already a normalized address.
 */
export async function sendTeamInviteEmail(
  ctx: MutationCtx,
  input: { to: string; language: Language; inviter: Doc<"users">; shop: Doc<"shops">; role: TeamRole; token: string },
): Promise<boolean> {
  const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "");
  if (!siteUrl) {
    console.warn("[email] SITE_URL is not set: team invite email skipped");
    return false;
  }
  await sendEmail(ctx, {
    to: input.to,
    ...teamInviteEmail(input.language, {
      inviter: memberLabel(input.inviter),
      shopName: input.shop.name,
      role: input.role,
      joinUrl: `${siteUrl}${invitePath(input.token)}`,
      days: INVITE_TTL_DAYS,
    }),
  });
  return true;
}
