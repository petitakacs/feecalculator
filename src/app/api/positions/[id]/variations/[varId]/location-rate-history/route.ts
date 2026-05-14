import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateSchema = z.object({
  locationId: z.string().min(1),
  fixedHourlySZD: z.number().int().min(0),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const locationId = url.searchParams.get("locationId");

  const history = await prisma.variationLocationRateHistory.findMany({
    where: { variationId: varId, ...(locationId ? { locationId } : {}) },
    include: { location: { select: { id: true, name: true } } },
    orderBy: [{ locationId: "asc" }, { effectiveFrom: "desc" }],
  });

  return NextResponse.json(history);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  await prisma.variationLocationRateHistory.updateMany({
    where: { variationId: varId, locationId: parsed.data.locationId, effectiveTo: null, effectiveFrom: { lt: effectiveFrom } },
    data: { effectiveTo: new Date(effectiveFrom.getTime() - 86400000) },
  });

  const record = await prisma.variationLocationRateHistory.create({
    data: {
      variationId: varId,
      locationId: parsed.data.locationId,
      fixedHourlySZD: parsed.data.fixedHourlySZD,
      effectiveFrom,
      note: parsed.data.note,
    },
    include: { location: { select: { id: true, name: true } } },
  });

  // Keep the static VariationLocationRate in sync
  await prisma.variationLocationRate.upsert({
    where: { variationId_locationId: { variationId: varId, locationId: parsed.data.locationId } },
    create: { variationId: varId, locationId: parsed.data.locationId, fixedHourlySZD: parsed.data.fixedHourlySZD },
    update: { fixedHourlySZD: parsed.data.fixedHourlySZD },
  });

  return NextResponse.json(record, { status: 201 });
}
