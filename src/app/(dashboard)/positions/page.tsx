import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PositionsManager } from "@/components/positions/PositionsManager";

export default async function PositionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [positions, locations] = await Promise.all([
    prisma.position.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { employees: true } },
        variations: {
          orderBy: { name: "asc" },
          include: {
            locationRates: { include: { location: { select: { id: true, name: true } } } },
          },
        },
        locationRates: { include: { location: { select: { id: true, name: true } } } },
      },
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pozíciók</h1>
      </div>
      <PositionsManager
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          multiplier: Number(p.multiplier),
          fixedHourlySZD: p.fixedHourlySZD ?? null,
          eligibleForServiceCharge: p.eligibleForServiceCharge,
          defaultOvertimeRule: p.defaultOvertimeRule ?? undefined,
          minHourlyServiceCharge: p.minHourlyServiceCharge ?? undefined,
          maxHourlyServiceCharge: p.maxHourlyServiceCharge ?? undefined,
          sortOrder: p.sortOrder,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          employeeCount: p._count.employees,
          variations: p.variations.map((v) => ({
            id: v.id,
            name: v.name,
            multiplierDelta: Number(v.multiplierDelta),
            fixedHourlySZD: v.fixedHourlySZD ?? null,
            active: v.active,
            locationRates: v.locationRates.map((r) => ({
              id: r.id,
              locationId: r.locationId,
              fixedHourlySZD: r.fixedHourlySZD,
              location: r.location,
            })),
          })),
          locationRates: p.locationRates.map((r) => ({
            id: r.id,
            locationId: r.locationId,
            fixedHourlySZD: r.fixedHourlySZD,
            location: r.location,
          })),
        }))}
        userRole={session.user.role}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
