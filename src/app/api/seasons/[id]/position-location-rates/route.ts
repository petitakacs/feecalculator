import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// PUT /api/seasons/[id]/position-location-rates
// Body: { positionId, locationId, fixedHourlySZD }
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
  const { positionId, locationId, fixedHourlySZD } = body;
  if (!positionId || !locationId || fixedHourlySZD == null) {
    return NextResponse.json({ error: "positionId, locationId and fixedHourlySZD are required" }, { status: 400 });
  }

  const rate = await prisma.seasonPositionLocationRate.upsert({
    where: { seasonId_positionId_locationId: { seasonId, positionId, locationId } },
    create: { seasonId, positionId, locationId, fixedHourlySZD },
    update: { fixedHourlySZD },
  });
  return NextResponse.json(rate);
}

// DELETE /api/seasons/[id]/position-location-rates?positionId=&locationId=
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
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!positionId || !locationId) return NextResponse.json({ error: "positionId and locationId required" }, { status: 400 });

  await prisma.seasonPositionLocationRate.deleteMany({ where: { seasonId, positionId, locationId } });
  return NextResponse.json({ ok: true });
}
