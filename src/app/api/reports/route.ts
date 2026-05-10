import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "reports:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "summary";
  const yearParam = searchParams.get("year");
  const yearInt = yearParam ? parseInt(yearParam, 10) : undefined;
  if (yearInt !== undefined && (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100)) {
    return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
  }

  if (type === "summary") {
    const periods = await prisma.monthlyPeriod.findMany({
      where: yearInt !== undefined ? { year: yearInt } : undefined,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { season: true },
    });
    return NextResponse.json(periods);
  }

  if (type === "employee") {
    const periodId = searchParams.get("periodId");
    if (!periodId) {
      return NextResponse.json({ error: "periodId required for employee report" }, { status: 400 });
    }
    const entries = await prisma.monthlyEmployeeEntry.findMany({
      where: { periodId },
      include: {
        employee: { include: { position: true } },
        position: true,
      },
      orderBy: [{ employee: { name: "asc" } }],
    });
    return NextResponse.json(entries);
  }

  if (type === "balance_trend") {
    const periods = await prisma.monthlyPeriod.findMany({
      where: yearInt !== undefined ? { year: yearInt } : undefined,
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: {
        id: true,
        month: true,
        year: true,
        openingBalance: true,
        collectedServiceCharge: true,
        distributableBalance: true,
        approvedDistributionTotal: true,
        closingBalance: true,
        status: true,
      },
    });
    return NextResponse.json(periods);
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
