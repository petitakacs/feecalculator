import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SeasonForm } from "@/components/seasons/SeasonForm";

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
    </div>
  );
}
