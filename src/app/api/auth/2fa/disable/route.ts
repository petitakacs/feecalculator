import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json();
  if (!password) {
    return NextResponse.json(
      { error: "Password confirmation required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "2FA is not enabled" },
      { status: 400 }
    );
  }

  const isPasswordValid = await compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    },
  });

  // Invalidate all pending 2FA tokens
  await prisma.twoFactorToken.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ success: true });
}
