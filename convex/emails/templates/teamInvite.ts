import type { Language } from "../../lib/catalog";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";
import type { TeamRole } from "../../lib/team";

export type TeamInviteValues = {
  /** Who invited (their name, else their email). */
  inviter: string;
  shopName: string;
  role: TeamRole;
  joinUrl: string;
  days: number;
};

/** A team invite link (`sendTeamInviteEmail`, convex/emails/teamInvite.ts). */
export function teamInviteEmail(
  language: Language,
  { inviter, shopName, role, joinUrl, days }: TeamInviteValues,
): EmailContent {
  const t = emailTexts(language).teamInvite;
  const values = { inviter, shop: shopName, role: t.roles[role], days };
  const { html, text } = renderEmail({
    language,
    preheader: fill(t.preheader, values),
    heading: fill(t.heading, values),
    paragraphs: [fill(t.intro, values), t.roleIntro, t.roleBodies[role]],
    button: { label: t.button, url: joinUrl },
    notes: [fill(t.expires, values), t.ignore],
  });
  return { subject: fill(t.subject, values), html, text };
}
