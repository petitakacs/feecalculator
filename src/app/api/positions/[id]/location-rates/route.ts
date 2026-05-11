import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const UpsertRateSchema = z.object({
  locationId: z.string().min(1),
  fixedHourlySZD: z.number().int().min(0),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rates = await prisma.positionLocationRate.findMany({
    where: { positionId: id },
    include: { location: { select: { id: true, name: true } } },
    orderBy: { location: { name: "asc" } },
  });

  return NextResponse.json(rates);
}

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
  const parsed = UpsertRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) return NextResponse.json({ error: "Pozíció nem található" }, { status: 404 });

  const location = await prisma.location.findUnique({ where: { id: parsed.data.locationId } });
  if (!location) return NextResponse.json({ error: "Helyszín nem található" }, { status: 404 });

  const rate = await prisma.positionLocationRate.upsert({
    where: { positionId_locationId: { positionId: id, locationId: parsed.data.locationId } },
    create: {
      positionId: id,
      locationId: parsed.data.locationId,
      fixedHourlySZD: parsed.data.fixedHourlySZD,
    },
    update: {
      fixedHourlySZD: parsed.data.fixedHourlySZD,
    },
    include: { location: { select: { id: true, name: true } } },
  });

  return NextResponse.json(rate, { status: 201 });
}
