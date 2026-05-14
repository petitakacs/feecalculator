import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateRateHistorySchema = z.object({
  multiplier: z.number().positive(),
  fixedHourlySZD: z.number().int().min(0).nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await prisma.positionRateHistory.findMany({
    where: { positionId: id },
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json(history);
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

  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) return NextResponse.json({ error: "Pozíció nem található" }, { status: 404 });

  const body = await req.json();
  const parsed = CreateRateHistorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  // Close out any currently-open record that would overlap
  await prisma.positionRateHistory.updateMany({
    where: {
      positionId: id,
      effectiveTo: null,
      effectiveFrom: { lt: effectiveFrom },
    },
    data: {
      // Set effectiveTo to one day before the new record starts
      effectiveTo: new Date(effectiveFrom.getTime() - 86400000),
    },
  });

  const record = await prisma.positionRateHistory.create({
    data: {
      positionId: id,
      multiplier: parsed.data.multiplier,
      fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
      effectiveFrom,
      note: parsed.data.note,
    },
  });

  // Keep the position's static field in sync with the latest value
  await prisma.position.update({
    where: { id },
    data: {
      multiplier: parsed.data.multiplier,
      fixedHourlySZD: parsed.data.fixedHourlySZD ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
