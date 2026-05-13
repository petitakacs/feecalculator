import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExtraTaskTypesManager } from "@/components/extra-tasks/ExtraTaskTypesManager";

export default async function ExtraTaskTypesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const types = await prisma.extraTaskType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Extra feladat típusok</h1>
      <p className="text-sm text-gray-500">
        Standardizált extra feladatok, amelyeket dolgozókhoz lehet rendelni egy perióduson belül.
        FIXED_AMOUNT: fix összeg; HOURLY_RATE: órabér × ledolgozott órák.
      </p>
      <ExtraTaskTypesManager
        initialTypes={types.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? undefined,
          bonusType: t.bonusType,
          bonusAmount: t.bonusAmount,
          rateMultiplier: t.rateMultiplier != null ? Number(t.rateMultiplier) : null,
          active: t.active,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          _count: t._count,
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}
