import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "audit:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}
