import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// PUT /api/seasons/[id]/variation-rules
// Body: { variationId, multiplierDelta, fixedHourlySZD? }
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
  const { variationId, multiplierDelta, fixedHourlySZD } = body;
  if (!variationId || multiplierDelta == null) {
    return NextResponse.json({ error: "variationId and multiplierDelta are required" }, { status: 400 });
  }

  const rule = await prisma.seasonVariationRule.upsert({
    where: { seasonId_variationId: { seasonId, variationId } },
    create: { seasonId, variationId, multiplierDelta, fixedHourlySZD: fixedHourlySZD ?? null },
    update: { multiplierDelta, fixedHourlySZD: fixedHourlySZD ?? null },
  });
  return NextResponse.json(rule);
}

// DELETE /api/seasons/[id]/variation-rules?variationId=xxx
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
  if (!variationId) return NextResponse.json({ error: "variationId required" }, { status: 400 });

  await prisma.seasonVariationRule.deleteMany({ where: { seasonId, variationId } });
  return NextResponse.json({ ok: true });
}
