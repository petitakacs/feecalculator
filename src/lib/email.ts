import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM ?? "noreply@feecalculator.local";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function sanitizeSubject(s: string): string {
  return s.replace(/[\r\n\t]/g, " ").trim();
}

async function send(to: string | string[], subject: string, html: string) {
  const transport = createTransport();
  if (!transport) return; // email not configured, silently skip

  await transport.sendMail({
    from: FROM,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  });
}

export interface NotificationContext {
  periodId: string;
  periodLabel: string; // e.g. "2026 / 05"
  actorName: string;
  comment?: string;
}

function periodLink(periodId: string) {
  return `${BASE_URL}/periods/${periodId}`;
}

function baseLayout(content: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${content}
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #9ca3af; font-size: 12px;">
        Fee Calculator — automatikus értesítő
      </p>
    </div>
  `;
}

function renderComment(comment?: string): string {
  if (!comment) return "";
  return `<p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:8px 12px;margin:12px 0;"><em>${escapeHtml(comment)}</em></p>`;
}

export async function sendPeriodSubmitted(recipients: string[], ctx: NotificationContext) {
  const subject = sanitizeSubject(`[FeeCalc] Periódus jóváhagyásra beküldve: ${ctx.periodLabel}`);
  const html = baseLayout(`
    <h2 style="color: #1f2937;">Periódus beküldve jóváhagyásra</h2>
    <p><strong>${escapeHtml(ctx.actorName)}</strong> beküldte a <strong>${escapeHtml(ctx.periodLabel)}</strong> periódust jóváhagyásra.</p>
    ${renderComment(ctx.comment)}
    <p><a href="${periodLink(ctx.periodId)}" style="color: #4f46e5;">Periódus megtekintése →</a></p>
  `);
  await send(recipients, subject, html);
}

export async function sendPeriodApproved(recipients: string[], ctx: NotificationContext) {
  const subject = sanitizeSubject(`[FeeCalc] Periódus jóváhagyva: ${ctx.periodLabel}`);
  const html = baseLayout(`
    <h2 style="color: #065f46;">Periódus jóváhagyva</h2>
    <p><strong>${escapeHtml(ctx.actorName)}</strong> jóváhagyta a <strong>${escapeHtml(ctx.periodLabel)}</strong> periódust.</p>
    ${renderComment(ctx.comment)}
    <p><a href="${periodLink(ctx.periodId)}" style="color: #4f46e5;">Periódus megtekintése →</a></p>
  `);
  await send(recipients, subject, html);
}

export async function sendPeriodRejected(recipients: string[], ctx: NotificationContext) {
  const subject = sanitizeSubject(`[FeeCalc] Periódus visszadobva: ${ctx.periodLabel}`);
  const html = baseLayout(`
    <h2 style="color: #991b1b;">Periódus visszadobva</h2>
    <p><strong>${escapeHtml(ctx.actorName)}</strong> visszadobta a <strong>${escapeHtml(ctx.periodLabel)}</strong> periódust.</p>
    ${renderComment(ctx.comment)}
    <p><a href="${periodLink(ctx.periodId)}" style="color: #4f46e5;">Periódus megtekintése →</a></p>
  `);
  await send(recipients, subject, html);
}

export async function sendPeriodClosed(recipients: string[], ctx: NotificationContext) {
  const subject = sanitizeSubject(`[FeeCalc] Periódus lezárva: ${ctx.periodLabel}`);
  const html = baseLayout(`
    <h2 style="color: #1e40af;">Periódus lezárva</h2>
    <p><strong>${escapeHtml(ctx.actorName)}</strong> lezárta a <strong>${escapeHtml(ctx.periodLabel)}</strong> periódust.</p>
    ${renderComment(ctx.comment)}
    <p><a href="${periodLink(ctx.periodId)}" style="color: #4f46e5;">Periódus megtekintése →</a></p>
  `);
  await send(recipients, subject, html);
}

export async function sendPeriodReopened(recipients: string[], ctx: NotificationContext) {
  const subject = sanitizeSubject(`[FeeCalc] Periódus újranyitva: ${ctx.periodLabel}`);
  const html = baseLayout(`
    <h2 style="color: #92400e;">Periódus újranyitva</h2>
    <p><strong>${escapeHtml(ctx.actorName)}</strong> újranyitotta a <strong>${escapeHtml(ctx.periodLabel)}</strong> periódust.</p>
    ${renderComment(ctx.comment)}
    <p><a href="${periodLink(ctx.periodId)}" style="color: #4f46e5;">Periódus megtekintése →</a></p>
  `);
  await send(recipients, subject, html);
}
