import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@feecalculator.local";

  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: "Az SMTP nincs konfigurálva. Add meg az SMTP_HOST, SMTP_USER, SMTP_PASS környezeti változókat." },
      { status: 422 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const to: string = body.to ?? session.user.email ?? "";
  if (!to) {
    return NextResponse.json({ error: "Nincs megadva célcím." }, { status: 400 });
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from,
      to,
      subject: "[FeeCalc] Teszt email",
      html: `<p>Ez egy teszt email a Fee Calculator rendszerből.</p><p>Az email értesítők megfelelően konfigurálva vannak.</p>`,
    });
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `SMTP hiba: ${message}` }, { status: 500 });
  }
}
