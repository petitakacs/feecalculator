import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SeasonForm } from "@/components/seasons/SeasonForm";
import { SeasonRatesPanel } from "@/components/seasons/SeasonRatesPanel";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isNew = id === "new";

  const season = isNew
    ? null
    : await prisma.season.findUnique({
        where: { id },
      });

  if (!isNew && !season) notFound();

  // Pre-fetch data for the rates panel (only needed when editing an existing season)
  const [positions, locations, extraTaskTypes] = isNew
    ? [[], [], []]
    : await Promise.all([
        prisma.position.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: {
            variations: {
              where: { active: true },
              include: {
                locationRates: { select: { locationId: true, fixedHourlySZD: true } },
              },
            },
            locationRates: { select: { locationId: true, fixedHourlySZD: true } },
          },
        }),
        prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
        prisma.extraTaskType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-gray-500 hover:text-gray-700">
          ← Seasons
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Season" : season?.name}
        </h1>
      </div>

      <SeasonForm
        season={
          season
            ? {
                id: season.id,
                name: season.name,
                startDate: season.startDate.toISOString().split("T")[0],
                endDate: season.endDate.toISOString().split("T")[0],
                referenceMode: season.referenceMode,
                manualWaiterTargetHourly: season.manualWaiterTargetHourly ?? undefined,
                minAllowedVariance: season.minAllowedVariance ? Number(season.minAllowedVariance) : undefined,
                maxAllowedVariance: season.maxAllowedVariance ? Number(season.maxAllowedVariance) : undefined,
                active: season.active,
                createdAt: season.createdAt.toISOString(),
                updatedAt: season.updatedAt.toISOString(),
              }
            : null
        }
        userRole={session.user.role}
      />

      {!isNew && season && (
        <div className="bg-white rounded-lg shadow p-6">
          <SeasonRatesPanel
            seasonId={season.id}
            positions={positions.map((p) => ({
              id: p.id,
              name: p.name,
              multiplier: Number(p.multiplier),
              fixedHourlySZD: p.fixedHourlySZD ?? null,
              variations: p.variations.map((v) => ({
                id: v.id,
                name: v.name,
                multiplierDelta: Number(v.multiplierDelta),
                fixedHourlySZD: v.fixedHourlySZD ?? null,
                locationRates: v.locationRates,
              })),
              locationRates: p.locationRates,
            }))}
            locations={locations}
            extraTaskTypes={extraTaskTypes.map((e) => ({
              id: e.id,
              name: e.name,
              bonusType: e.bonusType,
              bonusAmount: e.bonusAmount,
              rateMultiplier: e.rateMultiplier != null ? Number(e.rateMultiplier) : null,
            }))}
            userRole={session.user.role}
          />
        </div>
      )}
    </div>
  );
}
