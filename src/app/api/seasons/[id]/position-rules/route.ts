import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// PUT /api/seasons/[id]/position-rules
// Upserts a season position rule (multiplier override). Body: { positionId, multiplier, fixedHourlySZD? }
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
  const { positionId, multiplier, fixedHourlySZD } = body;
  if (!positionId || multiplier == null) {
    return NextResponse.json({ error: "positionId and multiplier are required" }, { status: 400 });
  }

  const rule = await prisma.seasonPositionRule.upsert({
    where: { seasonId_positionId: { seasonId, positionId } },
    create: { seasonId, positionId, multiplier, fixedHourlySZD: fixedHourlySZD ?? null },
    update: { multiplier, fixedHourlySZD: fixedHourlySZD ?? null },
  });
  return NextResponse.json(rule);
}

// DELETE /api/seasons/[id]/position-rules?positionId=xxx
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

  const positionId = req.nextUrl.searchParams.get("positionId");
  if (!positionId) return NextResponse.json({ error: "positionId required" }, { status: 400 });

  await prisma.seasonPositionRule.deleteMany({ where: { seasonId, positionId } });
  return NextResponse.json({ ok: true });
}
