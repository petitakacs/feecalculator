import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdatePositionSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(position);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdatePositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.position.update({
    where: { id },
    data: parsed.data,
  });

  // When the multiplier or fixedHourlySZD changes, record a new history entry effective today
  const rateChanged =
    parsed.data.multiplier !== undefined &&
    (Number(parsed.data.multiplier) !== Number(existing.multiplier) ||
      (parsed.data.fixedHourlySZD ?? null) !== existing.fixedHourlySZD);
  if (rateChanged) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.positionRateHistory.updateMany({
      where: { positionId: id, effectiveTo: null, effectiveFrom: { lt: today } },
      data: { effectiveTo: new Date(today.getTime() - 86400000) },
    });
    await prisma.positionRateHistory.create({
      data: {
        positionId: id,
        multiplier: parsed.data.multiplier ?? existing.multiplier,
        fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
        effectiveFrom: today,
        note: "Szorzó módosítva az admin felületen",
      },
    });
  }

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "Position",
    entityId: id,
    before: { name: existing.name, multiplier: existing.multiplier },
    after: { name: updated.name, multiplier: updated.multiplier },
  });

  return NextResponse.json(updated);
}
