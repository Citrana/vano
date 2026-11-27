import type { Language } from "../lib/catalog";
import { emailTexts } from "./texts";

/**
 * The one branded email layout (CLAUDE.md "Emails"). Built for Gmail on a
 * phone first: table layout, inline styles only (no <style>, no CSS
 * variables, no web fonts), one 560px column that shrinks to the screen,
 * and a plain-text version of everything. Every value is HTML-escaped.
 *
 * Emails can't read globals.css, so the brand colours are copied here; a
 * test checks they still match the tokens.
 */
export const EMAIL_COLORS = {
  plum: "#5b1f4a",
  cream: "#fff8f3",
  ink: "#1a1412",
  card: "#ffffff",
  muted: "#574b45",
  border: "#ede0d8",
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailBody = {
  language: Language;
  /** Grey preview line shown after the subject in the inbox. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Short titled bullet lists under the paragraphs ("what you keep", "what pauses"). Empty lists are skipped. */
  lists?: { title: string; items: string[] }[];
  /** Label / value rows in a bordered box (receipts: plan, amount, date, reference). */
  details?: { label: string; value: string }[];
  /** A one-time code shown large under the paragraphs (sign-up and reset codes). */
  code?: string;
  /** A short numbered list under the paragraphs ("first steps"). */
  steps?: { title: string; body: string }[];
  button?: { label: string; url: string };
  /** A second, outlined button beside the main one (e.g. "Reset password" next to "Log in"). */
  secondaryButton?: { label: string; url: string };
  /** Smaller grey lines under the button (dates, "ignore this if…"). */
  notes?: string[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) links reach a button. */
function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

export function renderEmail(body: EmailBody): { html: string; text: string } {
  const t = emailTexts(body.language).layout;
  const c = EMAIL_COLORS;
  const url = body.button ? safeUrl(body.button.url) : null;
  const secondaryUrl = body.secondaryButton ? safeUrl(body.secondaryButton.url) : null;

  const paragraphs = body.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${c.ink};">${escapeHtml(p)}</p>`)
    .join("");
  const lists = (body.lists ?? [])
    .filter((list) => list.items.length > 0)
    .map(
      (list) =>
        `<p style="margin:0 0 8px;font-size:16px;line-height:24px;font-weight:700;color:${c.ink};">${escapeHtml(list.title)}</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
        list.items
          .map(
            (item) =>
              `<tr><td valign="top" width="20" style="padding:0 0 6px;font-size:15px;line-height:22px;color:${c.plum};">&#8226;</td>` +
              `<td valign="top" style="padding:0 0 6px;font-size:15px;line-height:22px;color:${c.ink};">${escapeHtml(item)}</td></tr>`,
          )
          .join("") +
        `</table>`,
    )
    .join("");
  const details = body.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:1px solid ${c.border};border-radius:12px;border-collapse:separate;">` +
      body.details
        .map(
          (row, i) =>
            `<tr><td valign="top" style="padding:10px 12px;${i > 0 ? `border-top:1px solid ${c.border};` : ""}font-size:14px;line-height:20px;color:${c.muted};">${escapeHtml(row.label)}</td>` +
            `<td valign="top" align="right" style="padding:10px 12px;${i > 0 ? `border-top:1px solid ${c.border};` : ""}font-size:14px;line-height:20px;font-weight:700;color:${c.ink};text-align:right;">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("") +
      `</table>`
    : "";
  const code = body.code
    ? `<p style="margin:0 0 20px;padding:16px;border:1px solid ${c.border};border-radius:12px;background:${c.cream};text-align:center;font-family:'SFMono-Regular', Menlo, Consolas, monospace;font-size:32px;line-height:40px;font-weight:800;letter-spacing:8px;color:${c.ink};">${escapeHtml(body.code)}</p>`
    : "";
  const steps = body.steps?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
      body.steps
        .map(
          (step, i) =>
            `<tr><td valign="top" width="40" style="padding:0 12px 16px 0;">` +
            `<div style="width:28px;height:28px;border-radius:14px;background:${c.plum};color:#ffffff;font-size:14px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>` +
            `</td><td valign="top" style="padding:0 0 16px;">` +
            `<p style="margin:0 0 4px;font-size:16px;line-height:24px;font-weight:700;color:${c.ink};">${escapeHtml(step.title)}</p>` +
            `<p style="margin:0;font-size:15px;line-height:22px;color:${c.muted};">${escapeHtml(step.body)}</p>` +
            `</td></tr>`,
        )
        .join("") +
      `</table>`
    : "";
  const primaryCell =
    body.button && url
      ? `<td style="border-radius:10px;background:${c.plum};">` +
        `<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(body.button.label)}</a>` +
        `</td>`
      : "";
  const secondaryCell =
    body.secondaryButton && secondaryUrl
      ? `<td style="border-radius:10px;border:1px solid ${c.plum};background:${c.card};">` +
        `<a href="${escapeHtml(secondaryUrl)}" style="display:inline-block;padding:13px 23px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:${c.plum};text-decoration:none;border-radius:10px;">${escapeHtml(body.secondaryButton.label)}</a>` +
        `</td>`
      : "";
  const button =
    primaryCell || secondaryCell
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>` +
        [primaryCell, secondaryCell].filter(Boolean).join(`<td style="width:12px;"></td>`) +
        `</tr></table>`
      : "";
  const notes = (body.notes ?? [])
    .map((n) => `<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${c.muted};">${escapeHtml(n)}</p>`)
    .join("");

  const html = `<!doctype html>
<html lang="${body.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(body.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${c.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(body.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.cream};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT};">
<tr><td style="background:${c.plum};border-radius:16px 16px 0 0;padding:20px 24px;">
<span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Vano</span>
</td></tr>
<tr><td style="background:${c.card};border:1px solid ${c.border};border-top:0;border-radius:0 0 16px 16px;padding:28px 24px 20px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:800;color:${c.ink};">${escapeHtml(body.heading)}</h1>
${paragraphs}${details}${lists}${code}${steps}${button}${notes}
</td></tr>
<tr><td style="padding:20px 24px;text-align:center;font-size:12px;line-height:18px;color:${c.muted};">
<p style="margin:0 0 4px;font-weight:700;color:${c.plum};">Vano · ${escapeHtml(t.tagline)}</p>
<p style="margin:0;">${escapeHtml(t.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    body.heading,
    "",
    ...body.paragraphs.flatMap((p) => [p, ""]),
    ...(body.details?.length ? [...body.details.map((row) => `${row.label}: ${row.value}`), ""] : []),
    ...(body.lists ?? [])
      .filter((list) => list.items.length > 0)
      .flatMap((list) => [list.title, ...list.items.map((item) => `- ${item}`), ""]),
    ...(body.code ? [body.code, ""] : []),
    ...(body.steps ?? []).flatMap((step, i) => [`${i + 1}. ${step.title}`, `   ${step.body}`, ""]),
    ...(body.button && url ? [`${body.button.label}: ${url}`, ""] : []),
    ...(body.secondaryButton && secondaryUrl ? [`${body.secondaryButton.label}: ${secondaryUrl}`, ""] : []),
    ...(body.notes ?? []),
    ...(body.notes?.length ? [""] : []),
    "--",
    `Vano · ${t.tagline}`,
    t.footer,
  ].join("\n");

  return { html, text };
}
