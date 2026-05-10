import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/totp";
import { decrypt } from "@/lib/crypto";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { totpCode } = await request.json();
  if (!totpCode) {
    return NextResponse.json({ error: "TOTP code required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (!user || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA setup not initiated" }, { status: 400 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
  }

  const secret = decrypt(user.twoFactorSecret);
  const isValid = verifyTotp(totpCode.replace(/\s/g, ""), secret);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid TOTP code" }, { status: 400 });
  }

  // Generate backup codes and hash each one individually with bcrypt
  const plainBackupCodes = Array.from({ length: 8 }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );
  const hashedBackupCodes = await Promise.all(
    plainBackupCodes.map((code) => hash(code, 10))
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
    },
  });

  // Return plaintext codes only once — user must save these
  return NextResponse.json({ backupCodes: plainBackupCodes });
}
