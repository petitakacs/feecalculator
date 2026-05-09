import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessRulesManager } from "@/components/settings/BusinessRulesManager";
import { UsersManager } from "@/components/settings/UsersManager";
import { formatDate, formatPercent } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const rules = await prisma.businessRule.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  const canManageUsers = hasPermission(session.user.role, "users:manage");

  const users = canManageUsers
    ? await prisma.user.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {canManageUsers && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-1">Felhasználók kezelése</h2>
          <UsersManager
            initialUsers={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role as import("@/types").Role,
              active: u.active,
              createdAt: u.createdAt.toISOString(),
            }))}
            currentUserId={session.user.id}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Business Rules</h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure the service charge percentage and employee contribution rate.
        </p>

        <BusinessRulesManager
          rules={rules.map((r) => ({
            id: r.id,
            effectiveFrom: r.effectiveFrom.toISOString().split("T")[0],
            effectiveTo: r.effectiveTo?.toISOString().split("T")[0] ?? undefined,
            serviceChargePercent: Number(r.serviceChargePercent),
            employeeContribution: Number(r.employeeContribution),
            notes: r.notes ?? undefined,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))}
          userRole={session.user.role}
        />
      </div>
    </div>
  );
}
