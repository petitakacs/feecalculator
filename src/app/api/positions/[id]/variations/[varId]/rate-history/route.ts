import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateVariationRateHistorySchema = z.object({
  multiplierDelta: z.number(),
  fixedHourlySZD: z.number().int().min(0).nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId: variationId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await prisma.variationRateHistory.findMany({
    where: { variationId },
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json(history);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId: variationId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const variation = await prisma.positionVariation.findUnique({ where: { id: variationId } });
  if (!variation) return NextResponse.json({ error: "Variáció nem található" }, { status: 404 });

  const body = await req.json();
  const parsed = CreateVariationRateHistorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  await prisma.variationRateHistory.updateMany({
    where: {
      variationId,
      effectiveTo: null,
      effectiveFrom: { lt: effectiveFrom },
    },
    data: { effectiveTo: new Date(effectiveFrom.getTime() - 86400000) },
  });

  const record = await prisma.variationRateHistory.create({
    data: {
      variationId,
      multiplierDelta: parsed.data.multiplierDelta,
      fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
      effectiveFrom,
      note: parsed.data.note,
    },
  });

  // Keep static variation fields in sync
  await prisma.positionVariation.update({
    where: { id: variationId },
    data: {
      multiplierDelta: parsed.data.multiplierDelta,
      fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
