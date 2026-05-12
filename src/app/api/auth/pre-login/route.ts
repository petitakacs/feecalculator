import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 minutes
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  if (!rateLimit(`pre-login:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Túl sok bejelentkezési kísérlet. Próbáld újra 15 perc múlva." },
      { status: 429 }
    );
  }

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

  // Clean up ALL previous tokens for this user (not just expired ones)
  await prisma.twoFactorToken.deleteMany({ where: { userId: user.id } });

  await prisma.twoFactorToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  return NextResponse.json({ requiresTwoFactor: true, tempToken: token });
}
