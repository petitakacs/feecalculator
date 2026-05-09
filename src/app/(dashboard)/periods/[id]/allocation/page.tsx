import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPeriod } from "@/lib/format";
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

  const [period, employees, locations, extraTasks, positions] = await Promise.all([
    prisma.monthlyPeriod.findUnique({
      where: { id },
      include: {
        season: true,
        location: true,
        entries: {
          include: {
            employee: { include: { position: true, location: true } },
            position: true,
            workingLocation: true,
          },
          orderBy: [{ employee: { name: "asc" } }, { position: { name: "asc" } }],
        },
      },
    }),
    prisma.employee.findMany({
      where: { active: true },
      include: { position: true, location: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.monthlyExtraTask.findMany({
      where: { periodId: id },
      include: { employee: true, extraTaskType: true },
      orderBy: [{ employee: { name: "asc" } }, { extraTaskType: { name: "asc" } }],
    }),
    prisma.position.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!period) notFound();

  const periodLabel = formatPeriod(period.month, period.year);

  const mapEmployee = (emp: typeof employees[0]) => ({
    id: emp.id,
    name: emp.name,
    active: emp.active,
    positionId: emp.positionId,
    baseSalaryType: emp.baseSalaryType,
    baseSalaryAmount: emp.baseSalaryAmount,
    eligibleForServiceCharge: emp.eligibleForServiceCharge,
    startDate: emp.startDate.toISOString(),
    endDate: emp.endDate?.toISOString() ?? undefined,
    locationId: emp.locationId ?? undefined,
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
    location: emp.location ? {
      id: emp.location.id,
      name: emp.location.name,
      active: emp.location.active,
      createdAt: emp.location.createdAt.toISOString(),
      updatedAt: emp.location.updatedAt.toISOString(),
    } : undefined,
  });

  return (
    <div className="space-y-4">
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
            {periodLabel}{period.location ? ` — ${period.location.name}` : ""} — Elosztási tábla
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
          locationId: period.locationId ?? undefined,
          openingBalance: period.openingBalance,
          collectedServiceCharge: period.collectedServiceCharge,
          distributableBalance: period.distributableBalance,
          targetDistributionTotal: period.targetDistributionTotal,
          approvedDistributionTotal: period.approvedDistributionTotal,
          closingBalance: period.closingBalance,
          waiterReferenceHourlyRate: period.waiterReferenceHourlyRate ?? undefined,
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
          workingLocationId: e.workingLocationId ?? undefined,
          workingLocation: e.workingLocation ? {
            id: e.workingLocation.id,
            name: e.workingLocation.name,
            active: e.workingLocation.active,
            createdAt: e.workingLocation.createdAt.toISOString(),
            updatedAt: e.workingLocation.updatedAt.toISOString(),
          } : undefined,
          isLoanEntry: e.isLoanEntry,
          entryLabel: e.entryLabel ?? undefined,
          workedHours: Number(e.workedHours),
          overtimeHours: Number(e.overtimeHours),
          netWaiterSales: e.netWaiterSales ?? undefined,
          calculatedGrossServiceCharge: e.calculatedGrossServiceCharge ?? undefined,
          calculatedNetServiceCharge: e.calculatedNetServiceCharge ?? undefined,
          targetNetHourlyServiceCharge: e.targetNetHourlyServiceCharge ?? undefined,
          calculatedTargetNetHourlyServiceCharge: e.calculatedTargetNetHourlyServiceCharge ?? undefined,
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
          employee: e.employee ? mapEmployee(e.employee as typeof employees[0]) : undefined,
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
        availableEmployees={employees.map(mapEmployee)}
        availablePositions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          multiplier: Number(p.multiplier),
          eligibleForServiceCharge: p.eligibleForServiceCharge,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
        locations={locations.map((l) => ({
          id: l.id,
          name: l.name,
          active: l.active,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        }))}
        initialExtraTasks={extraTasks.map((t) => ({
          id: t.id,
          periodId: t.periodId,
          employeeId: t.employeeId,
          extraTaskTypeId: t.extraTaskTypeId,
          hours: t.hours ? Number(t.hours) : undefined,
          amount: t.amount,
          notes: t.notes ?? undefined,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          employee: t.employee ? {
            id: t.employee.id,
            name: t.employee.name,
            active: t.employee.active,
            positionId: t.employee.positionId,
            baseSalaryType: t.employee.baseSalaryType,
            baseSalaryAmount: t.employee.baseSalaryAmount,
            eligibleForServiceCharge: t.employee.eligibleForServiceCharge,
            startDate: t.employee.startDate.toISOString(),
            createdAt: t.employee.createdAt.toISOString(),
            updatedAt: t.employee.updatedAt.toISOString(),
          } : undefined,
          extraTaskType: t.extraTaskType ? {
            id: t.extraTaskType.id,
            name: t.extraTaskType.name,
            bonusType: t.extraTaskType.bonusType,
            bonusAmount: t.extraTaskType.bonusAmount,
            active: t.extraTaskType.active,
            createdAt: t.extraTaskType.createdAt.toISOString(),
            updatedAt: t.extraTaskType.updatedAt.toISOString(),
          } : undefined,
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}
