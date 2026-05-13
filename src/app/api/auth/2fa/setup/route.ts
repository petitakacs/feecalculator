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

  let encryptedSecret: string;
  try {
    const secret = generateTotpSecret();
    const otpAuthUrl = generateTotpUri(user.email, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    encryptedSecret = encrypt(secret);

    // Store the secret encrypted at rest; only expose QR code to the client
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptedSecret, twoFactorEnabled: false },
    });

    // Return only the QR code — the otpauth URI embedded in it is sufficient for
    // authenticator apps. Do NOT return the raw secret to avoid unnecessary exposure.
    return NextResponse.json({ qrCodeDataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "A 2FA titkosítás nincs konfigurálva a szerveren. Kérjük, add meg az ENCRYPTION_KEY környezeti változót." },
        { status: 500 }
      );
    }
    throw err;
  }
}
