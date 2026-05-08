import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PositionsManager } from "@/components/positions/PositionsManager";

export default async function PositionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const positions = await prisma.position.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Positions</h1>
      </div>
      <PositionsManager
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          multiplier: Number(p.multiplier),
          eligibleForServiceCharge: p.eligibleForServiceCharge,
          defaultOvertimeRule: p.defaultOvertimeRule ?? undefined,
          minHourlyServiceCharge: p.minHourlyServiceCharge ?? undefined,
          maxHourlyServiceCharge: p.maxHourlyServiceCharge ?? undefined,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          employeeCount: p._count.employees,
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}
