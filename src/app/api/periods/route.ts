import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreatePeriodSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { calculateDistributableBalance } from "@/lib/calculation-engine";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periods = await prisma.monthlyPeriod.findMany({
    include: { season: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreatePeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  // Check for existing period
  const existing = await prisma.monthlyPeriod.findUnique({
    where: { month_year: { month: parsed.data.month, year: parsed.data.year } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A period for this month/year already exists" },
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
      openingBalance: parsed.data.openingBalance,
      collectedServiceCharge: parsed.data.collectedServiceCharge,
      distributableBalance,
      notes: parsed.data.notes,
    },
    include: { season: true },
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
