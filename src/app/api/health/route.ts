import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  // Public minimal health check — no sensitive data
  try {
    await prisma.$queryRaw`SELECT 1`;
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ ok: true, db: "connected" });
    }

    // Admin-only extended info
    if (hasPermission(session.user.role, "users:manage")) {
      const userCount = await prisma.user.count();
      return NextResponse.json({
        ok: true,
        db: "connected",
        userCount,
        env: {
          DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
          NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "set" : "MISSING",
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
        },
      });
    }

    return NextResponse.json({ ok: true, db: "connected" });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
