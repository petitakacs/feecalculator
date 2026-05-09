import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const isPasswordValid = await compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  if (!user.twoFactorEnabled) {
    return NextResponse.json({ requiresTwoFactor: false });
  }

  // Create a short-lived temp token for the 2FA step
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clean up expired tokens for this user
  await prisma.twoFactorToken.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  });

  await prisma.twoFactorToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  return NextResponse.json({ requiresTwoFactor: true, tempToken: token });
}
