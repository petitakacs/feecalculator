import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LocationsManager } from "@/components/locations/LocationsManager";

export default async function LocationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true, periods: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Lokációk</h1>
      <LocationsManager
        initialLocations={locations.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address ?? undefined,
          active: l.active,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
          _count: l._count,
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}
