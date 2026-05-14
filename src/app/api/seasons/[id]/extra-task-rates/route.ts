import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// PUT /api/seasons/[id]/extra-task-rates
// Body: { extraTaskTypeId, bonusAmount, rateMultiplier? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { extraTaskTypeId, bonusAmount, rateMultiplier } = body;
  if (!extraTaskTypeId || bonusAmount == null) {
    return NextResponse.json({ error: "extraTaskTypeId and bonusAmount are required" }, { status: 400 });
  }

  const rate = await prisma.seasonExtraTaskRate.upsert({
    where: { seasonId_extraTaskTypeId: { seasonId, extraTaskTypeId } },
    create: { seasonId, extraTaskTypeId, bonusAmount, rateMultiplier: rateMultiplier ?? null },
    update: { bonusAmount, rateMultiplier: rateMultiplier ?? null },
  });
  return NextResponse.json(rate);
}

// DELETE /api/seasons/[id]/extra-task-rates?extraTaskTypeId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const extraTaskTypeId = req.nextUrl.searchParams.get("extraTaskTypeId");
  if (!extraTaskTypeId) return NextResponse.json({ error: "extraTaskTypeId required" }, { status: 400 });

  await prisma.seasonExtraTaskRate.deleteMany({ where: { seasonId, extraTaskTypeId } });
  return NextResponse.json({ ok: true });
}
