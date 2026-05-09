import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateTotpUri } from "@/lib/totp";
import QRCode from "qrcode";

export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 400 }
    );
  }

  const secret = generateTotpSecret();
  const otpAuthUrl = generateTotpUri(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  // Store the secret temporarily (not enabled until verified)
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  return NextResponse.json({ secret, qrCodeDataUrl });
}
