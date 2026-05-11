import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CreatePeriodSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { calculateDistributableBalance } from "@/lib/calculation-engine";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periods = await prisma.monthlyPeriod.findMany({
    include: { season: true, location: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreatePeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  // Check for existing period (same location + month/year)
  const locationId = parsed.data.locationId ?? null;
  const existing = await prisma.monthlyPeriod.findFirst({
    where: {
      month: parsed.data.month,
      year: parsed.data.year,
      locationId: locationId,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A period for this month/year and location already exists" },
      { status: 409 }
    );
  }

  const distributableBalance = calculateDistributableBalance(
    parsed.data.openingBalance,
    parsed.data.collectedServiceCharge
  );

  const period = await prisma.monthlyPeriod.create({
    data: {
      month: parsed.data.month,
      year: parsed.data.year,
      seasonId: parsed.data.seasonId,
      locationId: parsed.data.locationId ?? null,
      openingBalance: parsed.data.openingBalance,
      collectedServiceCharge: parsed.data.collectedServiceCharge,
      distributableBalance,
      notes: parsed.data.notes,
    },
    include: { season: true, location: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entityType: "MonthlyPeriod",
    entityId: period.id,
    periodId: period.id,
    after: { month: period.month, year: period.year },
  });

  return NextResponse.json(period, { status: 201 });
}
