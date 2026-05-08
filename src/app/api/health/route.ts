import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { email: true, active: true, role: true },
    });
    return NextResponse.json({
      db: "connected",
      userCount,
      users,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "set" : "MISSING",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { db: "error", error: String(err) },
      { status: 500 }
    );
  }
}
