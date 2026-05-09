import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPeriod, formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AllocationTable } from "@/components/allocation/AllocationTable";

export default async function AllocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    include: {
      season: true,
      entries: {
        include: {
          employee: { include: { position: true } },
          position: true,
        },
        orderBy: [{ employee: { name: "asc" } }],
      },
    },
  });

  if (!period) notFound();

  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: { position: true },
    orderBy: { name: "asc" },
  });

  const periodLabel = formatPeriod(period.month, period.year);

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
          <Link href="/periods" className="hover:text-gray-700">Periódusok</Link>
          <span className="text-gray-300">/</span>
          <Link href={`/periods/${id}`} className="hover:text-gray-700">{periodLabel}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Elosztási tábla</span>
        </nav>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            {periodLabel} — Elosztási tábla
          </h1>
          <StatusBadge status={period.status} />
        </div>
      </div>

      <AllocationTable
        period={{
          id: period.id,
          month: period.month,
          year: period.year,
          status: period.status,
          openingBalance: period.openingBalance,
          collectedServiceCharge: period.collectedServiceCharge,
          distributableBalance: period.distributableBalance,
          targetDistributionTotal: period.targetDistributionTotal,
          approvedDistributionTotal: period.approvedDistributionTotal,
          closingBalance: period.closingBalance,
          seasonId: period.seasonId,
          season: {
            id: period.season.id,
            name: period.season.name,
            referenceMode: period.season.referenceMode,
            startDate: period.season.startDate.toISOString(),
            endDate: period.season.endDate.toISOString(),
            active: period.season.active,
            createdAt: period.season.createdAt.toISOString(),
            updatedAt: period.season.updatedAt.toISOString(),
          },
          notes: period.notes ?? undefined,
          createdAt: period.createdAt.toISOString(),
          updatedAt: period.updatedAt.toISOString(),
        }}
        initialEntries={period.entries.map((e) => ({
          id: e.id,
          periodId: e.periodId,
          employeeId: e.employeeId,
          positionId: e.positionId,
          workedHours: Number(e.workedHours),
          overtimeHours: Number(e.overtimeHours),
          netWaiterSales: e.netWaiterSales ?? undefined,
          calculatedGrossServiceCharge: e.calculatedGrossServiceCharge ?? undefined,
          calculatedNetServiceCharge: e.calculatedNetServiceCharge ?? undefined,
          targetNetHourlyServiceCharge: e.targetNetHourlyServiceCharge ?? undefined,
          targetServiceChargeAmount: e.targetServiceChargeAmount ?? undefined,
          bonus: e.bonus,
          overtimePayment: e.overtimePayment,
          manualCorrection: e.manualCorrection,
          manualCorrectionReason: e.manualCorrectionReason ?? undefined,
          finalApprovedAmount: e.finalApprovedAmount ?? undefined,
          notes: e.notes ?? undefined,
          overrideFlag: e.overrideFlag,
          overrideReason: e.overrideReason ?? undefined,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
          employee: e.employee ? {
            id: e.employee.id,
            name: e.employee.name,
            active: e.employee.active,
            positionId: e.employee.positionId,
            baseSalaryType: e.employee.baseSalaryType,
            baseSalaryAmount: e.employee.baseSalaryAmount,
            eligibleForServiceCharge: e.employee.eligibleForServiceCharge,
            startDate: e.employee.startDate.toISOString(),
            endDate: e.employee.endDate?.toISOString() ?? undefined,
            location: e.employee.location ?? undefined,
            notes: e.employee.notes ?? undefined,
            createdAt: e.employee.createdAt.toISOString(),
            updatedAt: e.employee.updatedAt.toISOString(),
            position: e.employee.position ? {
              id: e.employee.position.id,
              name: e.employee.position.name,
              multiplier: Number(e.employee.position.multiplier),
              eligibleForServiceCharge: e.employee.position.eligibleForServiceCharge,
              active: e.employee.position.active,
              createdAt: e.employee.position.createdAt.toISOString(),
              updatedAt: e.employee.position.updatedAt.toISOString(),
            } : undefined,
          } : undefined,
          position: e.position ? {
            id: e.position.id,
            name: e.position.name,
            multiplier: Number(e.position.multiplier),
            eligibleForServiceCharge: e.position.eligibleForServiceCharge,
            active: e.position.active,
            createdAt: e.position.createdAt.toISOString(),
            updatedAt: e.position.updatedAt.toISOString(),
          } : undefined,
        }))}
        availableEmployees={employees.map((emp) => ({
          id: emp.id,
          name: emp.name,
          active: emp.active,
          positionId: emp.positionId,
          baseSalaryType: emp.baseSalaryType,
          baseSalaryAmount: emp.baseSalaryAmount,
          eligibleForServiceCharge: emp.eligibleForServiceCharge,
          startDate: emp.startDate.toISOString(),
          endDate: emp.endDate?.toISOString() ?? undefined,
          location: emp.location ?? undefined,
          notes: emp.notes ?? undefined,
          createdAt: emp.createdAt.toISOString(),
          updatedAt: emp.updatedAt.toISOString(),
          position: emp.position ? {
            id: emp.position.id,
            name: emp.position.name,
            multiplier: Number(emp.position.multiplier),
            eligibleForServiceCharge: emp.position.eligibleForServiceCharge,
            active: emp.position.active,
            createdAt: emp.position.createdAt.toISOString(),
            updatedAt: emp.position.updatedAt.toISOString(),
          } : undefined,
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}
