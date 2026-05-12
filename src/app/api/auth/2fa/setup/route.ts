import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateTotpUri } from "@/lib/totp";
import { encrypt } from "@/lib/crypto";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
  }

  const secret = generateTotpSecret();
  const otpAuthUrl = generateTotpUri(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  // Store the secret encrypted at rest; only expose QR code to the client
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encrypt(secret), twoFactorEnabled: false },
  });

  // Return only the QR code — the otpauth URI embedded in it is sufficient for
  // authenticator apps. Do NOT return the raw secret to avoid unnecessary exposure.
  return NextResponse.json({ qrCodeDataUrl });
}
