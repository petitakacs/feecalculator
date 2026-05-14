import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateSchema = z.object({
  bonusType: z.enum(["FIXED_AMOUNT", "HOURLY_RATE", "MULTIPLIER_FULL_HOURLY", "MULTIPLIER_SERVICE_CHARGE_HOURLY"]),
  bonusAmount: z.number().int().min(0),
  rateMultiplier: z.number().positive().nullable().optional(),
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

  const history = await prisma.extraTaskRateHistory.findMany({
    where: { extraTaskTypeId: id },
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
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskType = await prisma.extraTaskType.findUnique({ where: { id } });
  if (!taskType) return NextResponse.json({ error: "Extra feladat típus nem található" }, { status: 404 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  await prisma.extraTaskRateHistory.updateMany({
    where: { extraTaskTypeId: id, effectiveTo: null, effectiveFrom: { lt: effectiveFrom } },
    data: { effectiveTo: new Date(effectiveFrom.getTime() - 86400000) },
  });

  const record = await prisma.extraTaskRateHistory.create({
    data: {
      extraTaskTypeId: id,
      bonusType: parsed.data.bonusType,
      bonusAmount: parsed.data.bonusAmount,
      rateMultiplier: parsed.data.rateMultiplier ?? null,
      effectiveFrom,
      note: parsed.data.note,
    },
  });

  // Keep the static fields in sync
  await prisma.extraTaskType.update({
    where: { id },
    data: {
      bonusType: parsed.data.bonusType,
      bonusAmount: parsed.data.bonusAmount,
      rateMultiplier: parsed.data.rateMultiplier ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
