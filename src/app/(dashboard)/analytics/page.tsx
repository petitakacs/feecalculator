import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { AnalyticsRecord } from "@/types/analytics";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  // Fetch all MonthlyEmployeeEntry records with needed relations
  const entries = await prisma.monthlyEmployeeEntry.findMany({
    include: {
      period: {
        include: {
          location: true,
          season: true,
        },
      },
      employee: true,
      position: true,
    },
    orderBy: [{ period: { year: "asc" } }, { period: { month: "asc" } }],
  });

  // Fetch extra tasks grouped by (periodId, employeeId) to sum totals
  const extraTasks = await prisma.monthlyExtraTask.findMany({
    select: {
      periodId: true,
      employeeId: true,
      amount: true,
    },
  });

  // Build a map: `${periodId}:${employeeId}` -> total extra tasks amount
  const extraTasksMap = new Map<string, number>();
  for (const task of extraTasks) {
    const key = `${task.periodId}:${task.employeeId}`;
    extraTasksMap.set(key, (extraTasksMap.get(key) ?? 0) + task.amount);
  }

  // Map entries to AnalyticsRecord[]
  const records: AnalyticsRecord[] = entries.map((entry) => {
    const period = entry.period;
    const extraTasksTotal =
      extraTasksMap.get(`${entry.periodId}:${entry.employeeId}`) ?? 0;

    const targetSZD = entry.targetServiceChargeAmount ?? 0;
    const approvedSZD =
      entry.overrideFlag && entry.finalApprovedAmount != null
        ? entry.finalApprovedAmount
        : entry.finalApprovedAmount ?? null;
    const effectiveSZD = approvedSZD ?? targetSZD;

    const bonus = entry.bonus;
    const overtimePayment = entry.overtimePayment;
    const manualCorrection = entry.manualCorrection;
    const totalPayout =
      effectiveSZD + bonus + overtimePayment + manualCorrection + extraTasksTotal;

    return {
      periodId: entry.periodId,
      employeeId: entry.employeeId,
      seasonId: period.seasonId,
      seasonName: period.season.name,
      employeeName: entry.employee.name,
      positionName: entry.position.name,
      locationName: period.location?.name ?? null,
      month: period.month,
      year: period.year,
      periodStatus: period.status,
      workedHours: Number(entry.workedHours),
      targetSZD,
      approvedSZD,
      effectiveSZD,
      bonus,
      overtimePayment,
      manualCorrection,
      extraTasksTotal,
      totalPayout,
      overrideFlag: entry.overrideFlag,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analítika</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dolgozói SZD és juttatási statisztikák
        </p>
      </div>
      <AnalyticsView records={records} />
    </div>
  );
}
