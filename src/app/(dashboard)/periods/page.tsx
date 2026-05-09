import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreatePeriodButton } from "@/components/periods/CreatePeriodButton";
import { PeriodsTable } from "@/components/periods/PeriodsTable";
import { hasPermission } from "@/lib/permissions";

export default async function PeriodsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [periods, seasons, locations] = await Promise.all([
    prisma.monthlyPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { season: true, location: true },
    }),
    prisma.season.findMany({ where: { active: true } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const canDelete = hasPermission(session.user.role, "periods:delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Periods</h1>
        <CreatePeriodButton
          seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>

      <PeriodsTable
        periods={periods.map((p) => ({
          id: p.id,
          month: p.month,
          year: p.year,
          status: p.status,
          collectedServiceCharge: p.collectedServiceCharge,
          openingBalance: p.openingBalance,
          closingBalance: p.closingBalance,
          locationId: p.locationId,
          location: p.location ? { id: p.location.id, name: p.location.name } : null,
          season: { name: p.season.name },
        }))}
        canDelete={canDelete}
      />
    </div>
  );
}
