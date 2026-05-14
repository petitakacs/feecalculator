import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdateExtraTaskTypeSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.extraTaskType.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateExtraTaskTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const type = await prisma.extraTaskType.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { assignments: true } } },
  });

  // If the rate-relevant fields changed, record a new history entry
  const rateChanged =
    (parsed.data.bonusAmount !== undefined && parsed.data.bonusAmount !== existing.bonusAmount) ||
    (parsed.data.rateMultiplier !== undefined &&
      Number(parsed.data.rateMultiplier ?? null) !== Number(existing.rateMultiplier ?? null)) ||
    (parsed.data.bonusType !== undefined && parsed.data.bonusType !== existing.bonusType);
  if (rateChanged) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.extraTaskRateHistory.updateMany({
      where: { extraTaskTypeId: id, effectiveTo: null, effectiveFrom: { lt: today } },
      data: { effectiveTo: new Date(today.getTime() - 86400000) },
    });
    await prisma.extraTaskRateHistory.create({
      data: {
        extraTaskTypeId: id,
        bonusType: type.bonusType,
        bonusAmount: type.bonusAmount,
        rateMultiplier: type.rateMultiplier ?? null,
        effectiveFrom: today,
        note: "Díjszabás módosítva az admin felületen",
      },
    });
  }

  return NextResponse.json(type);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignmentCount = await prisma.monthlyExtraTask.count({
    where: { extraTaskTypeId: id },
  });
  if (assignmentCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: used in ${assignmentCount} period assignment(s)` },
      { status: 409 }
    );
  }

  await prisma.extraTaskType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
