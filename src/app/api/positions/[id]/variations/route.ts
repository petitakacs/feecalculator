import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateVariationSchema = z.object({
  name: z.string().min(1, "Név kötelező"),
  multiplierDelta: z.number(),
  fixedHourlySZD: z.number().int().min(0).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateVariationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) return NextResponse.json({ error: "Pozíció nem található" }, { status: 404 });

  const existing = await prisma.positionVariation.findUnique({
    where: { positionId_name: { positionId: id, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ilyen nevű változat már létezik" }, { status: 409 });
  }

  const variation = await prisma.positionVariation.create({
    data: {
      positionId: id,
      name: parsed.data.name,
      multiplierDelta: parsed.data.multiplierDelta,
      fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.variationRateHistory.create({
    data: {
      variationId: variation.id,
      multiplierDelta: variation.multiplierDelta,
      fixedHourlySZD: variation.fixedHourlySZD ?? null,
      effectiveFrom: today,
      note: "Kezdő beállítás",
    },
  });

  return NextResponse.json(variation, { status: 201 });
}
