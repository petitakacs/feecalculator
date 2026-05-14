import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CreatePositionSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await prisma.position.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { variations: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json(positions);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreatePositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const position = await prisma.position.create({ data: parsed.data });

  // Seed the initial rate history record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.positionRateHistory.create({
    data: {
      positionId: position.id,
      multiplier: position.multiplier,
      fixedHourlySZD: position.fixedHourlySZD ?? null,
      effectiveFrom: today,
      note: "Kezdő beállítás",
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entityType: "Position",
    entityId: position.id,
    after: { name: position.name },
  });

  return NextResponse.json(position, { status: 201 });
}
