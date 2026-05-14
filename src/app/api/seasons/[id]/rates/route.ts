import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// GET /api/seasons/[id]/rates
// Returns all seasonal rate overrides for all entity types.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [
    positionRules,
    variationRules,
    positionLocationRates,
    variationLocationRates,
    extraTaskRates,
  ] = await Promise.all([
    prisma.seasonPositionRule.findMany({
      where: { seasonId: id },
      include: { position: { select: { id: true, name: true, multiplier: true, fixedHourlySZD: true } } },
    }),
    prisma.seasonVariationRule.findMany({
      where: { seasonId: id },
      include: {
        variation: {
          select: {
            id: true, name: true, multiplierDelta: true, fixedHourlySZD: true,
            position: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.seasonPositionLocationRate.findMany({
      where: { seasonId: id },
      include: {
        position: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.seasonVariationLocationRate.findMany({
      where: { seasonId: id },
      include: {
        variation: {
          select: {
            id: true, name: true,
            position: { select: { id: true, name: true } },
          },
        },
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.seasonExtraTaskRate.findMany({
      where: { seasonId: id },
      include: { extraTaskType: { select: { id: true, name: true, bonusType: true, bonusAmount: true, rateMultiplier: true } } },
    }),
  ]);

  return NextResponse.json({
    positionRules,
    variationRules,
    positionLocationRates,
    variationLocationRates,
    extraTaskRates,
  });
}
