import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// PUT /api/seasons/[id]/variation-location-rates
// Body: { variationId, locationId, fixedHourlySZD }
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
  const { variationId, locationId, fixedHourlySZD } = body;
  if (!variationId || !locationId || fixedHourlySZD == null) {
    return NextResponse.json({ error: "variationId, locationId and fixedHourlySZD are required" }, { status: 400 });
  }

  const rate = await prisma.seasonVariationLocationRate.upsert({
    where: { seasonId_variationId_locationId: { seasonId, variationId, locationId } },
    create: { seasonId, variationId, locationId, fixedHourlySZD },
    update: { fixedHourlySZD },
  });
  return NextResponse.json(rate);
}

// DELETE /api/seasons/[id]/variation-location-rates?variationId=&locationId=
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

  const variationId = req.nextUrl.searchParams.get("variationId");
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!variationId || !locationId) return NextResponse.json({ error: "variationId and locationId required" }, { status: 400 });

  await prisma.seasonVariationLocationRate.deleteMany({ where: { seasonId, variationId, locationId } });
  return NextResponse.json({ ok: true });
}
